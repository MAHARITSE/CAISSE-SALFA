<?php
/**
 * Installation du paquet sur un serveur WAMP/MAMP, sans ligne de commande.
 *
 * Appelée par `installer.php`, à la racine du paquet : installation complète
 * (installation scriptée). Toutes les étapes sont idempotentes : une
 * installation interrompue peut être relancée sans perdre de données.
 *
 * L'ordre compte : la configuration `data/salfa-config.php` n'est écrite
 * qu'à la fin, car sa présence signifie « installé » pour toute l'API.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

/** Où la configuration s'écrit, par ordre de préférence. */
function salfa_chemins_configuration(string $racine): array
{
    return [
        rtrim($racine, '/\\') . '/data/salfa-config.php',
        rtrim($racine, '/\\') . '/api/salfa-config.php',
    ];
}

/** Message lisible pour une erreur MySQL (sans exposer le mot de passe). */
function salfa_erreur_mysql(Throwable $e): string
{
    $code = (int) $e->getCode();
    return match (true) {
        $code === 1045 => 'Accès refusé : l’utilisateur ou le mot de passe MySQL est incorrect.',
        $code === 1049 => 'La base demandée n’existe pas et n’a pas pu être créée.',
        $code === 2002, $code === 2003 => 'MySQL ne répond pas sur cet hôte et ce port : WAMP est-il démarré (icône verte) ?',
        default => 'MySQL a répondu : ' . $e->getMessage(),
    };
}

/** Connexion au serveur MySQL seul, sans choisir encore de base. */
function salfa_pdo_serveur(string $hote, int $port, string $utilisateur, string $motDePasse): PDO
{
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $hote, $port),
            $utilisateur,
            $motDePasse,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 6,
            ]
        );
    } catch (PDOException $e) {
        throw new RuntimeException(salfa_erreur_mysql($e), 0, $e);
    }
    $pdo->exec('SET NAMES utf8mb4');
    return $pdo;
}

/**
 * Retire `CREATE DATABASE` et `USE` du script livré : l'installateur choisit
 * lui-même la base, qui peut porter un autre nom que `caisse_salfa`.
 * Le fichier `sql/salfa_install.sql` reste utilisable tel quel dans phpMyAdmin.
 */
function salfa_sql_sans_base(string $sql): string
{
    $sql = (string) preg_replace('/^\s*CREATE\s+DATABASE\b[^;]*;/mi', '', $sql);
    $sql = (string) preg_replace('/^\s*USE\s+`?[A-Za-z0-9_]+`?\s*;/mi', '', $sql);
    return $sql;
}

/** Vérifie le nom de base : lettres, chiffres et souligné, sans accent. */
function salfa_nom_base_valide(string $base): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_]{1,64}$/', $base);
}

/**
 * Installations complètes : base, tables, compte administrateur, puis
 * configuration. Renvoie un compte rendu affichable.
 *
 * @param array{hote:string,port:int,base:string,utilisateur:string,mot_de_passe:string,admin:string,nom:string,mot_de_passe_admin:string} $options
 * @return array{base:string,tables:int,identifiant:string,fichier:string}
 */
function salfa_installer(array $options, string $racine): array
{
    $hote = trim($options['hote']) !== '' ? trim($options['hote']) : '127.0.0.1';
    $port = (int) ($options['port'] ?: 3306);
    $base = trim($options['base']);
    $utilisateur = trim($options['utilisateur']);
    $motDePasse = (string) $options['mot_de_passe'];
    $identifiant = strtolower(trim($options['admin']));
    $nom = trim($options['nom']) !== '' ? trim($options['nom']) : 'Administrateur';
    $motDePasseAdmin = (string) $options['mot_de_passe_admin'];

    if (!salfa_nom_base_valide($base)) {
        throw new RuntimeException('Nom de base invalide : lettres, chiffres et souligné uniquement (ex. caisse_salfa).');
    }
    if ($utilisateur === '') {
        throw new RuntimeException('Indiquez l’utilisateur MySQL (souvent « root » sur WAMP).');
    }
    if (!preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
        throw new RuntimeException('Identifiant administrateur invalide : 3 à 80 caractères (lettres, chiffres, point, tiret, souligné).');
    }
    if (mb_strlen($motDePasseAdmin) < 8) {
        throw new RuntimeException('Le mot de passe administrateur doit contenir au moins 8 caractères.');
    }
    if ($utilisateur === $identifiant && $motDePasseAdmin === $motDePasse) {
        throw new RuntimeException('Choisissez un mot de passe administrateur différent de celui de MySQL.');
    }

    // 1. Base de données.
    $pdo = salfa_pdo_serveur($hote, $port, $utilisateur, $motDePasse);
    try {
        $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . $base . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    } catch (PDOException $e) {
        throw new RuntimeException('Création de la base « ' . $base . ' » impossible : ' . salfa_erreur_mysql($e), 0, $e);
    }

    // 2. Tables et données de départ.
    $script = rtrim($racine, '/\\') . '/sql/salfa_install.sql';
    $sql = is_file($script) ? (string) file_get_contents($script) : '';
    if (trim($sql) === '') {
        throw new RuntimeException('Le fichier sql/salfa_install.sql est absent du paquet : recopiez le dossier complet.');
    }
    try {
        $pdo->exec('USE `' . $base . '`');
        $pdo->exec(salfa_sql_sans_base($sql));
    } catch (PDOException $e) {
        throw new RuntimeException('Création des tables impossible : ' . salfa_erreur_mysql($e), 0, $e);
    }

    $prefixe = 'salfa_';
    $tables = (int) $pdo->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ' . $pdo->quote($base) . ' AND table_name LIKE ' . $pdo->quote($prefixe . '%'))->fetchColumn();
    if ($tables < 14) {
        throw new RuntimeException('Le script SQL n’a créé que ' . $tables . ' table(s) sur 14 : vérifiez que le dossier sql/ est complet.');
    }

    // 3. Compte administrateur (rejouable : met à jour s'il existe déjà).
    try {
        $requete = $pdo->prepare(
            'INSERT INTO `' . $prefixe . 'utilisateurs` (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
            . ' ON DUPLICATE KEY UPDATE mdp_hash = VALUES(mdp_hash), nom_complet = VALUES(nom_complet), role = VALUES(role), actif = 1'
        );
        $requete->execute([$identifiant, $nom, password_hash($motDePasseAdmin, PASSWORD_DEFAULT), 'admin']);
    } catch (PDOException $e) {
        throw new RuntimeException('Création du compte administrateur impossible : ' . salfa_erreur_mysql($e), 0, $e);
    }

    // 4. Configuration — écrite en dernier : sa présence vaut « installé ».
    $fichier = salfa_ecrire_configuration($racine, [
        'hote' => $hote,
        'port' => $port,
        'base' => $base,
        'utilisateur' => $utilisateur,
        'mot_de_passe' => $motDePasse,
    ]);

    return ['base' => $base, 'tables' => $tables, 'identifiant' => $identifiant, 'fichier' => $fichier];
}

/**
 * Écrit `data/salfa-config.php` (ou `api/salfa-config.php` si `data/` n'est pas
 * inscriptible). Renvoie le chemin relatif au site, pour l'affichage.
 *
 * @param array{hote:string,port:int,base:string,utilisateur:string,mot_de_passe:string} $mysql
 */
function salfa_ecrire_configuration(string $racine, array $mysql): string
{
    $dossierData = rtrim($racine, '/\\') . '/data';
    if (!is_dir($dossierData) && !@mkdir($dossierData, 0775, true) && !is_dir($dossierData)) {
        $dossierData = null;
    }
    $cibles = $dossierData !== null ? [$dossierData . '/salfa-config.php'] : [];
    $cibles[] = rtrim($racine, '/\\') . '/api/salfa-config.php';

    $contenu = "<?php\n\n// Généré par installer.php — fichier privé, à ne jamais versionner.\nreturn " . var_export([
        'hote' => $mysql['hote'],
        'port' => (int) $mysql['port'],
        'base' => $mysql['base'],
        'utilisateur' => $mysql['utilisateur'],
        'mot_de_passe' => (string) $mysql['mot_de_passe'],
        'prefixe' => 'salfa_',
        'prefixe_session' => 'salfa_session_',
        'mode_session' => 'mixte',
        'sel_session' => bin2hex(random_bytes(16)),
        'debug' => false,
        'limite_requetes' => 60,
        'fenetre_requetes' => 60,
        'timezone' => 'Indian/Antananarivo',
    ], true) . ";\n";

    foreach ($cibles as $cible) {
        if (@file_put_contents($cible, $contenu) !== false) {
            @chmod($cible, 0640);
            $relatif = str_replace('\\', '/', substr($cible, strlen(rtrim($racine, '/\\')) + 1));
            return $relatif;
        }
    }
    throw new RuntimeException(
        'Impossible d’écrire la configuration : le dossier data/ n’est pas inscriptible. '
        . 'Sur Windows, vérifiez les droits du dossier caisse-salfa\\data (ou créez-le à la main).'
    );
}

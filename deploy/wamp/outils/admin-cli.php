<?php
/**
 * Création ou réinitialisation d'un compte (appelé par outils\creer-admin.bat).
 *
 *   php outils/admin-cli.php [dossier-du-site]
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

$site = rtrim(str_replace('\\', '/', $argv[1] ?? dirname(__DIR__)), '/');

/** Demande une valeur, avec une proposition par défaut. */
function demander(string $question, string $defaut = ''): string
{
    echo $question;
    $reponse = trim((string) fgets(STDIN));
    return $reponse === '' ? $defaut : $reponse;
}

/**
 * La configuration manque quand les tables ont été importées à la main dans
 * phpMyAdmin : on la crée ici, après avoir vérifié que la base répond.
 */
if (!is_file($site . '/data/salfa-config.php')) {
    echo "\n  data/salfa-config.php absent : configuration de la connexion MySQL.\n";
    echo "  (Vous avez pu importer sql/salfa_install.sql à la main dans phpMyAdmin.)\n\n";
    $hote = demander('  Hôte [127.0.0.1] : ', '127.0.0.1');
    $port = (int) demander('  Port [3306] : ', '3306');
    $base = demander('  Base de données [caisse_salfa] : ', 'caisse_salfa');
    $utilisateur = demander('  Utilisateur [root] : ', 'root');
    echo '  Mot de passe MySQL (vide si aucun) : ';
    $motDePasseBase = trim((string) fgets(STDIN));

    try {
        $verification = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $hote, $port, $base),
            $utilisateur,
            $motDePasseBase,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 6]
        );
        $tables = $verification->query("SHOW TABLES LIKE 'salfa_%'")->fetchAll(PDO::FETCH_COLUMN);
        if (count($tables) === 0) {
            fwrite(STDERR, "  La base « $base » existe mais ne contient aucune table salfa_.\n");
            fwrite(STDERR, "  Importez d'abord sql/salfa_install.sql dans phpMyAdmin, puis relancez.\n");
            exit(1);
        }
        echo '  ' . count($tables) . " table(s) salfa_ trouvee(s).\n";
    } catch (Throwable $e) {
        fwrite(STDERR, '  Connexion MySQL impossible : ' . $e->getMessage() . "\n");
        exit(1);
    }

    $dossierData = $site . '/data';
    if (!is_dir($dossierData) && !mkdir($dossierData, 0775, true)) {
        fwrite(STDERR, "  Impossible de créer $dossierData\n");
        exit(1);
    }
    $contenu = "<?php\n\n// Généré par outils/admin-cli.php — ne jamais versionner.\nreturn " . var_export([
        'hote' => $hote,
        'port' => $port,
        'base' => $base,
        'utilisateur' => $utilisateur,
        'mot_de_passe' => $motDePasseBase,
        'prefixe' => 'salfa_',
        'prefixe_session' => 'salfa_session_',
        'mode_session' => 'mixte',
        'sel_session' => bin2hex(random_bytes(16)),
        'debug' => false,
        'limite_requetes' => 60,
        'fenetre_requetes' => 60,
        'timezone' => 'Indian/Antananarivo',
    ], true) . ";\n";
    if (file_put_contents($dossierData . '/salfa-config.php', $contenu) === false) {
        fwrite(STDERR, "  Impossible d'écrire data/salfa-config.php\n");
        exit(1);
    }
    @chmod($dossierData . '/salfa-config.php', 0640);
    echo "  data/salfa-config.php écrit.\n\n";
}

$config = require $site . '/data/salfa-config.php';

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['hote'], (int) $config['port'], $config['base']),
        (string) $config['utilisateur'],
        (string) $config['mot_de_passe'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 6]
    );
} catch (Throwable $e) {
    fwrite(STDERR, '  Connexion MySQL impossible : ' . $e->getMessage() . "\n");
    exit(1);
}

echo "  Identifiant [admin] : ";
$identifiant = strtolower(trim((string) fgets(STDIN))) ?: 'admin';
if (!preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
    fwrite(STDERR, "  Identifiant invalide.\n");
    exit(1);
}
echo '  Mot de passe (8 caractères minimum) : ';
$motDePasse = trim((string) fgets(STDIN));
if (mb_strlen($motDePasse) < 8) {
    fwrite(STDERR, "  Mot de passe trop court.\n");
    exit(1);
}
echo '  Nom complet [Administrateur] : ';
$nom = trim((string) fgets(STDIN)) ?: 'Administrateur';
echo "  Rôle (admin/caissier/lecteur) [admin] : ";
$role = strtolower(trim((string) fgets(STDIN))) ?: 'admin';
if (!in_array($role, ['admin', 'caissier', 'lecteur'], true)) {
    fwrite(STDERR, "  Rôle invalide.\n");
    exit(1);
}

try {
    $requete = $pdo->prepare(
        'INSERT INTO salfa_utilisateurs (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
        . ' ON DUPLICATE KEY UPDATE mdp_hash = VALUES(mdp_hash), nom_complet = VALUES(nom_complet), role = VALUES(role), actif = 1'
    );
    $requete->execute([$identifiant, $nom, password_hash($motDePasse, PASSWORD_DEFAULT), $role]);
    echo "  Compte « $identifiant » prêt ($role).\n";
} catch (Throwable $e) {
    fwrite(STDERR, '  Échec : ' . $e->getMessage() . "\n");
    exit(1);
}
exit(0);

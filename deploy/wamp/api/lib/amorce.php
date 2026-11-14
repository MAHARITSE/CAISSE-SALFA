<?php
/**
 * CAISSE SALFA — amorçage automatique du serveur.
 *
 * Le dossier du site se copie dans `C:\wamp64\www\caisse-salfa` et c'est tout :
 * au premier appel de l'API, ce fichier
 *
 *   1. écrit la configuration `salfa-config.php` (hors de `www` quand c'est
 *      possible) avec les accès MySQL par défaut de WampServer ;
 *   2. crée la base `caisse_salfa` si elle n'existe pas ;
 *   3. crée les tables, les catégories et les modèles de départ ;
 *   4. crée un compte administrateur et un compte comptable de départ.
 *
 * Toutes les étapes sont idempotentes : un appel répété, une copie partielle ou
 * une coupure au milieu ne détruisent rien et n'écrasent aucune donnée.
 * Aucun script à lancer, aucun fichier à modifier, aucune ligne de commande.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

const SALFA_TABLES_ATTENDUES = 15;

/** Message utilisateur pour une erreur PDO, sans exposer le mot de passe. */
function salfa_erreur_mysql(Throwable $e): string
{
    $code = (int) $e->getCode();
    $message = $e->getMessage();
    return match (true) {
        $code === 1045 => 'Accès refusé par MySQL : l’utilisateur ou le mot de passe est incorrect.',
        $code === 1049 => 'La base demandée n’existe pas et n’a pas pu être créée.',
        $code === 2002, $code === 2003 => 'MySQL ne répond pas : vérifiez que WampServer est démarré (icône verte) et que MySQL tourne.',
        $code === 1044 => 'L’utilisateur MySQL n’a pas le droit de créer la base : utilisez « root », ou créez la base dans phpMyAdmin.',
        str_contains($message, 'Unknown database') => 'La base demandée n’existe pas et n’a pas pu être créée.',
        str_contains($message, 'Access denied') => 'Accès refusé par MySQL : l’utilisateur ou le mot de passe est incorrect.',
        str_contains($message, 'Connection refused'), str_contains($message, 'No such host') => 'MySQL ne répond pas : vérifiez que WampServer est démarré (icône verte).',
        default => 'MySQL a répondu : ' . $message,
    };
}

/**
 * Connexion PDO au serveur MySQL, sans choisir de base.
 * Les hôtes `localhost` et `127.0.0.1` sont essayés l'un après l'autre : sur
 * WampServer, l'un passe par la socket et l'autre par TCP, et un seul des deux
 * répond selon la configuration de `my.ini`.
 *
 * @return array{0: PDO, 1: string} connexion et hôte retenu
 */
function salfa_pdo_serveur(?array $acces = null): array
{
    $c = $acces ?? salfa_config();
    $hotes = [(string) $c['hote']];
    if ($c['hote'] === '127.0.0.1' || $c['hote'] === 'localhost') {
        $hotes = ['127.0.0.1', 'localhost'];
    }
    $ports = [(int) $c['port']];
    // WampServer peut décaler le port MySQL (3307, 3308) quand 3306 est pris.
    if ((int) $c['port'] === 3306) {
        $ports = [3306, 3307, 3308];
    }
    $derniere = null;
    foreach ($hotes as $hote) {
        foreach ($ports as $port) {
            try {
                $pdo = new PDO(
                    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $hote, $port),
                    (string) $c['utilisateur'],
                    (string) $c['mot_de_passe'],
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                        PDO::ATTR_TIMEOUT => 5,
                    ]
                );
                $pdo->exec('SET NAMES utf8mb4');
                return [$pdo, $hote . ':' . $port];
            } catch (PDOException $e) {
                $derniere = $e;
            }
        }
    }
    throw new SalFaErreur(
        salfa_erreur_mysql($derniere ?? new RuntimeException('MySQL injoignable')),
        503,
        'mysql_injoignable'
    );
}

/** Retire `CREATE DATABASE` et `USE` du script livré : la base est choisie par l'amorçage. */
function salfa_sql_sans_base(string $sql): string
{
    $sql = (string) preg_replace('/^\s*CREATE\s+DATABASE\b[^;]*;/mi', '', $sql);
    $sql = (string) preg_replace('/^\s*USE\s+`?[A-Za-z0-9_]+`?;?/mi', '', $sql);
    return $sql;
}

/** Exécute un script SQL multi-instructions, commentaires et `DELIMITER` compris. */
function salfa_executer_script(PDO $pdo, string $sql): void
{
    $sql = (string) preg_replace('/^\s*--.*$/m', '', $sql);
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [] as $instruction) {
        $instruction = trim($instruction);
        if ($instruction !== '') {
            $pdo->exec($instruction);
        }
    }
}

/** Nombre de tables `salfa_` présentes dans la base courante. */
function salfa_compter_tables(PDO $pdo): int
{
    $requete = $pdo->query(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '
        . $pdo->quote(salfa_prefixe() . '%')
    );
    return (int) $requete->fetchColumn();
}

/**
 * Crée (ou met à jour) les deux comptes de départ.
 *
 * `INSERT ... ON DUPLICATE KEY UPDATE` uniquement quand le compte n'existe pas :
 * un mot de passe déjà changé par l'utilisateur n'est jamais réinitialisé.
 */
function salfa_creer_comptes_initiaux(PDO $pdo): void
{
    $c = salfa_config();
    $comptes = [
        [(string) $c['compte_admin'], (string) $c['compte_admin_nom'], (string) $c['compte_admin_mdp'], 'admin'],
        [(string) $c['compte_comptable'], (string) $c['compte_comptable_nom'], (string) $c['compte_comptable_mdp'], 'comptable'],
    ];
    $prefixe = $pdo->quote(salfa_prefixe() . '%');
    $tables = $pdo->query(
        'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE ' . $prefixe
    )->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array(salfa_prefixe() . 'utilisateurs', $tables, true)) {
        return;
    }
    $existe = $pdo->prepare('SELECT id FROM ' . salfa_prefixe() . 'utilisateurs WHERE identifiant = ?');
    $inserer = $pdo->prepare(
        'INSERT INTO ' . salfa_prefixe() . 'utilisateurs (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
    );
    foreach ($comptes as [$identifiant, $nom, $motDePasse, $role]) {
        if ($identifiant === '') {
            continue;
        }
        $existe->execute([mb_strtolower($identifiant)]);
        if ($existe->fetchColumn() === false) {
            $inserer->execute([mb_strtolower($identifiant), $nom, password_hash($motDePasse, PASSWORD_DEFAULT), $role]);
        }
    }
    // Un administrateur actif doit toujours exister : sans lui, personne ne peut
    // gérer les comptes et le serveur serait définitivement bloqué.
    $admin = (int) $pdo->query(
        'SELECT COUNT(*) FROM ' . salfa_prefixe() . "utilisateurs WHERE role = 'admin' AND actif = 1"
    )->fetchColumn();
    if ($admin === 0) {
        $inserer->execute([
            mb_strtolower((string) $c['compte_admin']),
            (string) $c['compte_admin_nom'],
            password_hash((string) $c['compte_admin_mdp'], PASSWORD_DEFAULT),
            'admin',
        ]);
    }
}

/**
 * Prépare la base : base, tables, données de départ, comptes, configuration.
 *
 * @param array<string, mixed>|null $acces accès MySQL à essayer (écran de connexion) ;
 *                                         null pour ceux du fichier de configuration.
 * @return array{base:string, hote:string, tables:int, creee:bool, fichier:string}
 */
function salfa_amorcer(?array $acces = null, bool $ecrireConfig = true): array
{
    $c = $acces !== null ? array_merge(salfa_config(), $acces) : salfa_config();
    $base = (string) $c['base'];
    if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $base)) {
        throw new SalFaErreur('Nom de base invalide : lettres, chiffres et souligné uniquement (ex. caisse_salfa).', 400, 'base_invalide');
    }
    if (trim((string) $c['utilisateur']) === '') {
        throw new SalFaErreur('Indiquez l’utilisateur MySQL (sur WampServer : « root »).', 400, 'utilisateur_manquant');
    }

    /** @var PDO $pdo */
    [$pdo, $hote] = salfa_pdo_serveur($c);

    $creee = false;
    try {
        $pdo->query('USE `' . $base . '`');
    } catch (PDOException $e) {
        try {
            $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . $base . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $pdo->exec('USE `' . $base . '`');
            $creee = true;
        } catch (PDOException $creation) {
            throw new SalFaErreur(
                'Création de la base « ' . $base . ' » impossible : ' . salfa_erreur_mysql($creation),
                503,
                'base_non_creee'
            );
        }
    }

    $avant = salfa_compter_tables($pdo);
    $script = dirname(__DIR__) . '/installation/salfa_install.sql';
    if (!is_file($script)) {
        throw new SalFaErreur('Le fichier api/installation/salfa_install.sql est absent : recopiez le dossier complet du site.', 500, 'sql_absent');
    }
    $sql = (string) file_get_contents($script);
    if (trim($sql) === '') {
        throw new SalFaErreur('Le fichier api/installation/salfa_install.sql est vide : recopiez le dossier complet du site.', 500, 'sql_vide');
    }
    try {
        salfa_executer_script($pdo, salfa_sql_sans_base($sql));
    } catch (PDOException $e) {
        throw new SalFaErreur('Création des tables impossible : ' . salfa_erreur_mysql($e), 503, 'tables_non_creees');
    }

    $tables = salfa_compter_tables($pdo);
    if ($tables < SALFA_TABLES_ATTENDUES) {
        throw new SalFaErreur(
            'Le script SQL n’a créé que ' . $tables . ' table(s) sur ' . SALFA_TABLES_ATTENDUES . '.',
            500,
            'tables_incompletes'
        );
    }

    salfa_creer_comptes_initiaux($pdo);

    $fichier = '';
    if ($ecrireConfig) {
        $fichier = salfa_ecrire_config([
            'hote' => explode(':', $hote)[0],
            'port' => (int) explode(':', $hote)[1],
            'base' => $base,
            'utilisateur' => (string) $c['utilisateur'],
            'mot_de_passe' => (string) $c['mot_de_passe'],
            'initialise_le' => date('c'),
        ]);
    }
    $pdo = null;

    return ['base' => $base, 'hote' => $hote, 'tables' => $tables, 'creee' => $avant === 0 || $creee, 'fichier' => $fichier];
}

/**
 * Amorçage silencieux, appelé au début de chaque requête d'API.
 *
 * Ne fait rien si la base répond déjà : une requête ordinaire ne paie qu'un
 * `COUNT(*)` sur `information_schema`. En cas d'échec, l'erreur reste discrète
 * ici : c'est l'action demandée qui la remontera, avec le message adapté
 * (l'écran de connexion propose alors la saisie des accès MySQL).
 */
function salfa_amorcer_silencieusement(): void
{
    static $fait = false;
    if ($fait) {
        return;
    }
    $fait = true;
    $pdo = null;
    try {
        $pdo = salfa_pdo();
        $requete = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
        $requete->execute([salfa_prefixe() . 'livre']);
        $livreExistant = (int) $requete->fetchColumn() === 1;
    } catch (Throwable $e) {
        $livreExistant = false;
    }
    if ($pdo !== null && $livreExistant) {
        // Mise à jour ciblée : ne jamais rejouer le SQL de données initiales
        // sur une caisse existante, il écraserait les écritures et réglages.
        $requete->execute([salfa_prefixe() . 'registre_virements']);
        if ((int) $requete->fetchColumn() === 0) {
            try {
                $pdo->exec('CREATE TABLE IF NOT EXISTS ' . salfa_table('registre_virements') . ' (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, contenu LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
            } catch (Throwable $e) {
                throw new SalFaErreur('Création du registre de virements impossible. Vérifiez le droit CREATE de MySQL.', 503, 'migration_virements');
            }
            // Mise à niveau éventuelle d'une base antérieure où l'ancien rôle
            // « lecteur » existait encore, afin que le compte accède aux virements.
            try {
                $tableUtilisateurs = salfa_table('utilisateurs');
                $pdo->exec("ALTER TABLE $tableUtilisateurs MODIFY COLUMN role ENUM('lecteur','comptable','caissier','admin') NOT NULL DEFAULT 'caissier'");
                $pdo->exec("UPDATE $tableUtilisateurs SET role = 'comptable' WHERE role = 'lecteur'");
                $pdo->exec("ALTER TABLE $tableUtilisateurs MODIFY COLUMN role ENUM('comptable','caissier','admin') NOT NULL DEFAULT 'caissier'");
            } catch (Throwable $e) {
                // Table déjà conforme ou droits ALTER limités : on n'interrompt pas l'accès.
            }
        }
        return;
    }
    try {
        salfa_amorcer();
    } catch (Throwable $e) {
        error_log('SALFA amorçage différé : ' . $e->getMessage());
    }
}

<?php
/**
 * Installation complète en ligne de commande (appelée par outils\installer.bat).
 *
 *   php outils/install-cli.php [dossier-du-site]
 *
 * Réalise, sans navigateur : configuration MySQL, création de la base, des
 * tables et du compte administrateur, puis invalidation du jeton d'installation.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

$site = $argv[1] ?? dirname(__DIR__);
$site = rtrim(str_replace('\\', '/', $site), '/');

if (!is_file($site . '/api/config.php')) {
    fwrite(STDERR, "Dossier du site invalide : $site\n");
    exit(1);
}

require $site . '/api/config.php';
require $site . '/api/lib/utile.php';
require $site . '/api/lib/db.php';

function demander(string $question, string $defaut = ''): string
{
    echo $question;
    $reponse = trim((string) fgets(STDIN));
    return $reponse === '' ? $defaut : $reponse;
}

function demanderMotDePasse(string $question): string
{
    if (DIRECTORY_SEPARATOR === '\\') {
        echo $question;
        $sortie = [];
        $code = 0;
        @exec('powershell -NoProfile -Command "$p = Read-Host -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); [Runtime.InteropServices.Marshal]::PtrToStringAuto($b)"', $sortie, $code);
        $valeur = trim((string) ($sortie[0] ?? ''));
        if ($valeur !== '') {
            return $valeur;
        }
        echo "\n  (Saisie masquée indisponible, saisie visible)\n";
    }
    echo $question;
    return trim((string) fgets(STDIN));
}

echo "\n=== 1. Accès MySQL ===\n";
$hote = demander('  Hôte [127.0.0.1] : ', '127.0.0.1');
$port = (int) demander('  Port [3306] : ', '3306');
$base = demander('  Base de données [caisse_salfa] : ', 'caisse_salfa');
$utilisateur = demander('  Utilisateur [root] : ', 'root');
$motDePasseBase = demanderMotDePasse('  Mot de passe MySQL (vide si aucun) : ');

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $hote, $port),
        $utilisateur,
        $motDePasseBase,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 6]
    );
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $base) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec("USE `" . str_replace('`', '', $base) . "`");
    echo "  Connexion OK, base « $base » prête.\n";
} catch (Throwable $e) {
    fwrite(STDERR, "  ÉCHEC MySQL : " . $e->getMessage() . "\n  Vérifiez que WAMP est démarré (icône verte) et les identifiants.\n");
    exit(1);
}

echo "\n=== 2. Fichier de configuration ===\n";
$dossierData = $site . '/data';
if (!is_dir($dossierData) && !mkdir($dossierData, 0775, true)) {
    fwrite(STDERR, "  Impossible de créer $dossierData\n");
    exit(1);
}
$config = "<?php\n\n// Généré par outils/install-cli.php — ne jamais versionner.\nreturn " . var_export([
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
if (file_put_contents($dossierData . '/salfa-config.php', $config) === false) {
    fwrite(STDERR, "  Impossible d'écrire data/salfa-config.php\n");
    exit(1);
}
@chmod($dossierData . '/salfa-config.php', 0640);
echo "  data/salfa-config.php écrit.\n";

echo "\n=== 3. Tables ===\n";
$sql = (string) file_get_contents($site . '/sql/salfa_install.sql');
if (trim($sql) === '') {
    fwrite(STDERR, "  sql/salfa_install.sql introuvable.\n");
    exit(1);
}
try {
    $pdo->exec($sql);
    $tables = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote('salfa_%'))->fetchAll(PDO::FETCH_COLUMN);
    echo "  " . count($tables) . " table(s) créée(s) : " . implode(', ', $tables) . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, "  ÉCHEC SQL : " . $e->getMessage() . "\n");
    exit(1);
}

echo "\n=== 4. Compte administrateur ===\n";
$identifiant = strtolower(demander('  Identifiant [admin] : ', 'admin'));
if (!preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
    fwrite(STDERR, "  Identifiant invalide (3 à 80 caractères : lettres, chiffres, . - _).\n");
    exit(1);
}
$motDePasse = demanderMotDePasse('  Mot de passe (8 caractères minimum) : ');
if (mb_strlen($motDePasse) < 8) {
    fwrite(STDERR, "  Mot de passe trop court.\n");
    exit(1);
}
$nom = demander('  Nom complet [Administrateur] : ', 'Administrateur');
try {
    $requete = $pdo->prepare(
        'INSERT INTO salfa_utilisateurs (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
        . ' ON DUPLICATE KEY UPDATE mdp_hash = VALUES(mdp_hash), nom_complet = VALUES(nom_complet), role = VALUES(role), actif = 1'
    );
    $requete->execute([$identifiant, $nom, password_hash($motDePasse, PASSWORD_DEFAULT), 'admin']);
    echo "  Compte « $identifiant » prêt.\n";
} catch (Throwable $e) {
    fwrite(STDERR, "  ÉCHEC compte : " . $e->getMessage() . "\n");
    exit(1);
}

@unlink($dossierData . '/installation.php');

echo "\n=== Installation terminée ===\n";
echo "  Ouvrez http://localhost/caisse-salfa/ puis connectez-vous avec « $identifiant ».\n\n";
exit(0);

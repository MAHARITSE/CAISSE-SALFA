<?php
/**
 * Diagnostic en ligne de commande (appelé par outils\verifier.bat).
 *
 *   php outils/verifier-cli.php [dossier-du-site]
 *
 * Contrôle PHP, extensions, configuration, connexion MySQL, tables, compte
 * administrateur et présence des fichiers du site. Sortie lisible, code 1 en cas de problème.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

$site = rtrim(str_replace('\\', '/', $argv[1] ?? dirname(__DIR__)), '/');
$erreurs = 0;

function ligne(string $nom, bool $ok, string $detail): void
{
    echo ($ok ? '  [OK]     ' : '  [ÉCHEC]  ') . str_pad($nom, 32) . $detail . "\n";
}

function controler(string $nom, bool $ok, string $detail): void
{
    global $erreurs;
    ligne($nom, $ok, $detail);
    if (!$ok) {
        $erreurs++;
    }
}

echo "=== CAISSE SALFA — vérification ===\n";
echo "  Dossier : $site\n\n";

echo "Environnement\n";
controler('PHP', version_compare(PHP_VERSION, '8.1', '>='), PHP_VERSION);
controler('PDO MySQL', extension_loaded('pdo_mysql'), extension_loaded('pdo_mysql') ? 'disponible' : 'absent — activer php_pdo_mysql');
controler('mbstring', extension_loaded('mbstring'), extension_loaded('mbstring') ? 'disponible' : 'absent — activer php_mbstring');
controler('json', extension_loaded('json'), extension_loaded('json') ? 'disponible' : 'absent');

echo "\nFichiers du site\n";
foreach ([
    'index.html' => 'page d\'accueil',
    'api/index.php' => 'aiguillage de l\'API',
    'api/socle.php' => 'socle commun',
    'api/points/livre.php' => 'lecture du livre',
    'api/points/cloture.php' => 'clôture',
    'api/lib/db.php' => 'accès MySQL',
    'sql/salfa_install.sql' => 'schéma',
    'data' => 'dossier de travail',
] as $fichier => $libelle) {
    controler($fichier, file_exists($site . '/' . $fichier), $libelle);
}

echo "\nBase de données\n";
$configFichier = $site . '/data/salfa-config.php';
if (!is_file($configFichier)) {
    controler('data/salfa-config.php', false, 'absent — lancez outils\\installer.bat');
} else {
    controler('data/salfa-config.php', true, 'présent');
    $config = require $configFichier;
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['hote'], (int) $config['port'], $config['base']),
            (string) $config['utilisateur'],
            (string) $config['mot_de_passe'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 6]
        );
        controler('connexion MySQL', true, 'base « ' . $config['base'] . ' » sur ' . $config['hote']);
        $tables = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote('salfa_%'))->fetchAll(PDO::FETCH_COLUMN);
        controler('tables', count($tables) >= 14, count($tables) . ' table(s) : ' . implode(', ', $tables));
        $admin = (int) $pdo->query("SELECT COUNT(*) FROM salfa_utilisateurs WHERE role = 'admin' AND actif = 1")->fetchColumn();
        controler('compte administrateur', $admin > 0, $admin > 0 ? $admin . ' actif(s)' : 'aucun — lancez outils\\creer-admin.bat');
        $livre = $pdo->query('SELECT revision FROM salfa_livre WHERE id = 1')->fetchColumn();
        controler('livre', $livre !== false, 'révision ' . (int) $livre);
    } catch (Throwable $e) {
        controler('connexion MySQL', false, $e->getMessage());
    }
}

echo "\n";
if ($erreurs > 0) {
    echo "$erreurs problème(s) à corriger.\n";
    exit(1);
}
echo "Installation correcte : ouvrez http://localhost/caisse-salfa/\n";
exit(0);

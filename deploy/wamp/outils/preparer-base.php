<?php
/**
 * Crée la structure et les données de départ dans la base configurée
 * (appelé par installer.bat, sans phpMyAdmin).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

$deploy = dirname(__DIR__);
$fichiersConfig = [$deploy . '/api/salfa-config.php'];
$wamp = getenv('WAMP') ?: (is_dir('C:/wamp64/www') ? 'C:/wamp64' : 'C:/wamp');
if (is_file($wamp . '/www/caisse-salfa/api/salfa-config.php')) {
    $fichiersConfig[] = $wamp . '/www/caisse-salfa/api/salfa-config.php';
}
$config = null;
foreach ($fichiersConfig as $fichier) {
    if (is_file($fichier)) {
        $config = require $fichier;
        break;
    }
}
if (!is_array($config)) {
    fwrite(STDERR, "api/salfa-config.php introuvable : lancez d'abord l'assistant de configuration.\n");
    exit(1);
}

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['hote'], (int) $config['port'], $config['base']),
        (string) $config['utilisateur'],
        (string) $config['mot_de_passe'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
    );
    $sql = (string) file_get_contents($deploy . '/sql/salfa_install.sql');
    if ($sql === '') {
        fwrite(STDERR, "sql/salfa_install.sql introuvable.\n");
        exit(1);
    }
    $pdo->exec($sql);
    $tables = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote((string) $config['prefixe'] . '%'))->fetchAll(PDO::FETCH_COLUMN);
    echo '  Base prete : ' . implode(', ', $tables) . "\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, '  Echec de la creation des tables : ' . $e->getMessage() . "\n");
    exit(1);
}

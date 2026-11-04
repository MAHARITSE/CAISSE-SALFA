<?php
/**
 * Restauration d'un dump MySQL (appelé par outils\importer-sauvegarde.bat).
 *
 *   php outils/importer-cli.php <dossier-site> <mysql.exe> <fichier.sql>
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

[$script, $site, $mysql, $fichier] = array_pad($argv, 4, '');
if ($site === '' || $mysql === '' || $fichier === '' || !is_file($fichier)) {
    fwrite(STDERR, "Usage : php importer-cli.php <dossier-site> <mysql.exe> <fichier.sql>\n");
    exit(1);
}
$fichierConfig = rtrim($site, '/\\') . '/data/salfa-config.php';
if (!is_file($fichierConfig)) {
    fwrite(STDERR, "  data/salfa-config.php absent.\n");
    exit(1);
}
$config = require $fichierConfig;

$commande = sprintf(
    '"%s" -h "%s" -P %d -u "%s" --default-character-set=utf8mb4 "%s" < "%s"',
    $mysql,
    (string) $config['hote'],
    (int) $config['port'],
    (string) $config['utilisateur'],
    (string) $config['base'],
    $fichier
);
putenv('MYSQL_PWD=' . (string) $config['mot_de_passe']);
passthru($commande, $code);
if ($code !== 0) {
    fwrite(STDERR, "  Echec de la restauration (code $code).\n");
    exit(1);
}
echo "  Base restauree depuis $fichier\n";
exit(0);

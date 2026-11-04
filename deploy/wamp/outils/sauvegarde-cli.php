<?php
/**
 * Dump MySQL en ligne de commande (appelé par outils\sauvegarder.bat).
 *
 *   php outils/sauvegarde-cli.php <dossier-site> <mysqldump.exe> <fichier-sortie>
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Script réservé à la ligne de commande.\n");
}

[$script, $site, $dump, $sortie] = array_pad($argv, 4, '');
if ($site === '' || $dump === '' || $sortie === '') {
    fwrite(STDERR, "Usage : php sauvegarde-cli.php <dossier-site> <mysqldump.exe> <fichier-sortie>\n");
    exit(1);
}
$fichierConfig = rtrim($site, '/\\') . '/data/salfa-config.php';
if (!is_file($fichierConfig)) {
    fwrite(STDERR, "  data/salfa-config.php absent : lancez d'abord outils\\installer.bat\n");
    exit(1);
}
$config = require $fichierConfig;
$dossier = dirname($sortie);
if (!is_dir($dossier) && !mkdir($dossier, 0775, true)) {
    fwrite(STDERR, "  Impossible de créer $dossier\n");
    exit(1);
}

$arguments = [
    $dump,
    '-h', (string) $config['hote'],
    '-P', (string) $config['port'],
    '-u', (string) $config['utilisateur'],
    '--single-transaction',
    '--default-character-set=utf8mb4',
    '--result-file=' . $sortie,
    (string) $config['base'],
];
$commande = '';
foreach ($arguments as $argument) {
    $commande .= '"' . str_replace('"', '\\"', $argument) . '" ';
}
// Le mot de passe passe par l'environnement, jamais sur la ligne de commande.
putenv('MYSQL_PWD=' . (string) $config['mot_de_passe']);
passthru($commande, $code);
if ($code !== 0 || !is_file($sortie) || filesize($sortie) === 0) {
    fwrite(STDERR, "  Echec de mysqldump (code $code).\n");
    exit(1);
}
echo '  ' . number_format((float) filesize($sortie) / 1024, 1) . " Ko ecrits.\n";
exit(0);

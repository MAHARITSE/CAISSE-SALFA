<?php
/**
 * Assistant de configuration MySQL (appelé par installer.bat).
 * Demande les accès, teste la connexion puis écrit api/salfa-config.php
 * dans le dossier WAMP et dans le dossier de déploiement.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Assistant réservé à la ligne de commande.\n");
}

function demander(string $question, string $defaut = ''): string
{
    echo $question;
    $reponse = trim((string) fgets(STDIN));
    return $reponse === '' ? $defaut : $reponse;
}

$deploy = dirname(__DIR__);
$cibles = [$deploy . '/api/salfa-config.php'];
$wamp = getenv('WAMP') ?: (is_dir('C:/wamp64/www') ? 'C:/wamp64' : 'C:/wamp');
if (is_dir($wamp . '/www/caisse-salfa/api')) {
    $cibles[] = $wamp . '/www/caisse-salfa/api/salfa-config.php';
}

echo "  Configuration MySQL (compte WAMP, souvent root sans mot de passe)\n";
$hote = demander('  Hote [127.0.0.1] : ', '127.0.0.1');
$port = demander('  Port [3306] : ', '3306');
$base = demander('  Base de donnees [caisse_salfa] : ', 'caisse_salfa');
$utilisateur = demander('  Utilisateur [root] : ', 'root');
echo '  Mot de passe MySQL (invisible) : ';
$motDePasse = function_exists('shell_exec') && DIRECTORY_SEPARATOR === '\\'
    ? trim((string) shell_exec('powershell -NoProfile -Command "$p = Read-Host -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); [Runtime.InteropServices.Marshal]::PtrToStringAuto($b)"'))
    : trim((string) fgets(STDIN));

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $hote, (int) $port),
        $utilisateur,
        $motDePasse,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
    );
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $base) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    echo "  Connexion OK, base « $base » prete.\n";
} catch (Throwable $e) {
    fwrite(STDERR, '  Connexion MySQL impossible : ' . $e->getMessage() . "\n");
    exit(1);
}

$sel = bin2hex(random_bytes(16));
$contenu = "<?php\n\n// Généré par outils/configurer-base.php — ne pas versionner.\nreturn " . var_export([
    'hote' => $hote,
    'port' => (int) $port,
    'base' => $base,
    'utilisateur' => $utilisateur,
    'mot_de_passe' => $motDePasse,
    'prefixe' => 'salfa_',
    'prefixe_session' => 'salfa_session_',
    'mode_session' => 'mixte',
    'sel_session' => $sel,
    'debug' => false,
    'limite_requetes' => 60,
    'fenetre_requetes' => 60,
    'timezone' => 'Indian/Antananarivo',
], true) . ";\n";

foreach ($cibles as $cible) {
    if (!is_dir(dirname($cible))) {
        continue;
    }
    if (file_put_contents($cible, $contenu) === false) {
        fwrite(STDERR, "  Impossible d'ecrire $cible\n");
        exit(1);
    }
    // Le fichier contient un mot de passe : accès restreint.
    @chmod($cible, 0640);
}
echo "  Configuration ecrite dans api/salfa-config.php\n";
exit(0);

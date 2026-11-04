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
if (!is_file($site . '/data/salfa-config.php')) {
    fwrite(STDERR, "  data/salfa-config.php absent : lancez d'abord outils\\installer.bat\n");
    exit(1);
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

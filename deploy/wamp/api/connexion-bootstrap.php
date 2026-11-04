<?php
/**
 * Outil en ligne de commande : création du premier compte administrateur.
 * Utilisé par outils/installer.bat. Ne jamais exposer ce fichier sur le web
 * (le .htaccess le bloque, il est aussi supprimable après installation).
 *
 * Usage : php api/connexion-bootstrap.php <identifiant> <mot_de_passe> "<nom complet>"
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Ce script s’exécute uniquement en ligne de commande.\n");
}

require __DIR__ . '/config.php';
require __DIR__ . '/lib/utile.php';
require __DIR__ . '/lib/db.php';

$identifiant = isset($argv[1]) ? mb_strtolower(trim((string) $argv[1])) : '';
$motDePasse = isset($argv[2]) ? (string) $argv[2] : '';
$nom = isset($argv[3]) ? trim((string) $argv[3]) : 'Administrateur';

if ($identifiant === '' || $motDePasse === '') {
    fwrite(STDERR, "Usage : php api/connexion-bootstrap.php <identifiant> <mot_de_passe> \"<nom complet>\"\n");
    exit(1);
}
if (!preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
    fwrite(STDERR, "Identifiant invalide : 3 à 80 caractères (lettres, chiffres, point, tiret, souligné).\n");
    exit(1);
}
if (mb_strlen($motDePasse) < 8) {
    fwrite(STDERR, "Mot de passe trop court : 8 caractères minimum.\n");
    exit(1);
}

try {
    $hash = password_hash($motDePasse, PASSWORD_DEFAULT);
    salfa_executer(
        'INSERT INTO ' . salfa_table('utilisateurs') . ' (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
        . ' ON DUPLICATE KEY UPDATE mdp_hash = VALUES(mdp_hash), nom_complet = VALUES(nom_complet), role = VALUES(role), actif = 1',
        [$identifiant, $nom === '' ? 'Administrateur' : $nom, $hash, 'admin']
    );
    echo "Compte administrateur prêt : $identifiant\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Échec : ' . $e->getMessage() . "\n");
    exit(1);
}

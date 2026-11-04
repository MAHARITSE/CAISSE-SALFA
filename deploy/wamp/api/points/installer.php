<?php
/**
 * POST api/installer.php — création des tables et du compte administrateur.
 *
 * Corps JSON : { "secret": "…", "admin": "…", "motDePasse": "…", "nom": "…" }
 *
 * Le secret est généré par outils/installer.bat et écrit dans api/installation.php.
 * Sans ce secret, l'installation est refusée : personne ne peut créer un compte
 * administrateur depuis un navigateur sans être sur le serveur.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_point('installer', function (): array {
    salfa_exiger_methode('POST');
    $corps = salfa_corps();

    if (!is_file(__DIR__ . '/../installation.php')) {
        throw new SalFaErreur(
            'Aucun jeton d’installation : lancez outils\installer.bat, qui crée api\installation.php.',
            403,
            'installation_verrouillee'
        );
    }
    $jeton = require __DIR__ . '/../installation.php';
    $secret = is_array($jeton) ? (string) ($jeton['secret'] ?? '') : '';
    if ($secret === '' || !hash_equals($secret, (string) ($corps['secret'] ?? ''))) {
        throw new SalFaErreur('Jeton d’installation invalide.', 403, 'jeton_invalide');
    }

    // 1. Structure de la base (script réexécutable).
    $sql = (string) file_get_contents(__DIR__ . '/../../sql/salfa_install.sql');
    if (trim($sql) === '') {
        throw new SalFaErreur('sql/salfa_install.sql introuvable dans le paquet.', 500, 'sql_absent');
    }
    salfa_pdo()->exec($sql);

    // 2. Compte administrateur.
    $identifiant = mb_strtolower(trim((string) ($corps['admin'] ?? 'admin')));
    $motDePasse = (string) ($corps['motDePasse'] ?? '');
    $nom = trim((string) ($corps['nom'] ?? 'Administrateur')) ?: 'Administrateur';
    if (!preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
        throw new SalFaErreur('Identifiant invalide : 3 à 80 caractères (lettres, chiffres, point, tiret, souligné).', 400, 'identifiant_invalide');
    }
    if (mb_strlen($motDePasse) < SALFA_LONGUEUR_MDP) {
        throw new SalFaErreur('Le mot de passe doit contenir au moins ' . SALFA_LONGUEUR_MDP . ' caractères.', 400, 'mdp_court');
    }
    salfa_executer(
        'INSERT INTO ' . salfa_table('utilisateurs') . ' (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, 1)'
            . ' ON DUPLICATE KEY UPDATE mdp_hash = VALUES(mdp_hash), nom_complet = VALUES(nom_complet), role = VALUES(role), actif = 1',
        [$identifiant, $nom, password_hash($motDePasse, PASSWORD_DEFAULT), 'admin']
    );

    // 3. Le jeton ne sert qu'une fois : il est invalidé après succès.
    @unlink(__DIR__ . '/../installation.php');

    $tables = salfa_pdo()->query('SHOW TABLES LIKE ' . salfa_pdo()->quote(salfa_prefixe() . '%'))->fetchAll(PDO::FETCH_COLUMN);
    return [
        'ok' => true,
        'message' => 'Base prête et compte administrateur « ' . $identifiant . ' » créé.',
        'tables' => count($tables),
        'identifiant' => $identifiant,
    ];
});

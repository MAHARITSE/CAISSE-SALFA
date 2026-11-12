<?php
/** Messages privés : les comptes, auteurs et destinataires sont déterminés côté serveur. */
declare(strict_types=1);
require_once __DIR__ . '/../socle.php';
salfa_point('messages', function (): array {
    salfa_demarrer_session();
    $user = salfa_utilisateur_courant();
    $uid = (int) $user['id'];
    $pdo = salfa_pdo();
    $table = salfa_table('messages_prives');
    $pdo->exec("CREATE TABLE IF NOT EXISTS $table (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, auteur_id INT NOT NULL, destinataire_id INT NOT NULL, auteur_nom VARCHAR(191) NOT NULL, destinataire_nom VARCHAR(191) NOT NULL, contenu TEXT NOT NULL, cree_le VARCHAR(32) NOT NULL, lu_le VARCHAR(32) NULL, INDEX (auteur_id), INDEX (destinataire_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // La présence doit aussi fonctionner avec la configuration par défaut « mixte ».
    // Une ligne par session permet à plusieurs navigateurs d'un même compte
    // de rester visibles ; seules les activités récentes sont prises en compte.
    $presences = salfa_table('messages_presences');
    $pdo->exec("CREATE TABLE IF NOT EXISTS $presences (session_hash CHAR(64) NOT NULL PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, expire_le DATETIME(3) NOT NULL, INDEX (utilisateur_id, expire_le)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    salfa_executer("INSERT INTO $presences (session_hash, utilisateur_id, expire_le) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 60 SECOND)) ON DUPLICATE KEY UPDATE utilisateur_id = VALUES(utilisateur_id), expire_le = VALUES(expire_le)", [hash('sha256', session_id()), $uid]);
    salfa_executer("DELETE FROM $presences WHERE expire_le < NOW(3)");
    $suppressions = salfa_table('messages_suppressions');
    $pdo->exec("CREATE TABLE IF NOT EXISTS $suppressions (message_id INT UNSIGNED NOT NULL, utilisateur_id INT UNSIGNED NOT NULL, PRIMARY KEY (message_id, utilisateur_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $corps = salfa_corps();
        if (($corps['operation'] ?? '') === 'envoyer') {
            $dest = filter_var($corps['destinataireId'] ?? null, FILTER_VALIDATE_INT);
            $contenu = trim((string) ($corps['contenu'] ?? ''));
            if (!$dest || $dest === $uid || $contenu === '' || mb_strlen($contenu) > 2000) throw new SalFaErreur('Destinataire ou message invalide (2000 caractères maximum).', 400, 'message_invalide');
            $compte = salfa_executer('SELECT nom_complet FROM ' . salfa_table('utilisateurs') . ' WHERE id = ? AND actif = 1', [$dest])->fetch();
            if (!$compte) throw new SalFaErreur('Destinataire introuvable ou désactivé.', 404, 'destinataire_absent');
            salfa_executer("INSERT INTO $table (auteur_id, destinataire_id, auteur_nom, destinataire_nom, contenu, cree_le) VALUES (?, ?, ?, ?, ?, ?)", [$uid, $dest, $user['nomComplet'], $compte['nom_complet'], $contenu, gmdate('c')]);
        } elseif (($corps['operation'] ?? '') === 'lire') {
            $id = filter_var($corps['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id || $id < 1) throw new SalFaErreur('Message invalide.', 400, 'message_invalide');
            salfa_executer("UPDATE $table SET lu_le = ? WHERE id = ? AND destinataire_id = ? AND lu_le IS NULL", [gmdate('c'), $id, $uid]);
        } elseif (($corps['operation'] ?? '') === 'supprimer') {
            $id = filter_var($corps['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id || $id < 1) throw new SalFaErreur('Message invalide.', 400, 'message_invalide');
            salfa_executer("INSERT IGNORE INTO $suppressions (message_id, utilisateur_id) SELECT id, ? FROM $table WHERE id = ? AND (auteur_id = ? OR destinataire_id = ?)", [$uid, $id, $uid, $uid]);
        } elseif (($corps['operation'] ?? '') === 'supprimer_conversation') {
            $dest = filter_var($corps['correspondantId'] ?? null, FILTER_VALIDATE_INT);
            if (!$dest || $dest < 1 || $dest === $uid) throw new SalFaErreur('Correspondant invalide.', 400, 'message_invalide');
            salfa_executer("INSERT IGNORE INTO $suppressions (message_id, utilisateur_id) SELECT id, ? FROM $table WHERE (auteur_id = ? AND destinataire_id = ?) OR (auteur_id = ? AND destinataire_id = ?)", [$uid, $uid, $dest, $dest, $uid]);
        } else throw new SalFaErreur('Action inconnue.', 400, 'action_inconnue');
    } else salfa_exiger_methode('GET');
    $presence = 'EXISTS (SELECT 1 FROM ' . $presences . ' p WHERE p.utilisateur_id = u.id AND p.expire_le > NOW(3))';
    $comptes = salfa_executer('SELECT u.id, u.nom_complet AS nomComplet, u.identifiant, u.role, ' . $presence . ' AS enLigne FROM ' . salfa_table('utilisateurs') . ' u WHERE u.actif = 1 AND u.id <> ? ORDER BY u.nom_complet', [$uid])->fetchAll();
    $messages = salfa_executer("SELECT id, auteur_id AS auteurId, destinataire_id AS destinataireId, auteur_nom AS auteurNom, destinataire_nom AS destinataireNom, contenu, cree_le AS creeLe, lu_le AS luLe FROM $table m WHERE (auteur_id = ? OR destinataire_id = ?) AND NOT EXISTS (SELECT 1 FROM $suppressions x WHERE x.message_id = m.id AND x.utilisateur_id = ?) ORDER BY id DESC", [$uid, $uid, $uid])->fetchAll();
    return ['ok' => true, 'comptes' => $comptes, 'messages' => $messages];
});

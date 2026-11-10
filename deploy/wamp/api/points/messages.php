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
        } else throw new SalFaErreur('Action inconnue.', 400, 'action_inconnue');
    } else salfa_exiger_methode('GET');
    $comptes = salfa_executer('SELECT id, nom_complet AS nomComplet, identifiant FROM ' . salfa_table('utilisateurs') . ' WHERE actif = 1 AND id <> ? ORDER BY nom_complet', [$uid])->fetchAll();
    $messages = salfa_executer("SELECT id, auteur_id AS auteurId, destinataire_id AS destinataireId, auteur_nom AS auteurNom, destinataire_nom AS destinataireNom, contenu, cree_le AS creeLe, lu_le AS luLe FROM $table WHERE auteur_id = ? OR destinataire_id = ? ORDER BY id DESC", [$uid, $uid])->fetchAll();
    return ['ok' => true, 'comptes' => $comptes, 'messages' => $messages];
});

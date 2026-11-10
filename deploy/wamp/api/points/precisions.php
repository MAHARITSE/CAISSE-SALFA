<?php
/** Demandes de précision partagées entre administrateurs et caissiers. */
declare(strict_types=1);
require_once __DIR__ . '/../socle.php';
salfa_point('precisions', function (): array {
    salfa_demarrer_session();
    $utilisateur = salfa_exiger_role('caissier');
    $pdo = salfa_pdo();
    $table = salfa_table('demandes_precision');
    $pdo->exec("CREATE TABLE IF NOT EXISTS $table (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, ecriture_id VARCHAR(191) NOT NULL, numero VARCHAR(191) NOT NULL, message TEXT NOT NULL, auteur VARCHAR(191) NOT NULL, cree_le VARCHAR(32) NOT NULL, complete_le VARCHAR(32) NULL, complete_par VARCHAR(191) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $corps = salfa_corps();
        $action = $corps['operation'] ?? '';
        if ($action === 'creer') {
            salfa_exiger_role('admin');
            $id = trim((string) ($corps['ecritureId'] ?? ''));
            $message = trim((string) ($corps['message'] ?? ''));
            if ($id === '' || $message === '' || mb_strlen($message) > 1000) throw new SalFaErreur('La demande doit contenir entre 1 et 1000 caractères.', 400, 'demande_invalide');
            $ecriture = null;
            foreach (salfa_charger_livre()['ecritures'] as $e) if ($e['id'] === $id) { $ecriture = $e; break; }
            if (!$ecriture) throw new SalFaErreur('Écriture active introuvable.', 404, 'ecriture_absente');
            salfa_executer("INSERT INTO $table (ecriture_id, numero, message, auteur, cree_le) VALUES (?, ?, ?, ?, ?)", [$id, $ecriture['numero'], $message, $utilisateur['nomComplet'], gmdate('c')]);
        } elseif ($action === 'completer') {
            $id = filter_var($corps['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id || $id < 1) throw new SalFaErreur('Demande invalide.', 400, 'demande_invalide');
            $stmt = salfa_executer("UPDATE $table SET complete_le = ?, complete_par = ? WHERE id = ? AND complete_le IS NULL", [gmdate('c'), $utilisateur['nomComplet'], $id]);
            if (!$stmt->rowCount()) throw new SalFaErreur('Demande introuvable ou déjà complétée.', 404, 'demande_absente');
        } else throw new SalFaErreur('Action inconnue.', 400, 'action_inconnue');
    } else salfa_exiger_methode('GET');
    $rows = $pdo->query("SELECT id, ecriture_id AS ecritureId, numero, message, auteur, cree_le AS creeLe, complete_le AS completeLe, complete_par AS completePar FROM $table ORDER BY id DESC")->fetchAll();
    return ['ok' => true, 'demandes' => $rows];
});

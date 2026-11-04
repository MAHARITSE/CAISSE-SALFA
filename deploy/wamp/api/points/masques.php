<?php
/**
 * POST api/masques.php — { revision, masques } remplace tous les modèles de saisie.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_point('masques', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('admin', 'masques', function (array $corps): string {
        $masques = $corps['masques'] ?? null;
        if (!is_array($masques)) {
            throw new SalFaErreur('Liste de modèles attendue.', 400, 'masques_invalides');
        }
        salfa_enregistrer_masques($masques);
        return (string) count($masques);
    });
});

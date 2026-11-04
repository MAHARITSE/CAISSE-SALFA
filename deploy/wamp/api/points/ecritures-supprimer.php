<?php
/**
 * POST api/ecritures-supprimer.php — { revision, id }
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('ecritures-supprimer', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('caissier', 'suppression', function (array $corps): string {
        $id = salfa_champ($corps, 'id', 120);
        salfa_supprimer_ecriture($id);
        return $id;
    });
});

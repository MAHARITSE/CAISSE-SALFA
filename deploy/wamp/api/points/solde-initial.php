<?php
/**
 * POST api/solde-initial.php — { revision, soldeInitial } (administrateur).
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_point('solde-initial', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('admin', 'solde_initial', function (array $corps): string {
        $solde = salfa_entier($corps, 'soldeInitial', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);
        salfa_executer('UPDATE ' . salfa_table('parametres') . ' SET solde_initial = ? WHERE id = 1', [$solde]);
        salfa_incrementer_revision();
        return (string) $solde;
    });
});

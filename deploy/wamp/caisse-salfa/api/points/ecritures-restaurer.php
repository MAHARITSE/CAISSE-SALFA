<?php
/**
 * POST api/ecritures-restaurer.php — { revision, ecriture }
 * Annule la dernière suppression : la pièce reprend son numéro d'origine.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('ecritures-restaurer', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('caissier', 'restauration', function (array $corps): string {
        salfa_restaurer_ecriture(salfa_objet($corps, 'ecriture'));
        return 'restauration';
    });
});

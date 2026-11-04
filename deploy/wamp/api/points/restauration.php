<?php
/**
 * POST api/restauration.php — { sauvegarde } (administrateur).
 * Le fichier est entièrement validé avant la moindre suppression.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('restauration', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    salfa_exiger_role('admin');
    salfa_restaurer_sauvegarde(salfa_corps());
    salfa_journaliser('restauration_sauvegarde', null, 'succes');
    return ['ok' => true, 'livre' => salfa_charger_livre()];
});

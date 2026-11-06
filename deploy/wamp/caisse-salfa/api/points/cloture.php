<?php
/**
 * POST api/cloture.php — { revision, archive } (administrateur).
 * La clôture n'est acceptée qu'à partir du 1er janvier suivant l'exercice.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('cloture', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    salfa_exiger_role('admin');
    salfa_cloturer(salfa_corps());
    salfa_journaliser('cloture', null, 'succes');
    return ['ok' => true, 'livre' => salfa_charger_livre()];
});

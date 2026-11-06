<?php
/**
 * GET api/session.php — état de la session courante (public).
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_point('session', function (): array {
    salfa_exiger_methode('GET');
    salfa_demarrer_session();
    return salfa_etat_session();
});

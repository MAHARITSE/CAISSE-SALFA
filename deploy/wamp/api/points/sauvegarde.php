<?php
/**
 * GET api/sauvegarde.php — export JSON complet du livre (toute personne connectée).
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('sauvegarde', function (): array {
    salfa_exiger_methode('GET');
    salfa_demarrer_session();
    salfa_exiger_role('lecteur');
    return ['ok' => true, 'sauvegarde' => salfa_charger_livre(), 'exportedAt' => gmdate('c')];
});

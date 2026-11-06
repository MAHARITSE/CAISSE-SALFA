<?php
/**
 * GET api/sante.php — contrôle de disponibilité de la base (public).
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('sante', function (): array {
    salfa_exiger_methode('GET');
    $livre = salfa_charger_livre();
    return [
        'ok' => true,
        'application' => 'CAISSE SALFA',
        'versionApi' => SALFA_VERSION_API,
        'php' => PHP_VERSION,
        'base' => 'connectee',
        'revision' => $livre['revision'],
        'exercice' => $livre['parametres']['exercice'],
    ];
});

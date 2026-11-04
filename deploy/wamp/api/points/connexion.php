<?php
/**
 * POST api/connexion.php — { identifiant, motDePasse } (public).
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('connexion', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_connecter(salfa_corps());
});

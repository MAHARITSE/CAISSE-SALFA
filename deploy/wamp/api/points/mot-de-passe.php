<?php
/**
 * POST api/mot-de-passe.php — { motDePasseActuel, motDePasse }.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('mot-de-passe', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_changer_mot_de_passe(salfa_corps());
});

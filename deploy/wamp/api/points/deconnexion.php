<?php
/**
 * POST api/deconnexion.php — ferme la session.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('deconnexion', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    $utilisateur = salfa_utilisateur_courant(false);
    salfa_journaliser('deconnexion', $utilisateur['id'] ?? null, 'succes');
    salfa_fermer_session();
    return ['ok' => true, 'connecte' => false];
});

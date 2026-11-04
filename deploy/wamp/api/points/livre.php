<?php
/**
 * GET api/livre.php — livre complet (écritures, paramètres, modèles, compteurs,
 * exercices clôturés). Toute personne connectée peut le lire.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('livre', function (): array {
    salfa_exiger_methode('GET');
    salfa_demarrer_session();
    salfa_utilisateur_courant();
    return ['ok' => true, 'livre' => salfa_charger_livre()];
});

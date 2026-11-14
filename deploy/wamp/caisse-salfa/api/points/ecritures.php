<?php
/**
 * POST api/ecritures.php — création ou modification d'une écriture.
 * Corps : { revision, ecriture }
 * Le numéro de pièce est attribué par le serveur ; rien n'est réutilisé.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('ecritures', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    $utilisateur = salfa_utilisateur_courant();
    return salfa_mutation('comptable', 'ecriture', function (array $corps) use ($utilisateur): string {
        $resultat = salfa_enregistrer_ecriture(salfa_objet($corps, 'ecriture'), (string) ($utilisateur['role'] ?? ''));
        return (string) $resultat['numero'];
    });
});

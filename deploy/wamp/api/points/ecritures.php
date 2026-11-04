<?php
/**
 * POST api/ecritures.php — création ou modification d'une écriture.
 * Corps : { revision, ecriture }
 * Le numéro de pièce est attribué par le serveur ; rien n'est réutilisé.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_executer_point('ecritures', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('caissier', 'ecriture', function (array $corps): string {
        $resultat = salfa_enregistrer_ecriture(salfa_objet($corps, 'ecriture'));
        return (string) $resultat['numero'];
    });
});

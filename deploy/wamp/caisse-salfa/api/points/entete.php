<?php
/**
 * POST api/entete.php — { revision, document, entete }.
 *
 * Enregistre l'en-tête imprimable d'un seul bordereau :
 *  - « depense » → engagement de dépense ;
 *  - « recette » → autorisation de recette.
 * L'autre document n'est jamais modifié.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('entete', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('admin', 'entete', function (array $corps): string {
        $document = $corps['document'] ?? null;
        if (!is_string($document) || !in_array($document, ['depense', 'recette'], true)) {
            throw new SalFaErreur('Document attendu : « depense » ou « recette ».', 400, 'document_invalide');
        }
        $entete = $corps['entete'] ?? null;
        if (!is_array($entete)) {
            throw new SalFaErreur('En-tête attendu.', 400, 'entete_invalide');
        }
        salfa_enregistrer_entete($document, $entete);
        return $document;
    });
});

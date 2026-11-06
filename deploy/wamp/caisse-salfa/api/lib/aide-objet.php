<?php
/**
 * Petite aide : lit un objet obligatoire du corps JSON.
 */

declare(strict_types=1);

function salfa_objet(array $donnees, string $cle): array
{
    $valeur = $donnees[$cle] ?? null;
    if (!is_array($valeur) || ($valeur !== [] && array_is_list($valeur))) {
        throw new SalFaErreur("L’objet « $cle » est manquant ou invalide.", 400, 'objet_invalide');
    }
    return $valeur;
}

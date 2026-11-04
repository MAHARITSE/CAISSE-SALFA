<?php
/**
 * POST api/categories.php — { revision, sens, categories }.
 *
 * Remplace la liste des catégories d'un seul sens : les recettes et les
 * dépenses gardent chacune la leur. Les écritures déjà enregistrées ne sont
 * jamais modifiées, même si leur catégorie disparaît de la liste.
 */

declare(strict_types=1);

require __DIR__ . '/../socle.php';

salfa_point('categories', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    return salfa_mutation('caissier', 'categories', function (array $corps): string {
        $sens = $corps['sens'] ?? null;
        if (!is_string($sens) || !in_array($sens, ['RECETTE', 'DEPENSE'], true)) {
            throw new SalFaErreur('Sens attendu : « RECETTE » ou « DEPENSE ».', 400, 'sens_invalide');
        }
        $categories = $corps['categories'] ?? null;
        if (!is_array($categories)) {
            throw new SalFaErreur('Liste de catégories attendue.', 400, 'categories_invalides');
        }
        $nombre = salfa_enregistrer_categories($sens, $categories);
        return $sens . ' : ' . $nombre;
    });
});

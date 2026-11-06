<?php
/**
 * Tests de l'API exécutables en ligne de commande, sans MySQL.
 *
 *   php api/tests/test-api.php
 *
 * Couvre la validation métier et les fonctions pures ; les requêtes SQL sont
 * seulement vérifiées à l'exécution par les parcours manuels décrits dans
 * INSTALLATION.md. Aucune dépendance Composer.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Tests réservés à la ligne de commande.\n");
}

require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/utile.php';
require __DIR__ . '/../lib/validation.php';
require __DIR__ . '/../lib/aide-objet.php';
// La connexion PDO n'est ouverte qu'à l'appel : inclure db.php suffit pour
// éprouver les fonctions pures (en-tête et catégories de secours).
require __DIR__ . '/../lib/db.php';

$total = 0;
$echecs = 0;

function verifier(string $nom, callable $test): void
{
    global $total, $echecs;
    $total++;
    try {
        $test();
        echo "  ok   $nom\n";
    } catch (Throwable $e) {
        $echecs++;
        echo "  KO   $nom : " . $e->getMessage() . "\n";
    }
}

function egal(mixed $attendu, mixed $obtenu, string $contexte = ''): void
{
    if ($attendu !== $obtenu) {
        throw new RuntimeException(
            ($contexte ? $contexte . ' — ' : '') . 'attendu ' . var_export($attendu, true) . ', obtenu ' . var_export($obtenu, true)
        );
    }
}

function attendreErreur(callable $action, string $code): void
{
    try {
        $action();
    } catch (SalFaErreur $e) {
        egal($code, $e->codeErreur, 'code d’erreur');
        return;
    }
    throw new RuntimeException("aucune erreur « $code » levée");
}

/** Écriture valide minimale, calquée sur le format de l'application. */
function ecriture(array $modifs = []): array
{
    return array_merge([
        'id' => 'e-' . bin2hex(random_bytes(4)),
        'numero' => 'RC-2025-0001',
        'date' => '2025-03-04',
        'sens' => 'RECETTE',
        'libelle' => 'Recettes du jour',
        'categorie' => 'CONSULTATION',
        'tiers' => '',
        'reference' => 'Q-1',
        'observation' => '',
        'montant' => 25000,
        'createdAt' => '2025-03-04T08:00:00.000Z',
    ], $modifs);
}

echo "Validation des écritures\n";

verifier('accepte une recette cohérente', function () {
    $e = salfa_valider_ecriture(ecriture(), 2025);
    egal(25000, $e['montant']);
    egal('RC-2025-0001', $e['numero']);
    egal(null, $e['lignesDetail']);
});

verifier('refuse une date hors exercice', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture(['date' => '2024-12-31']), 2025), 'hors_exercice');
});

verifier('refuse une date impossible', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture(['date' => '2025-02-30']), 2025), 'date_invalide');
});

verifier('refuse un type inconnu', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture(['sens' => 'VIREMENT']), 2025), 'ecriture_invalide');
});

verifier('refuse un numéro mal formé', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture(['numero' => 'X-1']), 2025), 'numero_invalide');
});

verifier('refuse un montant nul', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture(['montant' => 0]), 2025), 'champ_invalide');
});

verifier('accepte un détail dont la somme correspond', function () {
    $e = salfa_valider_ecriture(ecriture([
        'montant' => 8000,
        'lignesDetail' => [
            ['id' => 'd1', 'libelle' => 'Gasoil', 'montant' => 5000],
            ['id' => 'd2', 'libelle' => 'Entretien', 'montant' => 3000],
        ],
    ]), 2025);
    egal(2, count($e['lignesDetail']));
    egal(1, $e['lignesDetail'][1]['ordre']);
});

verifier('refuse un détail dont la somme diffère', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture([
        'montant' => 8000,
        'lignesDetail' => [['id' => 'd1', 'libelle' => 'Gasoil', 'montant' => 5000]],
    ]), 2025), 'total_incoherent');
});

verifier('refuse des identifiants de poste en double', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture([
        'montant' => 2000,
        'lignesDetail' => [
            ['id' => 'x', 'libelle' => 'A', 'montant' => 1000],
            ['id' => 'x', 'libelle' => 'B', 'montant' => 1000],
        ],
    ]), 2025), 'detail_duplique');
});

verifier('refuse un poste à montant nul', function () {
    attendreErreur(fn () => salfa_valider_ecriture(ecriture([
        'montant' => 1000,
        'lignesDetail' => [['id' => 'd1', 'libelle' => 'Vide', 'montant' => 0]],
    ]), 2025), 'detail_invalide');
});

echo "\nValidation des modèles\n";

verifier('accepte un modèle avec montants par défaut', function () {
    $masques = salfa_valider_masques([[
        'id' => 'm1', 'nom' => 'Recettes hôpital', 'sens' => 'RECETTE',
        'lignes' => [['description' => 'CONSULTATION', 'montantDefaut' => 5000], ['description' => 'SOINS']],
    ]]);
    egal(2, count($masques[0]['lignes']));
    egal(5000, $masques[0]['lignes'][0]['montantDefaut']);
    egal(null, $masques[0]['lignes'][1]['montantDefaut']);
});

verifier('refuse un modèle sans poste', function () {
    attendreErreur(fn () => salfa_valider_masques([['id' => 'm1', 'nom' => 'Vide', 'sens' => 'RECETTE', 'lignes' => []]]), 'masque_invalide');
});

verifier('refuse un identifiant de modèle en double', function () {
    attendreErreur(fn () => salfa_valider_masques([
        ['id' => 'm1', 'nom' => 'A', 'sens' => 'RECETTE', 'lignes' => [['description' => 'X']]],
        ['id' => 'm1', 'nom' => 'B', 'sens' => 'DEPENSE', 'lignes' => [['description' => 'Y']]],
    ]), 'masque_duplique');
});

echo "\nRègles de solde\n";

verifier('accepte un solde cohérent', function () {
    salfa_verifier_solde(100000, 50000, 30000, 120000, 'test');
});

verifier('refuse un solde incohérent', function () {
    attendreErreur(fn () => salfa_verifier_solde(100000, 50000, 30000, 99999, 'test'), 'solde_incoherent');
});

verifier('accepte un solde négatif explicite', function () {
    salfa_verifier_solde(0, 0, 5000, -5000, 'test');
});

echo "\nUtilitaires de requête\n";

verifier('lit un entier textuel', function () {
    egal(42, salfa_entier(['n' => '42'], 'n', 0, 100));
});

verifier('refuse un entier hors bornes', function () {
    attendreErreur(fn () => salfa_entier(['n' => 500], 'n', 0, 100), 'champ_invalide');
});

verifier('nettoie un champ texte', function () {
    egal('abc', salfa_champ(['t' => '  abc  '], 't', 10));
});

verifier('refuse un champ obligatoire vide', function () {
    attendreErreur(fn () => salfa_champ(['t' => '   '], 't', 10), 'champ_manquant');
});

verifier('accepte un champ facultatif vide', function () {
    egal('', salfa_champ(['t' => null], 't', 10, false));
});

verifier('identifie un objet manquant', function () {
    attendreErreur(fn () => salfa_objet(['a' => 1], 'ecriture'), 'objet_invalide');
});

verifier('convertit un horodatage ISO en date MySQL', function () {
    egal('2025-03-04 11:00:00', salfa_mysql_datetime('2025-03-04T08:00:00.000Z', 'Indian/Antananarivo'));
});

verifier('rejette une date ISO illisible', function () {
    try {
        salfa_mysql_datetime('pas une date', 'UTC');
    } catch (Throwable $e) {
        return;
    }
    throw new RuntimeException('aucune exception levée');
});

// --- En-têtes et catégories renvoyés au navigateur ---------------------------
// Une base fraîche n'a ni en-tête enregistré ni catégories semées. Le serveur
// doit alors renvoyer les modèles livrés : sans eux, l'écran casse après la
// connexion (« L'affichage a rencontré un problème »).

verifier('en-tête vide remplacé par le modèle livré', function () {
    $entete = salfa_entetes_ou_defaut([]);
    egal(7, count($entete['lignes']), 'nombre de lignes');
    egal('textes', $entete['mode']);
    egal('centre', $entete['lignes'][0]['alignement']);
    egal('FIANGONANA LOTERANA MALAGASY', $entete['lignes'][0]['texte']);
});

verifier('en-tête complet conservé tel quel', function () {
    $entete = ['mode' => 'image', 'image' => 'data:image/png;base64,AAA', 'lignes' => [['texte' => 'X']], 'images' => []];
    egal('X', salfa_entetes_ou_defaut($entete)['lignes'][0]['texte']);
    egal('image', salfa_entetes_ou_defaut($entete)['mode']);
});

verifier('catégories vides remplacées par les listes de départ', function () {
    $categories = salfa_categories_ou_defaut(['recette' => [], 'depense' => []]);
    egal(10, count($categories['recette']), 'recettes');
    egal(13, count($categories['depense']), 'dépenses');
    egal('Consultations', $categories['recette'][1]);
});

verifier('catégories présentes conservées', function () {
    $categories = salfa_categories_ou_defaut(['recette' => ['A'], 'depense' => ['B']]);
    egal(['A'], $categories['recette']);
    egal(['B'], $categories['depense']);
});

verifier('un seul sens vide complété sans écraser l’autre', function () {
    $categories = salfa_categories_ou_defaut(['recette' => ['A'], 'depense' => []]);
    egal(['A'], $categories['recette']);
    egal(13, count($categories['depense']));
});

echo "\n";
if ($echecs > 0) {
    echo "ÉCHEC : $echecs test(s) sur $total\n";
    exit(1);
}
echo "Succès : $total test(s)\n";
exit(0);

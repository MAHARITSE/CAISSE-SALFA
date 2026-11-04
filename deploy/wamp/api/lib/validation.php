<?php
/**
 * Validation métier côté serveur : mêmes règles que l'application, mais
 * l'API ne fait jamais confiance au navigateur.
 */

declare(strict_types=1);

function salfa_date_valide($valeur): bool
{
    if (!is_string($valeur) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valeur, $m)) {
        return false;
    }
    $annee = (int) $m[1];
    if ($annee < SALFA_ANNEE_MIN || $annee > SALFA_ANNEE_MAX) {
        return false;
    }
    return checkdate((int) $m[2], (int) $m[3], $annee);
}

function salfa_horodatage_valide($valeur): bool
{
    return is_string($valeur) && strlen($valeur) <= 40 && strtotime($valeur) !== false;
}

/** Convertit un horodatage ISO 8601 en DATETIME MySQL (UTC → heure locale du serveur). */
function salfa_mysql_datetime(string $iso, string $fuseau): string
{
    $date = new DateTimeImmutable($iso);
    return $date->setTimezone(new DateTimeZone($fuseau))->format('Y-m-d H:i:s');
}

/**
 * Valide une écriture reçue et renvoie uniquement les champs autorisés.
 *
 * @param array<string, mixed> $e
 * @return array<string, mixed>
 */
function salfa_valider_ecriture(array $e, ?int $exerciceAttendu = null): array
{
    $sens = $e['sens'] ?? null;
    if ($sens !== 'RECETTE' && $sens !== 'DEPENSE') {
        throw new SalFaErreur('Type d’opération invalide.', 400, 'ecriture_invalide');
    }
    $numero = salfa_champ($e, 'numero', 80);
    if (!preg_match('/^(RC|DP)-(\d{4})-\d{4,}$/', $numero)) {
        throw new SalFaErreur('Numéro de pièce invalide (attendu RC-AAAA-0001).', 400, 'numero_invalide');
    }
    $date = $e['date'] ?? null;
    if (!salfa_date_valide($date)) {
        throw new SalFaErreur('Date de l’opération invalide (AAAA-MM-JJ attendu).', 400, 'date_invalide');
    }
    $anneeEcriture = (int) substr((string) $date, 0, 4);
    if ($exerciceAttendu !== null && $anneeEcriture !== $exerciceAttendu) {
        throw new SalFaErreur(
            'La date doit appartenir à l’exercice ' . $exerciceAttendu . ' ouvert. Clôturez l’exercice pour passer à l’année suivante.',
            409,
            'hors_exercice'
        );
    }
    $montant = salfa_entier($e, 'montant', 1, SALFA_MONTANT_MAX);

    $lignes = null;
    if (isset($e['lignesDetail']) && is_array($e['lignesDetail']) && count($e['lignesDetail']) > 0) {
        if (count($e['lignesDetail']) > SALFA_MAX_DETAILS) {
            throw new SalFaErreur('Trop de postes dans le détail (200 maximum).', 400, 'details_trop_nombreux');
        }
        $lignes = [];
        $ids = [];
        foreach ($e['lignesDetail'] as $index => $ligne) {
            if (!is_array($ligne)) {
                throw new SalFaErreur('Poste de détail invalide.', 400, 'detail_invalide');
            }
            $id = salfa_champ($ligne, 'id', 120);
            if (isset($ids[$id])) {
                throw new SalFaErreur('Identifiant de poste en double.', 400, 'detail_duplique');
            }
            $ids[$id] = true;
            $montantLigne = salfa_entier($ligne, 'montant', 0, SALFA_MONTANT_MAX);
            if ($montantLigne <= 0) {
                throw new SalFaErreur('Chaque poste doit avoir un montant supérieur à zéro.', 400, 'detail_invalide');
            }
            $lignes[] = [
                'id' => $id,
                'libelle' => salfa_champ($ligne, 'libelle', 200),
                'reference' => salfa_champ($ligne, 'reference', 200, false),
                'montant' => $montantLigne,
                'ordre' => $index,
            ];
        }
        $total = array_sum(array_column($lignes, 'montant'));
        if ($total !== $montant) {
            throw new SalFaErreur('Le total ne correspond pas à la somme des postes.', 400, 'total_incoherent');
        }
    }

    $creeLe = $e['createdAt'] ?? null;
    if (!salfa_horodatage_valide($creeLe)) {
        throw new SalFaErreur('Date de création invalide.', 400, 'creation_invalide');
    }
    $modifieLe = $e['updatedAt'] ?? null;
    if ($modifieLe !== null && !salfa_horodatage_valide($modifieLe)) {
        throw new SalFaErreur('Date de modification invalide.', 400, 'modification_invalide');
    }

    return [
        'id' => salfa_champ($e, 'id', 120),
        'numero' => $numero,
        'date' => (string) $date,
        'sens' => $sens,
        'libelle' => salfa_champ($e, 'libelle', 200),
        'categorie' => salfa_champ($e, 'categorie', 120),
        'tiers' => salfa_champ($e, 'tiers', 200, false),
        'reference' => salfa_champ($e, 'reference', 200, false),
        'observation' => salfa_champ($e, 'observation', 2000, false),
        'montant' => $montant,
        'lignesDetail' => $lignes,
        'createdAt' => (string) $creeLe,
        'updatedAt' => $modifieLe === null ? null : (string) $modifieLe,
    ];
}

/**
 * Valide une liste de modèles de saisie.
 *
 * @return list<array<string, mixed>>
 */
function salfa_valider_masques(array $masques): array
{
    if (count($masques) > 500) {
        throw new SalFaErreur('Trop de modèles (500 maximum).', 400, 'masques_trop_nombreux');
    }
    $resultat = [];
    $ids = [];
    foreach ($masques as $index => $m) {
        if (!is_array($m)) {
            throw new SalFaErreur('Modèle invalide.', 400, 'masque_invalide');
        }
        $id = salfa_champ($m, 'id', 120);
        if (isset($ids[$id])) {
            throw new SalFaErreur('Identifiant de modèle en double.', 400, 'masque_duplique');
        }
        $ids[$id] = true;
        $sens = $m['sens'] ?? null;
        if ($sens !== 'RECETTE' && $sens !== 'DEPENSE') {
            throw new SalFaErreur('Type du modèle invalide.', 400, 'masque_invalide');
        }
        $lignesBrutes = $m['lignes'] ?? null;
        if (!is_array($lignesBrutes) || count($lignesBrutes) === 0) {
            throw new SalFaErreur('Un modèle doit contenir au moins un poste.', 400, 'masque_invalide');
        }
        if (count($lignesBrutes) > SALFA_MAX_DETAILS) {
            throw new SalFaErreur('Trop de postes dans un modèle (200 maximum).', 400, 'masque_invalide');
        }
        $lignes = [];
        foreach ($lignesBrutes as $ordre => $l) {
            if (!is_array($l)) {
                throw new SalFaErreur('Poste de modèle invalide.', 400, 'masque_invalide');
            }
            $defaut = $l['montantDefaut'] ?? null;
            $lignes[] = [
                'description' => salfa_champ($l, 'description', 200),
                'montantDefaut' => $defaut === null ? null : salfa_entier($l, 'montantDefaut', 0, SALFA_MONTANT_MAX),
                'ordre' => $ordre,
            ];
        }
        $resultat[] = [
            'id' => $id,
            'nom' => salfa_champ($m, 'nom', 120),
            'sens' => $sens,
            'description' => salfa_champ($m, 'description', 500, false),
            'lignes' => $lignes,
            'ordre' => $index,
        ];
    }
    return $resultat;
}

/** Calcule le prochain numéro de pièce sans réutilisation (compteur persistant). */
function salfa_prochain_numero(string $sens, string $date): string
{
    $cle = ($sens === 'RECETTE' ? 'RC' : 'DP') . '-' . substr($date, 0, 4);
    $ligne = salfa_executer('SELECT valeur FROM ' . salfa_table('compteurs') . ' WHERE cle = ? FOR UPDATE', [$cle])->fetch();
    $max = $ligne ? (int) $ligne['valeur'] : 0;
    $prefixe = $cle . '-';
    $existants = salfa_executer(
        'SELECT numero FROM ' . salfa_table('ecritures') . ' WHERE numero LIKE ?',
        [$prefixe . '%']
    )->fetchAll();
    foreach ($existants as $existant) {
        $suffixe = substr((string) $existant['numero'], strlen($prefixe));
        if (preg_match('/^\d+$/', $suffixe)) {
            $max = max($max, (int) $suffixe);
        }
    }
    if ($max >= 1000000000) {
        throw new SalFaErreur('Limite de numérotation atteinte pour cette année.', 409, 'numero_epuise');
    }
    $numero = $prefixe . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    if ($ligne) {
        salfa_executer('UPDATE ' . salfa_table('compteurs') . ' SET valeur = ? WHERE cle = ?', [$max + 1, $cle]);
    } else {
        salfa_executer('INSERT INTO ' . salfa_table('compteurs') . ' (cle, valeur) VALUES (?, ?)', [$cle, $max + 1]);
    }
    return $numero;
}

function salfa_entier_valide(int $valeur): bool
{
    return $valeur >= -SALFA_MONTANT_MAX && $valeur <= SALFA_MONTANT_MAX;
}

/** Refuse une incohérence entre la somme des mouvements et le solde de clôture. */
function salfa_verifier_solde(int $ouverture, int $recettes, int $depenses, int $cloture, string $contexte): void
{
    if ($ouverture + $recettes - $depenses !== $cloture) {
        throw new SalFaErreur($contexte . ' : le solde de clôture ne correspond pas aux mouvements.', 400, 'solde_incoherent');
    }
    if (!salfa_entier_valide($cloture)) {
        throw new SalFaErreur($contexte . ' : solde hors plage autorisée.', 400, 'solde_invalide');
    }
}

function salfa_parametres(): array
{
    return salfa_pdo()->query('SELECT * FROM ' . salfa_table('parametres') . ' WHERE id = 1')->fetch() ?: [];
}

function salfa_exercice_ouvert(): int
{
    $p = salfa_parametres();
    if (!isset($p['exercice']) || $p['exercice'] === null) {
        throw new SalFaErreur('Aucun exercice n’est ouvert : initialisez le livre.', 409, 'exercice_absent');
    }
    return (int) $p['exercice'];
}

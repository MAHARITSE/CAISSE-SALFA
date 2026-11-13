<?php
/** Registre bancaire séparé de la caisse en espèces. */
declare(strict_types=1);

function salfa_registre_vide(): array
{
    return ['comptes' => [], 'ecritures' => [], 'tiers' => [], 'compteurs' => (object) []];
}

/** Valide tout le registre avant sauvegarde ou restauration. */
function salfa_valider_registre_virements(mixed $brut): array
{
    if (!is_array($brut) || !is_array($brut['comptes'] ?? null) || !is_array($brut['ecritures'] ?? null) || !is_array($brut['compteurs'] ?? null)) {
        throw new SalFaErreur('Registre de virements invalide.', 400, 'virements_invalides');
    }
    if (count($brut['comptes']) > 500 || count($brut['ecritures']) > SALFA_MAX_ECRITURES) {
        throw new SalFaErreur('Registre de virements trop volumineux.', 400, 'virements_invalides');
    }
    $comptes = []; $idsComptes = []; $clesComptes = [];
    foreach ($brut['comptes'] as $c) {
        if (!is_array($c)) throw new SalFaErreur('Compte bancaire invalide.', 400, 'virements_invalides');
        $compte = ['id' => salfa_champ($c, 'id', 120), 'banque' => salfa_champ($c, 'banque', 120), 'numeroCompte' => salfa_champ($c, 'numeroCompte', 120, false)];
        // Identité imprimée sur l'ordre de virement : absente des livres antérieurs.
        foreach (['titulaire' => 200, 'adresse' => 200, 'codeBanque' => 5] as $cle => $max) {
            $valeur = salfa_champ($c, $cle, $max, false);
            if ($valeur === '') continue;
            if ($cle === 'codeBanque' && !preg_match('/^\d{5}$/', $valeur)) throw new SalFaErreur('Code banque : cinq chiffres attendus.', 400, 'virements_invalides');
            $compte[$cle] = $valeur;
        }
        $cle = mb_strtolower($compte['banque']) . "\0" . mb_strtolower($compte['numeroCompte']);
        if (isset($idsComptes[$compte['id']]) || isset($clesComptes[$cle])) throw new SalFaErreur('Compte bancaire en double.', 400, 'doublon');
        $idsComptes[$compte['id']] = true; $clesComptes[$cle] = true; $comptes[] = $compte;
    }
    // Clients (recettes) et fournisseurs (DED) : le bénéficiaire des virements.
    $tiersBruts = array_key_exists('tiers', $brut) ? $brut['tiers'] : [];
    if (!is_array($tiersBruts) || count($tiersBruts) > 5000) throw new SalFaErreur('Clients et fournisseurs invalides.', 400, 'virements_invalides');
    $tiers = []; $idsTiers = []; $nomsTiers = [];
    foreach ($tiersBruts as $t) {
        if (!is_array($t)) throw new SalFaErreur('Client ou fournisseur invalide.', 400, 'virements_invalides');
        $type = $t['type'] ?? '';
        if (!in_array($type, ['CLIENT', 'FOURNISSEUR'], true)) throw new SalFaErreur('Type de client ou de fournisseur invalide.', 400, 'virements_invalides');
        $fiche = [
            'id' => salfa_champ($t, 'id', 120),
            'type' => $type,
            'nom' => salfa_champ($t, 'nom', 200),
            'telephone' => salfa_champ($t, 'telephone', 40, false),
            'adresse' => salfa_champ($t, 'adresse', 200, false),
            'banque' => salfa_champ($t, 'banque', 120, false),
            'numeroCompte' => salfa_champ($t, 'numeroCompte', 120, false),
        ];
        // Le RIB d'un fournisseur est imprimé sur l'ordre de virement : sans lui
        // la banque ne saurait pas où créditer l'argent.
        if ($type === 'FOURNISSEUR' && ($fiche['banque'] === '' || $fiche['numeroCompte'] === '')) {
            throw new SalFaErreur('Renseignez le RIB du fournisseur : il figure sur l’ordre de virement.', 400, 'rib_manquant');
        }
        $cle = $type . "\0" . mb_strtolower($fiche['nom']);
        if (isset($idsTiers[$fiche['id']]) || isset($nomsTiers[$cle])) throw new SalFaErreur('Client ou fournisseur en double.', 400, 'doublon');
        $idsTiers[$fiche['id']] = true; $nomsTiers[$cle] = true; $tiers[] = $fiche;
    }
    $ecritures = []; $ids = []; $numeros = []; $minima = [];
    foreach ($brut['ecritures'] as $v) {
        if (!is_array($v)) throw new SalFaErreur('Virement invalide.', 400, 'virements_invalides');
        $id = salfa_champ($v, 'id', 120); $compteId = salfa_champ($v, 'compteId', 120);
        $date = salfa_champ($v, 'date', 10); $sens = salfa_champ($v, 'sens', 10); $numero = salfa_champ($v, 'numero', 80);
        if (!isset($idsComptes[$compteId]) || !salfa_date_valide($date) || !in_array($sens, ['RECETTE', 'DEPENSE'], true)) throw new SalFaErreur('Compte, date ou type de virement invalide.', 400, 'virements_invalides');
        if (!preg_match('/^(VR|VD)-(\d{4})-(\d{4,9})$/', $numero, $m) || $m[1] !== ($sens === 'RECETTE' ? 'VR' : 'VD') || $m[2] !== substr($date, 0, 4) || (int) $m[3] < 1) throw new SalFaErreur('Numéro de virement invalide.', 400, 'virements_invalides');
        if (isset($ids[$id]) || isset($numeros[$numero])) throw new SalFaErreur('Virement ou numéro en double.', 400, 'doublon');
        $ids[$id] = true; $numeros[$numero] = true;
        $cle = $m[1] . '-' . $m[2]; $minima[$cle] = max($minima[$cle] ?? 0, (int) $m[3]);
        $cree = salfa_champ($v, 'createdAt', 40);
        if (!salfa_horodatage_valide($cree)) throw new SalFaErreur('Date de création invalide.', 400, 'virements_invalides');
        $e = [
            'id' => $id, 'numero' => $numero, 'compteId' => $compteId, 'date' => $date, 'sens' => $sens,
            'libelle' => salfa_champ($v, 'libelle', 200), 'categorie' => salfa_champ($v, 'categorie', 120),
            'tiers' => salfa_champ($v, 'tiers', 200, false), 'reference' => salfa_champ($v, 'reference', 200, false),
            'observation' => salfa_champ($v, 'observation', 500, false), 'montant' => salfa_entier($v, 'montant', 1, SALFA_MONTANT_MAX),
            'createdAt' => $cree,
        ];
        if (isset($v['updatedAt'])) {
            $modifie = salfa_champ($v, 'updatedAt', 40);
            if (!salfa_horodatage_valide($modifie)) throw new SalFaErreur('Date de modification invalide.', 400, 'virements_invalides');
            $e['updatedAt'] = $modifie;
        }
        // Mentions de l'ordre de virement remis à la banque, facultatives.
        foreach (['beneficiaireAdresse', 'beneficiaireBanque', 'beneficiaireCompte'] as $cle) {
            $valeur = salfa_champ($v, $cle, 200, false);
            if ($valeur !== '') $e[$cle] = $valeur;
        }
        if (($v['permanent'] ?? false) === true) $e['permanent'] = true;
        // Fiche du bénéficiaire : absente des virements antérieurs aux fiches.
        if (isset($v['tiersId']) && $v['tiersId'] !== '') {
            $tiersId = salfa_champ($v, 'tiersId', 120);
            if (!isset($idsTiers[$tiersId])) throw new SalFaErreur('Client ou fournisseur introuvable pour ce virement.', 400, 'tiers_absent');
            $e['tiersId'] = $tiersId;
        }
        $ecritures[] = $e;
    }
    $compteurs = [];
    foreach ($brut['compteurs'] as $cle => $valeur) {
        if (!is_string($cle) || !preg_match('/^(VR|VD)-\d{4}$/', $cle) || !is_int($valeur) || $valeur < ($minima[$cle] ?? 0) || $valeur > 999999999) throw new SalFaErreur('Compteur de virement invalide.', 400, 'virements_invalides');
        $compteurs[$cle] = $valeur;
    }
    foreach ($minima as $cle => $_) if (!isset($compteurs[$cle])) throw new SalFaErreur('Compteur de virement manquant.', 400, 'virements_invalides');
    return ['comptes' => $comptes, 'ecritures' => $ecritures, 'tiers' => $tiers, 'compteurs' => (object) $compteurs];
}

function salfa_lire_registre_virements(): array
{
    $brut = salfa_pdo()->query('SELECT contenu FROM ' . salfa_table('registre_virements') . ' WHERE id = 1')->fetchColumn();
    if ($brut === false) return salfa_registre_vide();
    $registre = json_decode((string) $brut, true);
    return salfa_valider_registre_virements($registre);
}

function salfa_ecrire_registre_virements(array $registre): void
{
    $json = json_encode($registre, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    salfa_executer('INSERT INTO ' . salfa_table('registre_virements') . ' (id, contenu) VALUES (1, ?) ON DUPLICATE KEY UPDATE contenu = VALUES(contenu)', [$json]);
}

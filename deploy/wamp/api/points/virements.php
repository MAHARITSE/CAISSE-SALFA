<?php
/** Mutations bancaires : contrôle de rôle exact, verrou et révision de la caisse. */
declare(strict_types=1);
require_once __DIR__ . '/../socle.php';
salfa_point('virements', function (): array {
    salfa_exiger_methode('POST');
    salfa_demarrer_session();
    $user = salfa_utilisateur_courant();
    if (!in_array($user['role'], ['admin', 'comptable'], true)) throw new SalFaErreur('Votre rôle ne permet pas cette action.', 403, 'role_insuffisant');
    return salfa_mutation('comptable', 'virements', function (array $corps): string {
        $registre = salfa_lire_registre_virements();
        // La validation JSON accepte un tableau pour l'objet des compteurs.
        $registre['compteurs'] = (array) $registre['compteurs'];
        $operation = $corps['operation'] ?? '';
        if ($operation === 'ajouter_compte') {
            if (!is_array($corps['compte'] ?? null)) throw new SalFaErreur('Compte manquant.', 400, 'virements_invalides');
            $registre['comptes'][] = $corps['compte'];
        } elseif ($operation === 'ajouter_comptes') {
            $comptes = $corps['comptes'] ?? null;
            if (!is_array($comptes) || count($comptes) < 1 || count($comptes) > 500) throw new SalFaErreur('Liste de comptes invalide.', 400, 'virements_invalides');
            foreach ($comptes as $compte) {
                if (!is_array($compte)) throw new SalFaErreur('Compte bancaire invalide.', 400, 'virements_invalides');
                $registre['comptes'][] = $compte;
            }
        } elseif ($operation === 'modifier_compte') {
            $compte = $corps['compte'] ?? null;
            if (!is_array($compte)) throw new SalFaErreur('Compte manquant.', 400, 'virements_invalides');
            $trouve = false;
            foreach ($registre['comptes'] as &$ancienCompte) {
                if ($ancienCompte['id'] === ($compte['id'] ?? null)) {
                    $ancienCompte = $compte; $trouve = true; break;
                }
            }
            unset($ancienCompte);
            if (!$trouve) throw new SalFaErreur('Compte bancaire introuvable.', 404, 'compte_absent');
        } elseif ($operation === 'supprimer_compte') {
            $compteId = $corps['compteId'] ?? null;
            if (!is_string($compteId) || $compteId === '') throw new SalFaErreur('Compte manquant.', 400, 'virements_invalides');
            foreach ($registre['ecritures'] as $ecriture) {
                if (($ecriture['compteId'] ?? null) === $compteId) {
                    throw new SalFaErreur('Ce compte porte des virements : il ne peut pas être supprimé. Corrigez son RIB plutôt.', 409, 'compte_utilise');
                }
            }
            $restants = [];
            foreach ($registre['comptes'] as $compte) {
                if ($compte['id'] !== $compteId) $restants[] = $compte;
            }
            if (count($restants) === count($registre['comptes'])) throw new SalFaErreur('Compte bancaire introuvable.', 404, 'compte_absent');
            $registre['comptes'] = $restants;
        } elseif ($operation === 'ajouter_tiers') {
            $fiche = $corps['tiers'] ?? null;
            if (!is_array($fiche)) throw new SalFaErreur('Client ou fournisseur manquant.', 400, 'virements_invalides');
            $registre['tiers'][] = $fiche;
        } elseif ($operation === 'modifier_tiers') {
            $fiche = $corps['tiers'] ?? null;
            if (!is_array($fiche)) throw new SalFaErreur('Client ou fournisseur manquant.', 400, 'virements_invalides');
            $trouve = false;
            foreach ($registre['tiers'] as &$ancienneFiche) {
                if ($ancienneFiche['id'] === ($fiche['id'] ?? null)) {
                    $ancienneFiche = $fiche; $trouve = true; break;
                }
            }
            unset($ancienneFiche);
            if (!$trouve) throw new SalFaErreur('Client ou fournisseur introuvable.', 404, 'tiers_absent');
        } elseif ($operation === 'supprimer_tiers') {
            $tiersId = $corps['tiersId'] ?? null;
            if (!is_string($tiersId) || $tiersId === '') throw new SalFaErreur('Client ou fournisseur manquant.', 400, 'virements_invalides');
            foreach ($registre['ecritures'] as $ecriture) {
                if (($ecriture['tiersId'] ?? null) === $tiersId) {
                    throw new SalFaErreur('Ce client ou fournisseur porte des virements : il ne peut pas être supprimé. Corrigez sa fiche plutôt.', 409, 'tiers_utilise');
                }
            }
            $restants = [];
            foreach ($registre['tiers'] as $fiche) {
                if ($fiche['id'] !== $tiersId) $restants[] = $fiche;
            }
            if (count($restants) === count($registre['tiers'])) throw new SalFaErreur('Client ou fournisseur introuvable.', 404, 'tiers_absent');
            $registre['tiers'] = $restants;
        } elseif ($operation === 'charger_exemples') {
            // Exemples de démonstration : ajoutés à ce qui existe, jamais substitués.
            $exemple = $corps['exemple'] ?? null;
            if (!is_array($exemple)) throw new SalFaErreur('Exemples manquants.', 400, 'virements_invalides');
            $comptes = $exemple['comptes'] ?? [];
            $tiers = $exemple['tiers'] ?? [];
            $virements = $exemple['virements'] ?? [];
            if (!is_array($comptes) || !is_array($tiers) || !is_array($virements)) throw new SalFaErreur('Exemples invalides.', 400, 'virements_invalides');
            if (count($comptes) > 500 || count($tiers) > 500 || count($virements) > 500) throw new SalFaErreur('Exemples trop volumineux.', 400, 'virements_invalides');
            $clesComptes = [];
            foreach ($registre['comptes'] as $compte) $clesComptes[mb_strtolower($compte['banque']) . "\0" . mb_strtolower($compte['numeroCompte'])] = true;
            foreach ($comptes as $compte) {
                if (!is_array($compte)) throw new SalFaErreur('Compte bancaire invalide.', 400, 'virements_invalides');
                $cle = mb_strtolower($compte['banque'] ?? '') . "\0" . mb_strtolower($compte['numeroCompte'] ?? '');
                if (isset($clesComptes[$cle])) continue;
                $clesComptes[$cle] = true;
                $registre['comptes'][] = $compte;
            }
            $clesTiers = [];
            foreach ($registre['tiers'] as $fiche) $clesTiers[($fiche['type'] ?? '') . "\0" . mb_strtolower($fiche['nom'] ?? '')] = true;
            foreach ($tiers as $fiche) {
                if (!is_array($fiche)) throw new SalFaErreur('Client ou fournisseur invalide.', 400, 'virements_invalides');
                $cle = ($fiche['type'] ?? '') . "\0" . mb_strtolower($fiche['nom'] ?? '');
                if (isset($clesTiers[$cle])) continue;
                $clesTiers[$cle] = true;
                $registre['tiers'][] = $fiche;
            }
            foreach ($virements as $v) {
                if (!is_array($v)) throw new SalFaErreur('Virement d’exemple invalide.', 400, 'virements_invalides');
                $sens = $v['sens'] ?? ''; $date = $v['date'] ?? '';
                if (!in_array($sens, ['RECETTE', 'DEPENSE'], true) || !salfa_date_valide($date)) throw new SalFaErreur('Date ou type de virement invalide.', 400, 'virements_invalides');
                $cle = ($sens === 'RECETTE' ? 'VR' : 'VD') . '-' . substr($date, 0, 4);
                $suivant = ($registre['compteurs'][$cle] ?? 0) + 1;
                if ($suivant > 999999999) throw new SalFaErreur('Limite de numérotation atteinte.', 400, 'virements_invalides');
                $v['numero'] = $cle . '-' . str_pad((string) $suivant, 4, '0', STR_PAD_LEFT);
                $v['createdAt'] = gmdate('c'); unset($v['updatedAt']);
                $registre['ecritures'][] = $v; $registre['compteurs'][$cle] = $suivant;
            }
        } elseif ($operation === 'ajouter') {
            $v = $corps['virement'] ?? null;
            if (!is_array($v)) throw new SalFaErreur('Virement manquant.', 400, 'virements_invalides');
            $sens = $v['sens'] ?? ''; $date = $v['date'] ?? '';
            if (!in_array($sens, ['RECETTE', 'DEPENSE'], true) || !salfa_date_valide($date)) throw new SalFaErreur('Date ou type de virement invalide.', 400, 'virements_invalides');
            $cle = ($sens === 'RECETTE' ? 'VR' : 'VD') . '-' . substr($date, 0, 4);
            $suivant = ($registre['compteurs'][$cle] ?? 0) + 1;
            if ($suivant > 999999999) throw new SalFaErreur('Limite de numérotation atteinte.', 400, 'virements_invalides');
            $v['numero'] = $cle . '-' . str_pad((string) $suivant, 4, '0', STR_PAD_LEFT);
            $v['createdAt'] = gmdate('c'); unset($v['updatedAt']);
            $registre['ecritures'][] = $v; $registre['compteurs'][$cle] = $suivant;
        } elseif ($operation === 'modifier') {
            $v = $corps['virement'] ?? null;
            if (!is_array($v)) throw new SalFaErreur('Virement manquant.', 400, 'virements_invalides');
            $trouve = false;
            foreach ($registre['ecritures'] as &$ancien) {
                if ($ancien['id'] === ($v['id'] ?? null)) {
                    if (($v['numero'] ?? null) !== $ancien['numero'] || ($v['sens'] ?? null) !== $ancien['sens'] || ($v['createdAt'] ?? null) !== $ancien['createdAt']) throw new SalFaErreur('Identité du virement modifiée.', 400, 'virements_invalides');
                    $v['updatedAt'] = gmdate('c'); $ancien = $v; $trouve = true; break;
                }
            }
            unset($ancien);
            if (!$trouve) throw new SalFaErreur('Virement introuvable.', 404, 'virement_absent');
        } else throw new SalFaErreur('Action de virement inconnue.', 400, 'action_inconnue');
        $registre = salfa_valider_registre_virements($registre);
        salfa_ecrire_registre_virements($registre);
        salfa_incrementer_revision();
        return (string) $operation;
    });
});

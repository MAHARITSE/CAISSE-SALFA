<?php
/**
 * api/utilisateurs.php — gestion des comptes et de leurs rôles.
 *
 * GET  ?action=utilisateurs              → liste des comptes (sans secret)
 * POST ?action=utilisateurs-creer        → { identifiant, nomComplet, role, motDePasse, actif }
 * POST ?action=utilisateurs-modifier     → { id, nomComplet?, role?, actif?, motDePasse? }
 * POST ?action=utilisateurs-supprimer    → { id }
 *
 * Réservé à l'administrateur. Les rôles suivent la même hiérarchie que le
 * reste de l'API : « comptable » lit, « caissier » saisit, « admin » gère.
 * Aucun hachage ne sort d'ici.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('utilisateurs', function (): array {
    // Un seul point, quatre gestes : le socle exécute le bloc à l'inclusion,
    // donc les quatre ne doivent pas être déclarés séparément.
    $action = salfa_action_demandee();
    salfa_demarrer_session();
    $admin = salfa_exiger_role('admin');

    if ($action === 'utilisateurs') {
        salfa_exiger_methode('GET');
        return ['ok' => true, 'comptes' => salfa_lister_comptes()];
    }

    salfa_exiger_methode('POST');
    $corps = salfa_corps();
    if ($action === 'utilisateurs-creer') {
        $compte = salfa_creer_compte($corps);
        salfa_journaliser('utilisateur_cree', (int) $admin['id'], 'succes', (string) $compte['identifiant']);
        return ['ok' => true, 'compte' => $compte];
    }
    if ($action === 'utilisateurs-modifier') {
        $compte = salfa_modifier_compte($corps);
        salfa_journaliser('utilisateur_modifie', (int) $admin['id'], 'succes', (string) $compte['identifiant']);
        return ['ok' => true, 'compte' => $compte];
    }
    if ($action === 'utilisateurs-supprimer') {
        $identifiant = salfa_supprimer_compte($corps);
        salfa_journaliser('utilisateur_supprime', (int) $admin['id'], 'succes', $identifiant);
        return ['ok' => true];
    }
    throw new SalFaErreur('Action de gestion des comptes inconnue.', 404, 'action_inconnue');
});

<?php
/**
 * Petites aides partagées par les points d'API.
 *
 * Elles vivent ici, et non dans `points/utilisateurs.php` : un point d'API
 * s'exécute à l'inclusion, donc les fonctions déclarées après l'appel de
 * `salfa_point()` n'existent jamais au moment où le code les appelle. Ce fichier
 * est chargé par le socle, avant tout point.
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

/** Action demandée, normalisée comme dans api/index.php. */
function salfa_action_demandee(): string
{
    $action = (string) ($_GET['action'] ?? $_GET['r'] ?? '');
    return strtolower(trim((string) preg_replace('#[^a-z0-9\-_]#i', '', $action)));
}

/** Rôles acceptés, alignés sur la colonne ENUM de salfa_utilisateurs. */
function salfa_roles_valides(): array
{
    return ['comptable', 'caissier', 'admin'];
}

/**
 * @return array<int, array<string, mixed>>
 */
function salfa_lister_comptes(): array
{
    $lignes = salfa_executer(
        'SELECT id, identifiant, nom_complet, role, actif, derniere_connexion, cree_le FROM '
        . salfa_table('utilisateurs') . ' ORDER BY role, identifiant'
    )->fetchAll();
    $comptes = [];
    foreach ($lignes as $ligne) {
        $comptes[] = [
            'id' => (string) $ligne['id'],
            'identifiant' => (string) $ligne['identifiant'],
            'nomComplet' => (string) $ligne['nom_complet'],
            'role' => (string) $ligne['role'],
            'actif' => (int) $ligne['actif'] === 1,
            'derniereConnexion' => $ligne['derniere_connexion'] !== null ? (string) $ligne['derniere_connexion'] : null,
        ];
    }
    return $comptes;
}

/** @return array<string, mixed> */
function salfa_compte_par_id(int $id): array
{
    $ligne = salfa_executer(
        'SELECT id, identifiant, nom_complet, role, actif FROM ' . salfa_table('utilisateurs') . ' WHERE id = ?',
        [$id]
    )->fetch();
    if (!$ligne) {
        throw new SalFaErreur('Ce compte est introuvable.', 404, 'compte_absent');
    }
    return [
        'id' => (string) $ligne['id'],
        'identifiant' => (string) $ligne['identifiant'],
        'nomComplet' => (string) $ligne['nom_complet'],
        'role' => (string) $ligne['role'],
        'actif' => (int) $ligne['actif'] === 1,
    ];
}

/**
 * Empêche de se priver du dernier administrateur actif : sans lui, plus
 * personne ne pourrait gérer les comptes ni clôturer un exercice.
 */
function salfa_verifier_dernier_admin(?int $idExclu): void
{
    $reste = (int) salfa_executer(
        'SELECT COUNT(*) FROM ' . salfa_table('utilisateurs') . " WHERE role = 'admin' AND actif = 1"
        . ($idExclu !== null ? ' AND id <> ?' : ''),
        $idExclu !== null ? [$idExclu] : []
    )->fetchColumn();
    if ($reste === 0) {
        throw new SalFaErreur('Il doit rester au moins un administrateur actif.', 400, 'dernier_admin');
    }
}

/** @param array<string, mixed> $corps */
function salfa_creer_compte(array $corps): array
{
    $identifiant = mb_strtolower(trim((string) ($corps['identifiant'] ?? '')));
    $nomComplet = trim((string) ($corps['nomComplet'] ?? ''));
    $role = (string) ($corps['role'] ?? 'caissier');
    $motDePasse = (string) ($corps['motDePasse'] ?? '');
    if ($identifiant === '' || !preg_match('/^[a-z0-9._-]{3,80}$/', $identifiant)) {
        throw new SalFaErreur('Identifiant invalide : 3 à 80 lettres, chiffres, points, tirets ou soulignés.', 400, 'identifiant_invalide');
    }
    if ($nomComplet === '') {
        throw new SalFaErreur('Le nom complet est obligatoire.', 400, 'nom_manquant');
    }
    if (!in_array($role, salfa_roles_valides(), true)) {
        throw new SalFaErreur('Rôle inconnu.', 400, 'role_invalide');
    }
    if (mb_strlen($motDePasse) < SALFA_LONGUEUR_MDP) {
        throw new SalFaErreur('Le mot de passe doit contenir au moins ' . SALFA_LONGUEUR_MDP . ' caractères.', 400, 'mdp_court');
    }
    $existe = (int) salfa_executer(
        'SELECT COUNT(*) FROM ' . salfa_table('utilisateurs') . ' WHERE identifiant = ?',
        [$identifiant]
    )->fetchColumn();
    if ($existe > 0) {
        throw new SalFaErreur('Cet identifiant est déjà utilisé.', 409, 'identifiant_pris');
    }
    salfa_executer(
        'INSERT INTO ' . salfa_table('utilisateurs') . ' (identifiant, nom_complet, mdp_hash, role, actif) VALUES (?, ?, ?, ?, ?)',
        [$identifiant, mb_substr($nomComplet, 0, 120), password_hash($motDePasse, PASSWORD_DEFAULT), $role, !empty($corps['actif']) || !isset($corps['actif']) ? 1 : 0]
    );
    return salfa_compte_par_id((int) salfa_pdo()->lastInsertId());
}

/** @param array<string, mixed> $corps */
function salfa_modifier_compte(array $corps): array
{
    $id = (int) ($corps['id'] ?? 0);
    if ($id <= 0) {
        throw new SalFaErreur('Compte non précisé.', 400, 'compte_absent');
    }
    $actuel = salfa_compte_par_id($id);
    $role = array_key_exists('role', $corps) ? (string) $corps['role'] : (string) $actuel['role'];
    if (!in_array($role, salfa_roles_valides(), true)) {
        throw new SalFaErreur('Rôle inconnu.', 400, 'role_invalide');
    }
    $actif = array_key_exists('actif', $corps) ? (bool) $corps['actif'] : (bool) $actuel['actif'];
    $nomComplet = array_key_exists('nomComplet', $corps)
        ? mb_substr(trim((string) $corps['nomComplet']), 0, 120)
        : (string) $actuel['nomComplet'];
    if ($nomComplet === '') {
        throw new SalFaErreur('Le nom complet est obligatoire.', 400, 'nom_manquant');
    }
    // Un administrateur rétrogradé ou désactivé ne doit pas être le dernier.
    if ($actuel['role'] === 'admin' && ($role !== 'admin' || !$actif)) {
        salfa_verifier_dernier_admin($id);
    }
    salfa_executer(
        'UPDATE ' . salfa_table('utilisateurs') . ' SET nom_complet = ?, role = ?, actif = ? WHERE id = ?',
        [$nomComplet, $role, $actif ? 1 : 0, $id]
    );
    $motDePasse = (string) ($corps['motDePasse'] ?? '');
    if ($motDePasse !== '') {
        if (mb_strlen($motDePasse) < SALFA_LONGUEUR_MDP) {
            throw new SalFaErreur('Le mot de passe doit contenir au moins ' . SALFA_LONGUEUR_MDP . ' caractères.', 400, 'mdp_court');
        }
        salfa_executer(
            'UPDATE ' . salfa_table('utilisateurs') . ' SET mdp_hash = ? WHERE id = ?',
            [password_hash($motDePasse, PASSWORD_DEFAULT), $id]
        );
    }
    return salfa_compte_par_id($id);
}

/** @param array<string, mixed> $corps */
function salfa_supprimer_compte(array $corps): string
{
    $id = (int) ($corps['id'] ?? 0);
    if ($id <= 0) {
        throw new SalFaErreur('Compte non précisé.', 400, 'compte_absent');
    }
    $compte = salfa_compte_par_id($id);
    if ($compte['role'] === 'admin') {
        salfa_verifier_dernier_admin($id);
    }
    salfa_executer('DELETE FROM ' . salfa_table('utilisateurs') . ' WHERE id = ?', [$id]);
    return (string) $compte['identifiant'];
}

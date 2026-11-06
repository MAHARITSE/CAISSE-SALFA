<?php
/**
 * Enveloppe commune des points d'API : méthode HTTP et mutations.
 * Inclus une seule fois, par api/socle.php, et donc disponible dans chaque
 * fichier de api/points/. Les garde-fous ci-dessous protègent d'une inclusion
 * multiple : deux déclarations de la même fonction sont une erreur fatale.
 */

declare(strict_types=1);

if (!function_exists('salfa_exiger_methode')) {

/** Refuse la requête si la méthode HTTP n'est pas celle attendue. */
function salfa_exiger_methode(string $attendu): void
{
    $methode = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($methode !== $attendu) {
        throw new SalFaErreur('Méthode non autorisée : ' . $attendu . ' attendu.', 405, 'methode');
    }
}

/**
 * Mutation authentifiée : transaction + contrôle de révision + journal,
 * puis réponse contenant le livre complet.
 *
 * @param callable(array<string, mixed>):mixed $action
 * @return array<string, mixed>
 */
function salfa_mutation(string $role, string $journal, callable $action): array
{
    $utilisateur = salfa_exiger_role($role);
    return [
        'ok' => true,
        'livre' => salfa_transaction(function () use ($action, $journal, $utilisateur): void {
            $corps = salfa_corps();
            salfa_verifier_revision(salfa_revision_attendue($corps));
            $detail = $action($corps);
            salfa_journaliser($journal, (int) $utilisateur['id'], 'succes', is_string($detail) ? $detail : '');
        }),
    ];
}}

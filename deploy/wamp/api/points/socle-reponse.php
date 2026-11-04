<?php
/**
 * Enveloppe commune : contrôle de méthode, session et gestion d'erreurs.
 * Inclus par api/socle.php, donc disponible dans chaque fichier d'API.
 */

declare(strict_types=1);

/** Refuse la requête si la méthode HTTP n'est pas celle attendue. */
function salfa_exiger_methode(string $attendu): void
{
    $methode = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($methode !== $attendu) {
        throw new SalFaErreur('Méthode non autorisée : ' . $attendu . ' attendu.', 405, 'methode');
    }
}

/**
 * Exécute un point d'API et renvoie toujours du JSON, erreurs comprises.
 * Le corps transmis par l'appelant est fusionné dans la réponse si besoin.
 */
function salfa_executer_point(string $nom, callable $action): void
{
    try {
        if (!salfa_est_installe()) {
            throw new SalFaErreur(
                'L’API n’est pas encore configurée : lancez outils\installer.bat ou copiez api\salfa-config.modele.php.',
                503,
                'non_installe'
            );
        }
        $resultat = $action();
        salfa_repondre(is_array($resultat) ? $resultat : ['ok' => true]);
    } catch (SalFaErreur $e) {
        salfa_erreur($e->getMessage(), $e->statut, $e->codeErreur);
    } catch (Throwable $e) {
        error_log('SALFA API (' . $nom . ') : ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        $debug = (bool) (salfa_config()['debug'] ?? false);
        salfa_erreur(
            'Erreur interne de l’API. Consultez les journaux PHP de WAMP.' . ($debug ? ' [' . $e->getMessage() . ']' : ''),
            500,
            'erreur_interne'
        );
    }
}

/**
 * Mutation authentifiée : transaction + contrôle de révision + journal,
 * puis réponse contenant le livre complet.
 *
 * @param callable(array<string, mixed>):mixed $action
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
}

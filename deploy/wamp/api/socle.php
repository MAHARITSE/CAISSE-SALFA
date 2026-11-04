<?php
/**
 * CAISSE SALFA — socle commun de l'API.
 *
 * Inclus par api/index.php et par chaque fichier de api/points/.
 * Ne contient aucune route : uniquement les inclusions et l'enveloppe de réponse.
 */

declare(strict_types=1);

if (!defined('SALFA_SOCLE')) {
    define('SALFA_SOCLE', true);
    require __DIR__ . '/config.php';
    require __DIR__ . '/lib/utile.php';
    require __DIR__ . '/lib/db.php';
    require __DIR__ . '/lib/auth.php';
    require __DIR__ . '/lib/validation.php';
    require __DIR__ . '/lib/aide-objet.php';
    require __DIR__ . '/lib/metier.php';
    require __DIR__ . '/points/enveloppe.php';
}

/**
 * Exécute un point d'API et renvoie toujours du JSON, erreurs comprises.
 * Un fichier de api/points/ appelle simplement : salfa_point('livre', $action);
 */
function salfa_point(string $nom, callable $action): void
{
    try {
        if (!salfa_est_installe()) {
            throw new SalFaErreur(
                'L’API n’est pas encore configurée : lancez outils\installer.bat, ou copiez api\salfa-config.modele.php en api\salfa-config.php puis appelez api/installer.php.',
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
            'Erreur interne de l’API (' . $nom . '). Consultez les journaux PHP de WAMP.'
                . ($debug ? ' [' . $e->getMessage() . ']' : ''),
            500,
            'erreur_interne'
        );
    }
}

<?php
/**
 * CAISSE SALFA — socle commun de l'API.
 *
 * Inclus par api/index.php et par chaque fichier de api/points/.
 * Ne contient aucune route : uniquement les inclusions, l'amorçage automatique
 * du serveur et l'enveloppe de réponse.
 *
 * Principe retenu : **aucune installation**. Le dossier se copie dans `www`,
 * la première requête crée la configuration, la base, les tables et les
 * comptes de départ (voir `lib/amorce.php`).
 *
 * ATTENTION : index.php inclut ce fichier, puis le point d'API l'inclut à son
 * tour. Tout le contenu — includes **et** fonctions — doit donc rester sous le
 * garde-fou `SALFA_SOCLE` : une fonction déclarée en dehors provoque une erreur
 * fatale « Cannot redeclare », donc une réponse 500 sans JSON.
 */

declare(strict_types=1);

if (!defined('SALFA_SOCLE')) {
    define('SALFA_SOCLE', true);

    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/lib/utile.php';
    require_once __DIR__ . '/lib/amorce.php';
    require_once __DIR__ . '/lib/db.php';
    require_once __DIR__ . '/lib/auth.php';
    require_once __DIR__ . '/lib/validation.php';
    require_once __DIR__ . '/lib/aide-objet.php';
    require_once __DIR__ . '/lib/metier.php';
    require_once __DIR__ . '/lib/export-sql.php';
    require_once __DIR__ . '/points/enveloppe.php';

    /**
     * Exécute un point d'API et renvoie toujours du JSON, erreurs comprises.
     * Un fichier de api/points/ appelle simplement : salfa_point('livre', $action);
     */
    function salfa_point(string $nom, callable $action): void
    {
        try {
            // La base se prépare toute seule : première requête sur un dossier
            // fraîchement copié, base absente, tables manquantes après une mise
            // à jour… Rien à lancer, rien à configurer à la main.
            salfa_amorcer_silencieusement();

            $resultat = $action();
            salfa_repondre(is_array($resultat) ? $resultat : ['ok' => true]);
        } catch (SalFaErreur $e) {
            salfa_erreur($e->getMessage(), $e->statut, $e->codeErreur);
        } catch (Throwable $e) {
            error_log('SALFA API (' . $nom . ') : ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $debug = (bool) (salfa_config()['debug'] ?? false);
            salfa_erreur(
                'Erreur interne de l’API (' . $nom . '). Consultez les journaux PHP de WampServer.'
                    . ($debug ? ' [' . $e->getMessage() . ']' : ''),
                500,
                'erreur_interne'
            );
        }
    }
}

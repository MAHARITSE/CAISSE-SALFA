<?php
/**
 * CAISSE SALFA — point d'entrée unique de l'API PHP/MySQL (WAMP).
 *
 * URLs :
 *   /caisse-salfa/api/sante          (via .htaccess)
 *   /caisse-salfa/api/index.php?r=sante
 *
 * Toutes les réponses sont du JSON. Chaque mutation renvoie le livre complet
 * afin que le navigateur n'ait jamais à recalculer un état partiel.
 */

declare(strict_types=1);

require __DIR__ . '/config.php';
require __DIR__ . '/lib/utile.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/validation.php';
require __DIR__ . '/lib/aide-objet.php';
require __DIR__ . '/lib/metier.php';

ini_set('display_errors', '0');
ini_set('log_errors', '1');

try {
    if (!salfa_est_installe()) {
        throw new SalFaErreur(
            'L’API n’est pas encore configurée : lancez outils\installer.bat ou copiez api\salfa-config.modele.php.',
            503,
            'non_installe'
        );
    }

    $methode = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $route = (string) ($_GET['r'] ?? '');
    if ($route === '') {
        $uri = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
        $route = (string) preg_replace('#^.*?/api/#', '', $uri);
    }
    $route = trim((string) preg_replace('#/+#', '/', $route), '/');

    // La session PHP porte l'identité ; chaque route décide elle-même si elle l'exige.
    salfa_demarrer_session();

    switch ($route) {
        case 'sante':
            salfa_pdo();
            $livre = salfa_charger_livre();
            salfa_repondre([
                'ok' => true,
                'application' => 'CAISSE SALFA',
                'versionApi' => '1.0',
                'php' => PHP_VERSION,
                'base' => 'connectee',
                'revision' => $livre['revision'],
                'exercice' => $livre['parametres']['exercice'],
            ]);
            break;

        case 'session':
            salfa_repondre(salfa_etat_session());
            break;

        case 'connexion':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_repondre(salfa_connecter(salfa_corps()));
            break;

        case 'deconnexion':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            $utilisateur = salfa_utilisateur_courant(false);
            salfa_journaliser('deconnexion', $utilisateur['id'] ?? null, 'succes');
            salfa_fermer_session();
            salfa_repondre(['ok' => true, 'connecte' => false]);
            break;

        case 'mot-de-passe':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_repondre(salfa_changer_mot_de_passe(salfa_corps()));
            break;

        case 'livre':
            if ($methode !== 'GET') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_utilisateur_courant();
            salfa_repondre(['ok' => true, 'livre' => salfa_charger_livre()]);
            break;

        case 'ecritures':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            $utilisateur = salfa_exiger_role('caissier');
            salfa_repondre([
                'ok' => true,
                'livre' => salfa_transaction(function (): void {
                    $corps = salfa_corps();
                    salfa_verifier_revision(salfa_revision_attendue($corps));
                    $resultat = salfa_enregistrer_ecriture(salfa_objet($corps, 'ecriture'));
                    salfa_journaliser('ecriture', null, 'succes', $resultat['numero']);
                }),
            ]);
            break;

        case 'ecritures/supprimer':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_exiger_role('caissier');
            salfa_repondre([
                'ok' => true,
                'livre' => salfa_transaction(function (): void {
                    $corps = salfa_corps();
                    $id = salfa_champ($corps, 'id', 120);
                    salfa_verifier_revision(salfa_revision_attendue($corps));
                    salfa_supprimer_ecriture($id);
                    salfa_journaliser('suppression', null, 'succes', $id);
                }),
            ]);
            break;

        case 'ecritures/restaurer':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_exiger_role('caissier');
            salfa_repondre([
                'ok' => true,
                'livre' => salfa_transaction(function (): void {
                    $corps = salfa_corps();
                    salfa_verifier_revision(salfa_revision_attendue($corps));
                    salfa_restaurer_ecriture(salfa_objet($corps, 'ecriture'));
                    salfa_journaliser('restauration', null, 'succes');
                }),
            ]);
            break;

        case 'masques':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            salfa_exiger_role('caissier');
            salfa_repondre([
                'ok' => true,
                'livre' => salfa_transaction(function (): void {
                    $corps = salfa_corps();
                    salfa_verifier_revision(salfa_revision_attendue($corps));
                    $masques = $corps['masques'] ?? null;
                    if (!is_array($masques)) {
                        throw new SalFaErreur('Liste de modèles attendue.', 400, 'masques_invalides');
                    }
                    salfa_enregistrer_masques($masques);
                    salfa_journaliser('masques', null, 'succes');
                }),
            ]);
            break;

        case 'solde-initial':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            $utilisateur = salfa_exiger_role('admin');
            salfa_repondre([
                'ok' => true,
                'livre' => salfa_transaction(function () use ($utilisateur): void {
                    $corps = salfa_corps();
                    salfa_verifier_revision(salfa_revision_attendue($corps));
                    $solde = salfa_entier($corps, 'soldeInitial', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);
                    salfa_executer('UPDATE ' . salfa_table('parametres') . ' SET solde_initial = ? WHERE id = 1', [$solde]);
                    salfa_incrementer_revision();
                    salfa_journaliser('solde_initial', (int) $utilisateur['id'], 'succes', (string) $solde);
                }),
            ]);
            break;

        case 'cloture':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            $utilisateur = salfa_exiger_role('admin');
            salfa_cloturer(salfa_corps());
            salfa_journaliser('cloture', (int) $utilisateur['id'], 'succes');
            salfa_repondre(['ok' => true, 'livre' => salfa_charger_livre()]);
            break;

        case 'restauration':
            if ($methode !== 'POST') {
                throw new SalFaErreur('Méthode non autorisée.', 405, 'methode');
            }
            $utilisateur = salfa_exiger_role('admin');
            salfa_restaurer_sauvegarde(salfa_corps());
            salfa_journaliser('restauration_sauvegarde', (int) $utilisateur['id'], 'succes');
            salfa_repondre(['ok' => true, 'livre' => salfa_charger_livre()]);
            break;

        case 'sauvegarde':
            salfa_exiger_role('lecteur');
            salfa_repondre(['ok' => true, 'sauvegarde' => salfa_charger_livre(), 'exportedAt' => gmdate('c')]);
            break;

        default:
            throw new SalFaErreur('Route inconnue : ' . $route, 404, 'route_inconnue');
    }
} catch (SalFaErreur $e) {
    salfa_erreur($e->getMessage(), $e->statut, $e->codeErreur);
} catch (Throwable $e) {
    error_log('SALFA API : ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $debug = (bool) (salfa_config()['debug'] ?? false);
    salfa_erreur(
        'Erreur interne de l’API. Consultez les journaux PHP de WAMP.' . ($debug ? ' [' . $e->getMessage() . ']' : ''),
        500,
        'erreur_interne'
    );
}

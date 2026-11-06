<?php
/**
 * CAISSE SALFA — aiguillage de l'API PHP/MySQL.
 *
 * api/index.php?action=livre
 *
 * Chaque action est aussi disponible en appel direct :
 *   api/livre.php   api/cloture.php   api/verifier.php   api/sante.php …
 *
 * Toutes les réponses sont du JSON. Chaque mutation renvoie le livre complet,
 * afin que le navigateur n'ait jamais à recalculer un état partiel.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/socle.php';

salfa_point('index', function (): void {
    $action = (string) ($_GET['action'] ?? $_GET['r'] ?? '');
    $action = strtolower(trim((string) preg_replace('#[^a-z0-9\-_]#i', '', $action)));
    $actions = [
        'sante' => 'sante',
        'session' => 'session',
        'connexion' => 'connexion',
        'deconnexion' => 'deconnexion',
        'mot-de-passe' => 'mot-de-passe',
        'livre' => 'livre',
        'ecritures' => 'ecritures',
        'ecritures-supprimer' => 'ecritures-supprimer',
        'ecritures-restaurer' => 'ecritures-restaurer',
        'masques' => 'masques',
        'entete' => 'entete',
        'categories' => 'categories',
        'solde-initial' => 'solde-initial',
        'cloture' => 'cloture',
        'restauration' => 'restauration',
        'sauvegarde' => 'sauvegarde',
        'verifier' => 'verifier',
        'utilisateurs' => 'utilisateurs',
        'utilisateurs-creer' => 'utilisateurs',
        'utilisateurs-modifier' => 'utilisateurs',
        'utilisateurs-supprimer' => 'utilisateurs',
    ];
    if ($action === '') {
        throw new SalFaErreur(
            'Aucune action demandée. Utilisez api/index.php?action=livre ou appelez directement un fichier : api/livre.php, api/sante.php…',
            400,
            'action_manquante'
        );
    }
    if (!isset($actions[$action])) {
        throw new SalFaErreur('Action inconnue : « ' . $action . ' ».', 404, 'action_inconnue');
    }
    require __DIR__ . '/points/' . $actions[$action] . '.php';
});

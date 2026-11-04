<?php
/**
 * Modèle de configuration.
 * En principe inutile : outils\installer.bat écrit data/salfa-config.php.
 * Ce modèle sert en cas d'installation manuelle : copier en data/salfa-config.php.
 * Ne jamais valider le vrai mot de passe dans un dépôt Git.
 */

return [
    // Accès MySQL fournis par WAMP (phpMyAdmin).
    'hote' => '127.0.0.1',
    'port' => 3306,
    'base' => 'caisse_salfa',
    'utilisateur' => 'root',
    'mot_de_passe' => '',

    // Préfixe des tables ; doit correspondre à sql/salfa_install.sql.
    'prefixe' => 'salfa_',
    'prefixe_session' => 'salfa_session_',

    // 'mixte' : sessions PHP + vérification MySQL (recommandé WAMP).
    // 'mysql' : la session n'existe que dans la table salfa_sessions.
    'mode_session' => 'mixte',
    'sel_session' => 'changez-ce-sel',

    // true uniquement pendant l'installation : affiche les messages techniques.
    'debug' => false,

    // Limitation des tentatives de connexion et de clôture.
    'limite_requetes' => 60,
    'fenetre_requetes' => 60,

    'timezone' => 'Indian/Antananarivo',
];

<?php
/**
 * POST api/configurer.php — { hote, port, base, utilisateur, motDePasse } (public)
 *
 * Sert uniquement quand l'accès MySQL par défaut de WampServer ne suffit pas
 * (mot de passe personnalisé, port 3307, base déjà nommée autrement). L'écran
 * de connexion montre alors le formulaire, et ce point prépare le serveur avec
 * les accès saisis : configuration, base, tables et comptes de départ.
 *
 * Appelable une seule fois : dès qu'un fichier de configuration existe, le
 * point refuse toute modification sans authentification, pour qu'un visiteur du
 * réseau ne puisse pas détourner une caisse déjà en service.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('configurer', function (): array {
    salfa_exiger_methode('POST');

    if (salfa_est_configure()) {
        // Déjà configuré : seul un administrateur connecté peut revoir les accès.
        salfa_demarrer_session();
        salfa_exiger_role('admin');
        throw new SalFaErreur(
            'Le serveur est déjà configuré. Les accès MySQL se modifient dans le fichier salfa-config.php, à côté du dossier www.',
            409,
            'deja_configure'
        );
    }

    $corps = salfa_corps();
    $hote = trim((string) ($corps['hote'] ?? '127.0.0.1')) ?: '127.0.0.1';
    $port = (int) ($corps['port'] ?? 3306);
    $base = trim((string) ($corps['base'] ?? 'caisse_salfa')) ?: 'caisse_salfa';
    $utilisateur = trim((string) ($corps['utilisateur'] ?? 'root'));
    $motDePasse = (string) ($corps['motDePasse'] ?? '');

    if (!preg_match('/^[A-Za-z0-9_.-]{1,120}$/', $hote)) {
        throw new SalFaErreur('Hôte MySQL invalide (ex. 127.0.0.1).', 400, 'hote_invalide');
    }
    if ($port <= 0 || $port > 65535) {
        throw new SalFaErreur('Port MySQL invalide (3306 par défaut).', 400, 'port_invalide');
    }
    if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $base)) {
        throw new SalFaErreur('Nom de base invalide : lettres, chiffres et souligné uniquement (ex. caisse_salfa).', 400, 'base_invalide');
    }
    if ($utilisateur === '') {
        throw new SalFaErreur('Indiquez l’utilisateur MySQL (sur WampServer : « root »).', 400, 'utilisateur_manquant');
    }

    $resultat = salfa_amorcer([
        'hote' => $hote,
        'port' => $port,
        'base' => $base,
        'utilisateur' => $utilisateur,
        'mot_de_passe' => $motDePasse,
    ]);

    return [
        'ok' => true,
        'message' => 'Serveur préparé : base « ' . $resultat['base'] . ' », ' . $resultat['tables'] . ' tables.',
        'base' => $resultat['base'],
        'tables' => $resultat['tables'],
        'hote' => $resultat['hote'],
        'comptes' => [
            'administrateur' => (string) salfa_config()['compte_admin'],
            'comptable' => (string) salfa_config()['compte_comptable'],
        ],
    ];
});

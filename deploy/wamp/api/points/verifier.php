<?php
/**
 * GET api/verifier.php — diagnostic complet, sans authentification.
 *
 * Renvoie l'état de PHP, PDO MySQL, la configuration, la connexion à la base,
 * la présence des tables et du compte administrateur. Lisible par un humain
 * comme par un script : aucune installation n'est nécessaire pour l'interroger.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('verifier', function (): array {
    salfa_exiger_methode('GET');

    $controles = [];
    $ajouter = function (string $nom, bool $ok, string $detail) use (&$controles): void {
        $controles[] = ['controle' => $nom, 'ok' => $ok, 'detail' => $detail];
    };

    $ajouter('PHP', version_compare(PHP_VERSION, '8.1', '>='), PHP_VERSION . (version_compare(PHP_VERSION, '8.1', '>=') ? '' : ' — PHP 8.1 ou plus est requis'));
    $ajouter('PHP 64 bits', PHP_INT_SIZE >= 8, PHP_INT_SIZE >= 8
        ? 'oui, montants jusqu’à ' . number_format(SALFA_MONTANT_MAX, 0, ',', ' ') . ' Ar'
        : 'non : PHP 32 bits, montants plafonnés à ' . number_format(SALFA_MONTANT_MAX, 0, ',', ' ') . ' Ar — installer un PHP 64 bits');
    $ajouter('PDO MySQL', extension_loaded('pdo_mysql'), extension_loaded('pdo_mysql') ? 'disponible' : 'absent : activer php_pdo_mysql dans WAMP');
    $ajouter('mbstring', extension_loaded('mbstring'), extension_loaded('mbstring') ? 'disponible' : 'absent : activer php_mbstring dans WAMP');
    $ajouter('json', extension_loaded('json'), extension_loaded('json') ? 'disponible' : 'absent');
    $ajouter('sessions PHP', function_exists('session_start'), function_exists('session_start') ? 'disponibles' : 'absentes');
    $configure = salfa_est_configure();
    $ajouter('configuration', $configure, $configure
        ? 'présente : ' . salfa_chemin_affiche()
        : 'absente : elle sera créée au premier appel avec les accès MySQL par défaut de WampServer');
    $dossierData = dirname(salfa_chemin_config());
    $ajouter('dossier de configuration inscriptible', is_writable($dossierData) || is_file(salfa_chemin_config()), $dossierData);

    $base = 'non testée';
    $tables = [];
    $admin = 0;
    if ($configure) {
        try {
            salfa_pdo();
            $base = 'connectée';
            $prefixe = salfa_prefixe();
            $tables = salfa_pdo()->query('SHOW TABLES LIKE ' . salfa_pdo()->quote($prefixe . '%'))->fetchAll(PDO::FETCH_COLUMN);
            $admin = (int) salfa_pdo()->query('SELECT COUNT(*) FROM ' . salfa_table('utilisateurs') . " WHERE role = 'admin' AND actif = 1")->fetchColumn();
            $ajouter('connexion MySQL', true, 'base « ' . salfa_config()['base'] . ' » sur ' . salfa_config()['hote']);
            $ajouter('tables', count($tables) >= 14, count($tables) . ' table(s) trouvée(s) : ' . implode(', ', $tables));
            $ajouter('compte administrateur', $admin > 0, $admin > 0 ? $admin . ' compte(s) actif(s)' : 'aucun : le premier appel de l’API en recrée un');
            $livre = salfa_charger_livre();
            $entetes = array_values(array_filter(
                array_keys((array) ($livre['entetes'] ?? [])),
                static fn (string $cle): bool => $cle === 'depense' || $cle === 'recette'
            ));
            $ajouter('en-têtes de bordereau', true, $entetes === [] ? 'livrés par défaut' : 'personnalisés : ' . implode(', ', $entetes));
            $ajouter('livre', true, 'révision ' . $livre['revision'] . ', exercice ' . ($livre['parametres']['exercice'] ?? 'non défini'));
        } catch (Throwable $e) {
            $base = 'en échec';
            $ajouter('connexion MySQL', false, $e->getMessage());
        }
    }

    // L'interface compilée annonce sa version dans une balise <meta> : si elle
    // diffère de SALFA_VERSION_API, le paquet a été recopié en partie seulement.
    $page = @file_get_contents(__DIR__ . '/../../index.html');
    $versionInterface = is_string($page) && preg_match('/<meta name="salfa-version" content="([^"]+)"/', $page, $m) ? $m[1] : null;
    $ajouter('version du paquet', $versionInterface === SALFA_VERSION_API, $versionInterface === null
        ? 'interface compilée sans numéro de version : recopiez index.html du paquet ' . SALFA_VERSION_API
        : 'interface ' . $versionInterface . ' / API ' . SALFA_VERSION_API);

    $echecs = count(array_filter($controles, fn (array $c): bool => !$c['ok']));
    return [
        'ok' => $echecs === 0,
        'application' => 'CAISSE SALFA',
        'versionApi' => SALFA_VERSION_API,
        'versionInterface' => $versionInterface,
        'php' => PHP_VERSION,
        'base' => $base,
        'tables' => count($tables),
        'administrateurs' => $admin,
        'echecs' => $echecs,
        'controles' => $controles,
        'conseil' => $echecs === 0
            ? 'Serveur prêt : ouvrez index.html et connectez-vous.'
            : 'Corrigez les lignes « ok: false » ci-dessus, puis rechargez cette page.',
    ];
});

<?php
/**
 * CAISSE SALFA — API REST PHP/MySQL
 * Configuration lue depuis api/salfa-config.php (créé par outils/installer.bat).
 * Aucune dépendance externe : PDO + extensions standard de WAMP.
 */

declare(strict_types=1);

if (!defined('SALFA_API')) {
    define('SALFA_API', true);
}

/**
 * Version du paquet WAMP (interface compilée + API PHP). Elle accompagne le
 * numéro de `package.json` : `api/sante.php` et `api/verifier.php` la renvoient,
 * et le pied de page de l'application l'affiche pour repérer un paquet
 * partiellement mis à jour.
 */
const SALFA_VERSION_API = '1.2.0';

const SALFA_ANNEE_MIN = 1900;
const SALFA_ANNEE_MAX = 9999;
// 999 999 999 999 ne tient pas dans un entier signé 32 bits : sur un PHP
// compilé en 32 bits (WAMP x86), le littéral devient un flottant et la
// validation, écrite en strict_types, lève alors un TypeError sur chaque
// écriture. On retombe sur 2 000 000 000 Ar et le diagnostic recommande un PHP 64 bits.
if (!defined('SALFA_MONTANT_MAX')) {
    define('SALFA_MONTANT_MAX', PHP_INT_SIZE >= 8 ? 999999999999 : 2000000000);
}
const SALFA_MAX_DETAILS = 200;
const SALFA_MAX_ECRITURES = 10000;
const SALFA_MAX_CLOTURES = 400;
// En-têtes imprimables : mêmes bornes que l'application (1 Mo d'image, 300 Ko de logo).
const MAX_IMAGE_ENTETE = 1024 * 1024;
const MAX_LOGO_ENTETE = 300 * 1024;
const MAX_LIGNES_ENTETE = 24;
const MAX_IMAGES_ENTETE = 20;
// Catégories de saisie : listes séparées pour les recettes et les dépenses.
const MAX_CATEGORIES = 200;
const MAX_LONGUEUR_CATEGORIE = 120;
const SALFA_DEFAUT_LIMITE = 60;      // tentatives par fenêtre
const SALFA_DEFAUT_FENETRE = 60;     // secondes

function salfa_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    // Configuration dans data/ (hors web) ou, à défaut, à côté de l'API.
    $fichier = dirname(__DIR__) . '/data/salfa-config.php';
    if (!is_file($fichier)) {
        $fichier = __DIR__ . '/salfa-config.php';
    }
    $valeurs = [
        'hote' => '127.0.0.1',
        'port' => 3306,
        'base' => 'caisse_salfa',
        'utilisateur' => 'root',
        'mot_de_passe' => '',
        'prefixe' => 'salfa_',
        'prefixe_session' => 'salfa_session_',
        'mode_session' => 'mixte',      // 'mixte' (PHP + MySQL) ou 'mysql' (sessions uniquement en base)
        'sel_session' => 'changez-ce-sel',
        'debug' => false,
        'limite_requetes' => SALFA_DEFAUT_LIMITE,
        'fenetre_requetes' => SALFA_DEFAUT_FENETRE,
        'timezone' => 'Indian/Antananarivo',
    ];
    if (is_file($fichier)) {
        /** @var array $importe */
        $importe = require $fichier;
        if (is_array($importe)) {
            $valeurs = array_merge($valeurs, $importe);
        }
    }
    if (getenv('SALFA_DB_HOST') !== false) {
        $valeurs['hote'] = (string) getenv('SALFA_DB_HOST');
    }
    if (getenv('SALFA_DB_NAME') !== false) {
        $valeurs['base'] = (string) getenv('SALFA_DB_NAME');
    }
    if (getenv('SALFA_DB_USER') !== false) {
        $valeurs['utilisateur'] = (string) getenv('SALFA_DB_USER');
    }
    if (getenv('SALFA_DB_PASSWORD') !== false) {
        $valeurs['mot_de_passe'] = (string) getenv('SALFA_DB_PASSWORD');
    }
    date_default_timezone_set((string) $valeurs['timezone']);
    return $config = $valeurs;
}

function salfa_est_installe(): bool
{
    return is_file(dirname(__DIR__) . '/data/salfa-config.php')
        || is_file(__DIR__ . '/salfa-config.php')
        || getenv('SALFA_DB_NAME') !== false;
}

/** Chemin réel du fichier de configuration utilisé (null si absent). */
function salfa_fichier_config(): ?string
{
    foreach ([dirname(__DIR__) . '/data/salfa-config.php', __DIR__ . '/salfa-config.php'] as $fichier) {
        if (is_file($fichier)) {
            return $fichier;
        }
    }
    return null;
}

function salfa_prefixe(): string
{
    $p = (string) salfa_config()['prefixe'];
    return preg_match('/^[a-zA-Z0-9_]{1,32}$/', $p) ? $p : 'salfa_';
}

function salfa_prefixe_session(): string
{
    $p = (string) salfa_config()['prefixe_session'];
    return preg_match('/^[a-zA-Z0-9_]{1,32}$/', $p) ? $p : 'salfa_session_';
}

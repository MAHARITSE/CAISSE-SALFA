<?php
/**
 * CAISSE SALFA — configuration de l'API PHP/MySQL.
 *
 * Aucune installation, aucun script, aucune ligne de commande : le dossier se
 * copie dans `C:\wamp64\www\caisse-salfa` et l'API se configure elle-même au
 * premier appel.
 *
 * Déroulement du premier appel (voir `salfa_amorcer()` dans `api/lib/amorce.php`) :
 *   1. la configuration `data/salfa-config.php` est écrite avec les accès MySQL
 *      par défaut de WampServer (`root`, sans mot de passe, port 3306) ;
 *   2. la base `caisse_salfa` est créée si elle n'existe pas ;
 *   3. les tables et les données de départ sont créées (`api/installation/salfa_install.sql`) ;
 *   4. le compte administrateur et le compte comptable de départ sont créés.
 *
 * Si l'accès MySQL par défaut ne fonctionne pas (mot de passe personnalisé,
 * autre port), l'écran de connexion de l'application demande les accès et
 * appelle `api/index.php?action=configurer` : même résultat, sans fichier à
 * modifier à la main.
 *
 * Les valeurs ci-dessous ne sont que des valeurs de départ : le fichier écrit
 * dans `data/` les remplace toutes.
 */

declare(strict_types=1);

if (!defined('SALFA_API')) {
    define('SALFA_API', true);
}

/**
 * Version de l'API PHP, alignée sur `package.json` et `src/utils/version.ts`.
 * `api/index.php?action=sante` la renvoie : le pied de page signale un paquet
 * dont l'interface et l'API ne sont pas de la même version.
 */
const SALFA_VERSION_API = '1.6.0';

const SALFA_ANNEE_MIN = 1900;
const SALFA_ANNEE_MAX = 9999;
// 999 999 999 999 ne tient pas dans un entier signé 32 bits : sur un PHP
// compilé en 32 bits (WAMP x86), le littéral devient un flottant et la
// validation, écrite en strict_types, lève un TypeError sur chaque écriture.
// On retombe sur 2 000 000 000 Ar et le diagnostic recommande un PHP 64 bits.
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

/** Valeurs de départ : accès MySQL par défaut d'un WampServer standard. */
function salfa_config_defaut(): array
{
    return [
        'hote' => '127.0.0.1',
        'port' => 3306,
        'base' => 'caisse_salfa',
        'utilisateur' => 'root',
        'mot_de_passe' => '',
        'prefixe' => 'salfa_',
        'prefixe_session' => 'salfa_session_',
        'mode_session' => 'mixte',      // 'mixte' (PHP + MySQL) ou 'mysql' (sessions uniquement en base)
        // Inactivité tolérée avant déconnexion, en secondes (300 à 28800).
        // 1800 = 30 minutes : une pause ne ferme plus la caisse en pleine saisie.
        'duree_session' => 1800,
        'sel_session' => '',
        'debug' => false,
        'limite_requetes' => SALFA_DEFAUT_LIMITE,
        'fenetre_requetes' => SALFA_DEFAUT_FENETRE,
        'timezone' => 'Indian/Antananarivo',
        // Comptes créés à la première initialisation de la base.
        'compte_admin' => 'admin',
        'compte_admin_nom' => 'Administrateur',
        'compte_admin_mdp' => 'admin123',
        'compte_comptable' => 'comptable',
        'compte_comptable_nom' => 'Comptable',
        'compte_comptable_mdp' => 'comptable123',
        'initialise_le' => '',
    ];
}

/**
 * Dossier de l'application (celui qui contient `index.html` et `api/`).
 */
function salfa_racine_site(): string
{
    return dirname(__DIR__);
}

/**
 * Cibles d'écriture de la configuration, la plus discrète d'abord.
 *
 * Sur WampServer, l'application est dans `C:\wamp64\www\caisse-salfa` : la
 * configuration s'écrit dans `C:\wamp64\salfa-config.php`, que le navigateur
 * ne peut jamais atteindre. Ailleurs, elle va dans `data/salfa-config.php`,
 * dossier fermé par son `.htaccess`.
 */
function salfa_cible_config(): array
{
    $racine = salfa_racine_site();
    $parent = dirname($racine);
    $horsWeb = null;
    if (in_array(strtolower(basename($parent)), ['www', 'htdocs', 'public_html'], true)) {
        $horsWeb = dirname($parent) . DIRECTORY_SEPARATOR . 'salfa-config.php';
    }
    return [
        'hors_web' => $horsWeb,
        // À défaut, `api/data/` : jamais servi, et le dossier reste déplaçable
        // (une clé USB, un autre poste) avec sa configuration déjà faite.
        'data' => $racine . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'salfa-config.php',
    ];
}

/**
 * Emplacement du fichier de configuration : celui qui existe déjà, sinon la
 * première cible inscriptible.
 */
function salfa_chemin_config(): string
{
    static $chemin = null;
    if ($chemin !== null) {
        return $chemin;
    }
    $surcharge = getenv('SALFA_CONFIG');
    if (is_string($surcharge) && trim($surcharge) !== '') {
        return $chemin = trim($surcharge);
    }
    $cibles = array_values(array_filter(salfa_cible_config()));
    foreach ($cibles as $fichier) {
        if (is_file((string) $fichier)) {
            return $chemin = (string) $fichier;
        }
    }
    foreach ($cibles as $fichier) {
        $dossier = dirname((string) $fichier);
        if (is_dir($dossier) && is_writable($dossier)) {
            return $chemin = (string) $fichier;
        }
    }
    $data = salfa_cible_config()['data'];
    if (!is_dir(dirname($data))) {
        @mkdir(dirname($data), 0775, true);
    }
    return $chemin = $data;
}

/** Emplacements examinés pour lire une configuration déjà écrite. */
function salfa_chemins_config(): array
{
    $surcharge = getenv('SALFA_CONFIG');
    $cibles = salfa_cible_config();
    $racine = salfa_racine_site();
    return array_values(array_unique(array_filter([
        is_string($surcharge) ? trim($surcharge) : '',
        (string) $cibles['hors_web'],
        (string) $cibles['data'],
        $racine . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'salfa-config.php',
        dirname($racine) . DIRECTORY_SEPARATOR . 'salfa-config.php',
    ])));
}



/**
 * Accès MySQL et réglages de l'application.
 *
 * La lecture est volontairement tolérante : sans fichier de configuration,
 * les valeurs de départ sont renvoyées — c'est `salfa_amorcer()` qui se charge
 * ensuite de créer le fichier.
 */
function salfa_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $valeurs = salfa_config_defaut();
    foreach (salfa_chemins_config() as $fichier) {
        if ($fichier !== '' && is_file($fichier)) {
            /** @var mixed $importe */
            $importe = @include $fichier;
            if (is_array($importe)) {
                $valeurs = array_merge($valeurs, $importe);
            }
            break;
        }
    }
    foreach (['HOTE' => 'hote', 'PORT' => 'port', 'BASE' => 'base', 'USER' => 'utilisateur', 'PASSWORD' => 'mot_de_passe'] as $suffixe => $cle) {
        $valeur = getenv('SALFA_DB_' . $suffixe);
        if ($valeur !== false && $valeur !== '') {
            $valeurs[$cle] = $suffixe === 'PORT' ? (int) $valeur : (string) $valeur;
        }
    }
    if (getenv('SALFA_DEBUG') !== false) {
        $valeurs['debug'] = filter_var((string) getenv('SALFA_DEBUG'), FILTER_VALIDATE_BOOLEAN);
    }
    date_default_timezone_set((string) $valeurs['timezone']);
    return $config = $valeurs;
}

/** Réécrit la configuration (utilisé par l'amorçage et par l'écran de connexion). */
function salfa_ecrire_config(array $valeurs): string
{
    $valeurs = array_merge(salfa_config(), $valeurs);
    if (($valeurs['sel_session'] ?? '') === '') {
        $valeurs['sel_session'] = bin2hex(random_bytes(16));
    }
    $cible = salfa_chemin_config();
    $dossier = dirname($cible);
    if (!is_dir($dossier)) {
        @mkdir($dossier, 0775, true);
    }
    $contenu = "<?php\n\n// CAISSE SALFA — fichier privé, généré automatiquement.\n"
        . "// Il contient les accès MySQL : ne jamais le publier ni le versionner.\n"
        . 'return ' . var_export($valeurs, true) . ";\n";
    if (@file_put_contents($cible, $contenu, LOCK_EX) === false) {
        throw new SalFaErreur(
            'Impossible d’écrire la configuration du serveur (' . $cible . '). '
            . 'Vérifiez que le dossier est accessible en écriture pour Apache, ou définissez '
            . 'les variables d’environnement SALFA_DB_HOST / SALFA_DB_NAME / SALFA_DB_USER / SALFA_DB_PASSWORD.',
            500,
            'config_non_inscriptible'
        );
    }
    @chmod($cible, 0640);
    return $cible;
}

/** true dès qu'un fichier de configuration existe : l'API ne s'auto-crée plus. */
function salfa_est_configure(): bool
{
    foreach (salfa_chemins_config() as $fichier) {
        if ($fichier !== '' && is_file($fichier)) {
            return true;
        }
    }
    return false;
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

/** Nom de base sûr, utilisable dans un `CREATE DATABASE`. */
function salfa_nom_base_sur(): string
{
    $base = (string) salfa_config()['base'];
    return preg_match('/^[A-Za-z0-9_]{1,64}$/', $base) ? $base : 'caisse_salfa';
}

/**
 * Chemin de la configuration, raccourci pour l'affichage du diagnostic.
 * Le chemin complet n'est pas exposé intégralement : seule la fin est utile
 * pour retrouver le fichier sur le serveur.
 */
function salfa_chemin_affiche(): string
{
    $chemin = salfa_chemin_config();
    $racine = dirname(__DIR__);
    if (str_starts_with($chemin, $racine . DIRECTORY_SEPARATOR)) {
        return str_replace(DIRECTORY_SEPARATOR, '/', substr($chemin, strlen($racine) + 1));
    }
    return basename(dirname($chemin)) . '/' . basename($chemin);
}

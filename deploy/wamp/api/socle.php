<?php
/**
 * CAISSE SALFA — socle commun des fichiers d'API.
 *
 * Chaque fichier de api/points/ commence par :
 *   require __DIR__ . '/../socle.php';
 *
 * Il n'existe volontairement aucun index.php : le navigateur appelle
 * directement api/livre.php, api/ecritures.php, api/cloture.php…
 */

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/config.php';
require __DIR__ . '/lib/utile.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/validation.php';
require __DIR__ . '/lib/aide-objet.php';
require __DIR__ . '/lib/metier.php';

require __DIR__ . '/points/socle-reponse.php';

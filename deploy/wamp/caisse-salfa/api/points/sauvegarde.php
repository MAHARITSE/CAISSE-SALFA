<?php
/**
 * GET api/sauvegarde.php — deux formats, selon le paramètre `format`.
 *
 *   ?format=sql   (défaut) le fichier .sql de la base : structure + données,
 *                 réimportable tel quel dans phpMyAdmin. Réservé à
 *                 l'administrateur : il contient les comptes et leurs hachages.
 *   ?format=json  le livre au format de l'application, pour repartir d'une
 *                 caisse neuve. Accessible au comptable.
 */

declare(strict_types=1);

require_once __DIR__ . '/../socle.php';

salfa_point('sauvegarde', function (): array {
    salfa_exiger_methode('GET');
    salfa_demarrer_session();

    $format = strtolower(trim((string) ($_GET['format'] ?? 'sql')));

    if ($format === 'json') {
        salfa_exiger_role('comptable');
        return ['ok' => true, 'sauvegarde' => salfa_charger_livre(), 'exportedAt' => gmdate('c')];
    }
    if ($format !== 'sql') {
        throw new SalFaErreur('Format de sauvegarde inconnu : « ' . $format . ' ». Utilisez sql ou json.', 400, 'format_inconnu');
    }

    // Le .sql contient les comptes : réservé à l'administrateur.
    $utilisateur = salfa_exiger_role('admin');
    $export = salfa_exporter_sql();
    salfa_journaliser('sauvegarde_sql', (int) $utilisateur['id'], 'succes', $export['nom']);

    // Réponse en fichier joint : le navigateur télécharge, il n'affiche pas.
    http_response_code(200);
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['nom'] . '"');
    header('Content-Length: ' . (string) strlen($export['contenu']));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo $export['contenu'];
    exit;
});

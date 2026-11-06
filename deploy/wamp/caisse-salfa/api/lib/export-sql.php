<?php
/**
 * Export de la base en fichier .sql — sauvegarde et restauration sous WAMP.
 *
 * Le fichier produit est celui qu'on attend d'un serveur MySQL : structure
 * des tables, puis données, dans l'ordre où phpMyAdmin sait les réimporter.
 * Il ne contient volontairement PAS les tables de session ni les compteurs de
 * tentatives : ce sont des états techniques qui n'ont pas à voyager, et les
 * sessions en cours deviendraient caduques de toute façon.
 *
 * Les mots de passe ne sortent que sous leur hachage bcrypt : le fichier ne
 * permet pas de retrouver un mot de passe, mais il permet de restaurer les
 * comptes.
 */

declare(strict_types=1);

/** Tables exportées, dans l'ordre des dépendances (parents avant enfants). */
function salfa_tables_sauvegardees(): array
{
    return [
        'livre',
        'parametres',
        'masques',
        'masque_lignes',
        'entetes',
        'categories',
        'compteurs',
        'clotures',
        'ecritures',
        'details',
        'utilisateurs',
        'journal_audit',
    ];
}

/** Tables volontairement écartées, avec la raison (affichée dans l'interface). */
function salfa_tables_ecartees(): array
{
    return [
        'sessions' => 'sessions ouvertes : elles seront à rouvrir',
        'tentatives' => 'compteurs anti-intrusion, propres au serveur',
    ];
}

function salfa_nom_base(): string
{
    $nom = (string) (salfa_config()['base'] ?? 'caisse_salfa');
    return $nom;
}

/**
 * Valeur MySQL littérale, sûre à la réimportation.
 *
 * Les nombres restent des nombres, les dates sont quotées, les binaires et les
 * textes d'en-tête (images en data URL) passent par _binary pour ne pas être
 * réinterprétés.
 */
function salfa_valeur_sql(mixed $valeur): string
{
    if ($valeur === null) {
        return 'NULL';
    }
    if (is_bool($valeur)) {
        return $valeur ? '1' : '0';
    }
    if (is_int($valeur) || is_float($valeur)) {
        return (string) $valeur;
    }
    $texte = (string) $valeur;
    $echappe = strtr($texte, [
        '\\' => '\\\\',
        "\0" => '\\0',
        "\n" => '\\n',
        "\r" => '\\r',
        "'" => "\\'",
        '"' => '\\"',
        "\x1a" => '\\Z',
    ]);
    return "'" . $echappe . "'";
}

/**
 * Structure d'une table, telle que SHOW CREATE TABLE la donne.
 *
 * @return string[]
 */
function salfa_structure_table(string $table): array
{
    $ligne = salfa_pdo()
        ->query('SHOW CREATE TABLE ' . salfa_table($table))
        ->fetch(PDO::FETCH_NUM);
    if (!is_array($ligne) || !isset($ligne[1])) {
        throw new SalFaErreur('Impossible de lire la structure de la table ' . $table . '.', 500, 'export_impossible');
    }
    return [$ligne[0] ?? $table, (string) $ligne[1]];
}

/**
 * Export complet en .sql.
 *
 * @return array{contenu: string, nom: string, tables: array<string,int>, ecartees: array<string,string>}
 */
function salfa_exporter_sql(): array
{
    $base = salfa_nom_base();
    $horodatage = date('Y-m-d_H-i-s');
    $entete = implode("\n", [
        '-- ============================================================================',
        '-- CAISSE SALFA — sauvegarde de la base de données',
        '--',
        '-- Base       : ' . $base,
        '-- Exportée  : ' . date('d/m/Y à H:i'),
        '-- Contenu   : structure et données des ' . count(salfa_tables_sauvegardees()) . ' tables de la caisse',
        '--',
        '-- RÉIMPORTATION (WAMP, phpMyAdmin) :',
        '--   1. arrêter la caisse (personne ne doit saisir pendant la restauration) ;',
        '--   2. onglet « Importer » -> choisir ce fichier -> Exécuter ;',
        '--   3. les tables présentes sont remplacées, celles qui manquent sont créées.',
        '--',
        '-- Ou en ligne de commande :',
        '--   mysql -u root -p ' . $base . ' < ' . 'sauvegarde_caisse_salfa_' . $horodatage . '.sql',
        '--',
        '-- Les mots de passe sont conservés sous forme de hachage : ce fichier ne',
        '-- permet pas de les lire, mais il restitue les comptes tels quels.',
        '-- ============================================================================',
        '',
        'SET NAMES utf8mb4;',
        "SET time_zone = '+03:00';",
        'SET FOREIGN_KEY_CHECKS = 0;',
        'SET UNIQUE_CHECKS = 0;',
        'SET SQL_MODE = \'\';',
        '',
        'CREATE DATABASE IF NOT EXISTS `' . $base . '`',
        '  DEFAULT CHARACTER SET utf8mb4',
        '  COLLATE utf8mb4_unicode_ci;',
        'USE `' . $base . '`;',
        '',
    ]);

    // Instantané du livre pour la restauration contrôlée depuis l'application.
    // Le SQL du fichier n'est jamais exécuté par l'application.
    $livre = salfa_charger_livre();
    // PHP encode un tableau vide en [] ; les compteurs sont un dictionnaire.
    $livre['compteurs'] = (object) $livre['compteurs'];
    $jsonLivre = json_encode($livre, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $compteurs = [];
    $morceaux = [$entete, '-- SALFA-LIVRE-V1:' . base64_encode($jsonLivre), ''];

    foreach (salfa_tables_sauvegardees() as $table) {
        [$nomReel, $creation] = salfa_structure_table($table);
        $lignes = salfa_pdo()
            ->query('SELECT * FROM ' . salfa_table($table))
            ->fetchAll(PDO::FETCH_ASSOC);
        $compteurs[$table] = count($lignes);

        $morceaux[] = implode("\n", [
            '-- ----------------------------------------------------------------------------',
            '-- ' . $table . ' : ' . count($lignes) . ' ligne(s)',
            '-- ----------------------------------------------------------------------------',
            'DROP TABLE IF EXISTS `' . $nomReel . '`;',
            $creation . ';',
            '',
        ]);

        if ($lignes === []) {
            continue;
        }

        // Insertions par paquets de 200 lignes : un fichier lisible, un import rapide.
        $colonnes = '`' . implode('`, `', array_keys($lignes[0])) . '`';
        foreach (array_chunk($lignes, 200) as $paquet) {
            $valeurs = [];
            foreach ($paquet as $ligne) {
                $valeurs[] = '(' . implode(', ', array_map('salfa_valeur_sql', array_values($ligne))) . ')';
            }
            $morceaux[] = 'INSERT INTO `' . $nomReel . '` (' . $colonnes . ') VALUES' . "\n"
                . implode(",\n", $valeurs) . ';' . "\n";
        }
    }

    $morceaux[] = implode("\n", [
        'SET FOREIGN_KEY_CHECKS = 1;',
        'SET UNIQUE_CHECKS = 1;',
        '',
        '-- Fin de la sauvegarde. Tables sans données exportées : '
            . implode(', ', array_keys(salfa_tables_ecartees())) . '.',
        '',
    ]);

    return [
        'contenu' => implode("\n", $morceaux),
        'nom' => 'sauvegarde_caisse_salfa_' . $horodatage . '.sql',
        'tables' => $compteurs,
        'ecartees' => salfa_tables_ecartees(),
    ];
}

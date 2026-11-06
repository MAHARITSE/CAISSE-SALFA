<?php
/**
 * Endpoints métier : le serveur applique les mêmes règles que l'application.
 * Les mutations sont toujours exécutées dans la transaction de salfa_transaction(),
 * qui verrouille la ligne du livre et contrôle la révision.
 */

declare(strict_types=1);

/** Insertion ou mise à jour d'une écriture, selon qu'elle existe déjà. */
function salfa_enregistrer_ecriture(array $e): array
{
    $exercice = salfa_exercice_ouvert();
    $valide = salfa_valider_ecriture($e, $exercice);
    $identifiant = (string) $valide['id'];

    $existante = salfa_executer(
        'SELECT id, numero, sens, cree_le, annee_archive FROM ' . salfa_table('ecritures') . ' WHERE id = ? FOR UPDATE',
        [$identifiant]
    )->fetch();

    if ($existante) {
        if ($existante['annee_archive'] !== null) {
            throw new SalFaErreur('Cette écriture appartient à un exercice clôturé : elle ne peut plus être modifiée.', 409, 'exercice_archive');
        }
        $numero = (string) $existante['numero'];
        $sens = (string) $existante['sens'];
        $creeLe = (string) $existante['cree_le'];
    } else {
        $numero = salfa_prochain_numero($valide['sens'], $valide['date']);
        $sens = $valide['sens'];
        $creeLe = salfa_mysql_datetime($valide['createdAt'], (string) salfa_config()['timezone']);
    }

    // Un numéro ne doit jamais être réutilisé par une autre pièce.
    $conflit = salfa_executer(
        'SELECT id FROM ' . salfa_table('ecritures') . ' WHERE numero = ? AND id <> ?',
        [$numero, $identifiant]
    )->fetch();
    if ($conflit) {
        throw new SalFaErreur('Ce numéro de pièce est déjà utilisé : rechargez le livre.', 409, 'numero_duplique');
    }

    if ($existante) {
        salfa_executer(
            'UPDATE ' . salfa_table('ecritures') . ' SET libelle = ?, categorie = ?, tiers = ?, reference = ?, observation = ?, montant = ?, modifie_le = NOW(3) WHERE id = ?',
            [
                $valide['libelle'], $valide['categorie'], $valide['tiers'] ?: null, $valide['reference'] ?: null,
                $valide['observation'] ?: null, $valide['montant'], $identifiant,
            ]
        );
        salfa_executer('DELETE FROM ' . salfa_table('details') . ' WHERE ecriture_id = ?', [$identifiant]);
    } else {
        salfa_executer(
            'INSERT INTO ' . salfa_table('ecritures') . ' (id, numero, date, sens, libelle, categorie, tiers, reference, observation, montant, annee_archive, cree_le, modifie_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)',
            [
                $identifiant, $numero, $valide['date'], $sens, $valide['libelle'], $valide['categorie'],
                $valide['tiers'] ?: null, $valide['reference'] ?: null, $valide['observation'] ?: null,
                $valide['montant'], $creeLe,
            ]
        );
    }
    foreach ($valide['lignesDetail'] ?? [] as $ordre => $ligne) {
        salfa_executer(
            'INSERT INTO ' . salfa_table('details') . ' (id, ecriture_id, libelle, reference, montant, ordre) VALUES (?, ?, ?, ?, ?, ?)',
            [$ligne['id'], $identifiant, $ligne['libelle'], $ligne['reference'] ?: null, $ligne['montant'], $ordre]
        );
    }
    salfa_incrementer_revision();
    return ['numero' => $numero];
}

function salfa_supprimer_ecriture(string $id): void
{
    salfa_verifier_non_archive(salfa_id($id));
    $supprimees = salfa_executer('DELETE FROM ' . salfa_table('ecritures') . ' WHERE id = ?', [$id])->rowCount();
    if ($supprimees === 0) {
        throw new SalFaErreur('Cette écriture n’existe plus : rechargez le livre.', 404, 'ecriture_absente');
    }
    salfa_executer('DELETE FROM ' . salfa_table('details') . ' WHERE ecriture_id = ?', [$id]);
    salfa_incrementer_revision();
}

function salfa_restaurer_ecriture(array $e): void
{
    $exercice = salfa_exercice_ouvert();
    $valide = salfa_valider_ecriture($e, $exercice);
    $existe = salfa_executer(
        'SELECT id FROM ' . salfa_table('ecritures') . ' WHERE id = ? OR LOWER(numero) = LOWER(?)',
        [$valide['id'], $valide['numero']]
    )->fetch();
    if ($existe) {
        throw new SalFaErreur('Cette pièce existe déjà : annulation impossible.', 409, 'ecriture_existante');
    }
    salfa_inserer_ecriture($valide, null);
    salfa_incrementer_revision();
}

/** Insertion bas niveau, partagée par la restauration d'une pièce et l'import complet. */
function salfa_inserer_ecriture(array $valide, ?int $anneeArchive): void
{
    $fuseau = (string) salfa_config()['timezone'];
    salfa_executer(
        'INSERT INTO ' . salfa_table('ecritures') . ' (id, numero, date, sens, libelle, categorie, tiers, reference, observation, montant, annee_archive, cree_le, modifie_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $valide['id'], $valide['numero'], $valide['date'], $valide['sens'], $valide['libelle'],
            $valide['categorie'], $valide['tiers'] ?: null, $valide['reference'] ?: null,
            $valide['observation'] ?: null, $valide['montant'], $anneeArchive,
            salfa_mysql_datetime($valide['createdAt'], $fuseau),
            $valide['updatedAt'] === null ? null : salfa_mysql_datetime($valide['updatedAt'], $fuseau),
        ]
    );
    foreach ($valide['lignesDetail'] ?? [] as $ordre => $ligne) {
        salfa_executer(
            'INSERT INTO ' . salfa_table('details') . ' (id, ecriture_id, libelle, reference, montant, ordre) VALUES (?, ?, ?, ?, ?, ?)',
            [$ligne['id'], $valide['id'], $ligne['libelle'], $ligne['reference'] ?: null, $ligne['montant'], $ordre]
        );
    }
}

/**
 * Remplace les catégories d'un sens et renvoie leur nombre.
 *
 * Les libellés sont nettoyés et dédoublonnés sans tenir compte de la casse ;
 * une liste vide est refusée, sinon la saisie n'aurait plus aucune catégorie.
 */
function salfa_enregistrer_categories(string $sens, array $categories): int
{
    $propre = [];
    $vues = [];
    foreach ($categories as $brute) {
        if (!is_string($brute)) {
            continue;
        }
        $nom = trim($brute);
        if ($nom === '') {
            continue;
        }
        if (mb_strlen($nom) > MAX_LONGUEUR_CATEGORIE) {
            $nom = mb_substr($nom, 0, MAX_LONGUEUR_CATEGORIE);
        }
        $cle = mb_strtolower($nom);
        if (isset($vues[$cle])) {
            continue;
        }
        $vues[$cle] = true;
        $propre[] = $nom;
        if (count($propre) > MAX_CATEGORIES) {
            throw new SalFaErreur('Trop de catégories : ' . MAX_CATEGORIES . ' au maximum.', 400, 'categories_trop_nombreuses');
        }
    }
    if ($propre === []) {
        throw new SalFaErreur('La liste des catégories ne peut pas être vide.', 400, 'categories_vides');
    }

    salfa_executer('DELETE FROM ' . salfa_table('categories') . ' WHERE sens = ?', [$sens]);
    foreach ($propre as $ordre => $nom) {
        salfa_executer(
            'INSERT INTO ' . salfa_table('categories') . ' (sens, nom, ordre) VALUES (?, ?, ?)',
            [$sens, $nom, $ordre]
        );
    }
    salfa_incrementer_revision();
    return count($propre);
}

/** Les catégories enregistrées, prêtes à être renvoyées au navigateur. */
function salfa_charger_categories(): array
{
    $lignes = salfa_pdo()->query('SELECT sens, nom FROM ' . salfa_table('categories') . ' ORDER BY sens, ordre, nom')->fetchAll();
    $resultat = [];
    foreach ($lignes as $l) {
        $resultat[strtolower((string) $l['sens'])][] = (string) $l['nom'];
    }
    return [
        'recette' => $resultat['recette'] ?? [],
        'depense' => $resultat['depense'] ?? [],
    ];
}

/**
 * Enregistre l'en-tête d'un bordereau.
 *
 * Le serveur ne fait pas confiance au navigateur : le mode est ramené à une
 * valeur connue, les images ne sont acceptées que si elles sont de vraies
 * data URL PNG/JPEG sous la limite, et les lignes sont filtrées puis bornées.
 */
function salfa_enregistrer_entete(string $document, array $entete): void
{
    $mode = ($entete['mode'] ?? 'textes') === 'image' ? 'image' : 'textes';
    $image = salfa_image_entete($entete['image'] ?? null, MAX_IMAGE_ENTETE);

    $lignes = [];
    $brutes = is_array($entete['lignes'] ?? null) ? $entete['lignes'] : [];
    foreach (array_slice($brutes, 0, MAX_LIGNES_ENTETE) as $ligne) {
        if (!is_array($ligne)) {
            continue;
        }
        $texte = trim((string) ($ligne['texte'] ?? ''));
        if (mb_strlen($texte) > 200) {
            $texte = mb_substr($texte, 0, 200);
        }
        // Demi-points conservés : les tailles du modèle (9,5 · 10,5) ne dérivent pas.
        $taille = round(max(6.0, min(40.0, (float) ($ligne['taille'] ?? 9))) * 2) / 2;
        $alignement = (string) ($ligne['alignement'] ?? 'centre');
        $lignes[] = [
            'texte' => $texte,
            'gras' => ($ligne['gras'] ?? false) === true,
            'italique' => ($ligne['italique'] ?? false) === true,
            'souligne' => ($ligne['souligne'] ?? false) === true,
            'taille' => $taille,
            'police' => salfa_police_entete($ligne['police'] ?? null),
            'alignement' => in_array($alignement, ['gauche', 'centre', 'droite'], true) ? $alignement : 'centre',
        ];
    }

    $images = [];
    $brutesImages = is_array($entete['images'] ?? null) ? $entete['images'] : [];
    foreach (array_slice($brutesImages, 0, MAX_IMAGES_ENTETE) as $index => $imageBrute) {
        if (!is_array($imageBrute)) {
            continue;
        }
        $source = salfa_image_entete($imageBrute['source'] ?? null, MAX_LOGO_ENTETE);
        if ($source === '') {
            continue;
        }
        $id = (string) ($imageBrute['id'] ?? '');
        $images[] = [
            'id' => $id !== '' ? mb_substr($id, 0, 60) : 'image-' . ($index + 1),
            'source' => $source,
            'x' => round(max(-20.0, min(210.0, (float) ($imageBrute['x'] ?? 7.6))), 1),
            'y' => round(max(-20.0, min(297.0, (float) ($imageBrute['y'] ?? 13))), 1),
            'largeur' => round(max(3.0, min(120.0, (float) ($imageBrute['largeur'] ?? 16))), 1),
            'alt' => mb_substr((string) ($imageBrute['alt'] ?? 'Image de l’en-tête'), 0, 120),
        ];
    }

    $rempli = array_values(array_filter($lignes, static fn (array $l): bool => trim($l['texte']) !== ''));
    if ($mode === 'image' && $image === '') {
        throw new SalFaErreur('Choisissez l’image de l’en-tête avant d’enregistrer.', 400, 'entete_vide');
    }
    if ($mode === 'textes' && $rempli === []) {
        throw new SalFaErreur('Renseignez au moins une ligne de texte avant d’enregistrer.', 400, 'entete_vide');
    }

    // Un seul en-tête : la ligne « depense » porte celle des deux imprimés.
    salfa_executer(
        'INSERT INTO ' . salfa_table('entetes') . ' (document, mode, image, lignes, images) VALUES (?, ?, ?, ?, ?)'
            . ' ON DUPLICATE KEY UPDATE mode = VALUES(mode), image = VALUES(image), lignes = VALUES(lignes), images = VALUES(images)',
        [
            'depense',
            $mode,
            $image === '' ? null : $image,
            json_encode($lignes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode($images, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]
    );
    salfa_incrementer_revision();
}

/** Les polices proposées par l'éditeur, par ordre de préférence. */
function salfa_police_entete($valeur): string
{
    $connues = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'];
    return is_string($valeur) && in_array($valeur, $connues, true) ? $valeur : 'Arial';
}

/** Un seul en-tête : la ligne « depense » fait foi, les logos sont repris si besoin. */
function salfa_charger_entetes(): array
{
    $lignes = salfa_pdo()->query('SELECT * FROM ' . salfa_table('entetes'))->fetchAll();
    $resultat = null;
    foreach ($lignes as $l) {
        $texte = json_decode((string) ($l['lignes'] ?? ''), true);
        $images = json_decode((string) ($l['images'] ?? ''), true);
        $entete = [
            'mode' => ((string) $l['mode']) === 'image' ? 'image' : 'textes',
            'image' => (string) ($l['image'] ?? ''),
            'lignes' => is_array($texte) ? $texte : [],
            'images' => is_array($images) ? $images : [],
        ];
        if ($entete['images'] === []) {
            foreach ([['logo-gauche', 7.6, 13, 15], ['logo-droit', 181, 13, 18]] as [$id, $x, $y, $largeur]) {
                $colonne = $id === 'logo-gauche' ? 'logo_gauche' : 'logo_droit';
                $source = (string) ($l[$colonne] ?? '');
                if ($source !== '') {
                    $entete['images'][] = [
                        'id' => $id, 'source' => $source, 'x' => $x, 'y' => $y,
                        'largeur' => $largeur, 'alt' => 'Logo',
                    ];
                }
            }
        }
        if ($resultat === null || (string) $l['document'] === 'depense') {
            $resultat = $entete;
        }
    }
    return $resultat ?? [];
}


/** N'accepte qu'une data URL PNG/JPEG sous la limite annoncée. */
function salfa_image_entete($valeur, int $limite): string
{
    if (!is_string($valeur) || $valeur === '') {
        return '';
    }
    if (!preg_match('#^data:image/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$#', $valeur)) {
        throw new SalFaErreur('Les images de l’en-tête doivent être des PNG ou JPEG.', 400, 'image_invalide');
    }
    if (strlen($valeur) > $limite) {
        throw new SalFaErreur('Image trop lourde pour l’en-tête (1 Mo maximum).', 400, 'image_trop_lourde');
    }
    return $valeur;
}

function salfa_enregistrer_masques(array $masques): void
{
    $valides = salfa_valider_masques($masques);
    salfa_executer('DELETE FROM ' . salfa_table('masque_lignes'));
    salfa_executer('DELETE FROM ' . salfa_table('masques'));
    foreach ($valides as $m) {
        salfa_executer(
            'INSERT INTO ' . salfa_table('masques') . ' (id, nom, sens, description, ordre) VALUES (?, ?, ?, ?, ?)',
            [$m['id'], $m['nom'], $m['sens'], $m['description'] ?: null, $m['ordre']]
        );
        foreach ($m['lignes'] as $ligne) {
            salfa_executer(
                'INSERT INTO ' . salfa_table('masque_lignes') . ' (masque_id, description, montant_defaut, ordre) VALUES (?, ?, ?, ?)',
                [$m['id'], $ligne['description'], $ligne['montantDefaut'], $ligne['ordre']]
            );
        }
    }
    salfa_incrementer_revision();
}

/** Un compteur ne recule jamais : il protège les numéros déjà attribués. */
function salfa_fusionner_compteurs(array $compteurs, ?int $exercice = null): void
{
    foreach ($compteurs as $cle => $valeur) {
        if (!preg_match('/^(RC|DP)-(\d{4})$/', (string) $cle)) {
            throw new SalFaErreur('Compteur invalide : ' . $cle, 400, 'compteur_invalide');
        }
        if ($exercice !== null && substr((string) $cle, 3) !== (string) $exercice) {
            throw new SalFaErreur('Un compteur ne peut concerner qu’un exercice archivé.', 400, 'compteur_invalide');
        }
        $entier = is_int($valeur) ? $valeur : (is_string($valeur) && preg_match('/^\d+$/', $valeur) ? (int) $valeur : -1);
        if ($entier < 0 || $entier > 1000000000) {
            throw new SalFaErreur('Valeur de compteur invalide.', 400, 'compteur_invalide');
        }
        salfa_executer(
            'INSERT INTO ' . salfa_table('compteurs') . ' (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = GREATEST(valeur, VALUES(valeur))',
            [$cle, $entier]
        );
    }
}

function salfa_cloturer(array $corps): void
{
    $pdo = salfa_pdo();
    $pdo->beginTransaction();
    try {
        salfa_verrouiller_livre();
        $parametres = salfa_parametres();
        $exercice = (int) $parametres['exercice'];
        $revision = salfa_revision_attendue($corps);
        $reelle = (int) salfa_pdo()->query('SELECT revision FROM ' . salfa_table('livre') . ' WHERE id = 1')->fetchColumn();
        if ($revision !== $reelle) {
            throw new SalFaErreur(
                'Le livre a été modifié dans un autre onglet ou par un autre utilisateur. Rechargez les données avant d’enregistrer.',
                409,
                'conflit_revision'
            );
        }

        $archive = $corps['archive'] ?? null;
        if (!is_array($archive)) {
            throw new SalFaErreur('Archive d’exercice manquante.', 400, 'archive_manquante');
        }
        $annee = salfa_entier($archive, 'annee', SALFA_ANNEE_MIN, SALFA_ANNEE_MAX);
        if ($annee !== $exercice) {
            throw new SalFaErreur('L’archive ne correspond pas à l’exercice ouvert (' . $exercice . ').', 409, 'archive_incoherente');
        }
        // Une année ne se clôture qu'une fois révolue, jamais pendant son déroulement.
        if ((int) date('Y') <= $annee) {
            throw new SalFaErreur(
                'L’exercice ' . $annee . ' ne peut être clôturé qu’à partir du 1er janvier ' . ($annee + 1) . ', une fois l’année révolue.',
                409,
                'annee_en_cours'
            );
        }
        if (salfa_executer('SELECT annee FROM ' . salfa_table('clotures') . ' WHERE annee = ?', [$annee])->fetch()) {
            throw new SalFaErreur('L’exercice ' . $annee . ' est déjà clôturé.', 409, 'exercice_deja_cloture');
        }
        if ((int) salfa_pdo()->query('SELECT COUNT(*) FROM ' . salfa_table('ecritures') . ' WHERE annee_archive = ' . (int) $annee)->fetchColumn() > 0) {
            throw new SalFaErreur('Des écritures de ' . $annee . ' sont déjà archivées : clôture refusée.', 409, 'archive_existante');
        }

        $existantes = salfa_pdo()->query(
            'SELECT sens, montant FROM ' . salfa_table('ecritures') . ' WHERE annee_archive IS NULL ORDER BY date, cree_le, id'
        )->fetchAll();
        if (count($existantes) > SALFA_MAX_ECRITURES) {
            throw new SalFaErreur('Trop d’écritures pour une clôture.', 400, 'trop_d_ecritures');
        }
        $recettes = 0;
        $depenses = 0;
        foreach ($existantes as $e) {
            if ($e['sens'] === 'RECETTE') {
                $recettes += (int) $e['montant'];
            } else {
                $depenses += (int) $e['montant'];
            }
        }
        $ouverture = (int) $parametres['solde_initial'];
        $cloture = $ouverture + $recettes - $depenses;
        salfa_verifier_solde($ouverture, $recettes, $depenses, $cloture, 'Exercice ' . $annee);
        // Le total annoncé par le client doit correspondre au livre réellement stocké.
        if (isset($archive['soldeCloture']) && (int) $archive['soldeCloture'] !== $cloture) {
            throw new SalFaErreur('Le solde calculé par le serveur diffère de l’écran : rechargez avant de clôturer.', 409, 'solde_divergent');
        }

        salfa_executer(
            'INSERT INTO ' . salfa_table('clotures') . ' (annee, cloture_le, solde_ouverture, recettes, depenses, solde_cloture) VALUES (?, ?, ?, ?, ?, ?)',
            [$annee, salfa_mysql_datetime((string) $archive['clotureLe'], (string) salfa_config()['timezone']), $ouverture, $recettes, $depenses, $cloture]
        );
        salfa_executer('UPDATE ' . salfa_table('ecritures') . ' SET annee_archive = ? WHERE annee_archive IS NULL', [$annee]);
        salfa_executer(
            'UPDATE ' . salfa_table('parametres') . ' SET solde_initial = ?, exercice = ?, report_annee = ?, report_solde = ? WHERE id = 1',
            [$cloture, $annee + 1, $annee, $cloture]
        );
        salfa_incrementer_revision();
        $pdo->commit();
    } catch (Throwable $echec) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $echec;
    }
}

/**
 * Remplacement complet du livre par une sauvegarde JSON vérifiée.
 * Tout est validé avant la première suppression : un import invalide ne touche à rien.
 */
function salfa_restaurer_sauvegarde(array $corps): void
{
    $sauvegarde = $corps['sauvegarde'] ?? null;
    if (!is_array($sauvegarde)) {
        throw new SalFaErreur('Sauvegarde manquante.', 400, 'sauvegarde_manquante');
    }
    if (($sauvegarde['format'] ?? null) !== 'CAISSE-SALFA' || (int) ($sauvegarde['version'] ?? 0) !== 1) {
        throw new SalFaErreur('Ce fichier n’est pas une sauvegarde CAISSE SALFA version 1.', 400, 'format_invalide');
    }
    $parametres = $sauvegarde['parametres'] ?? null;
    if (!is_array($parametres)) {
        throw new SalFaErreur('Paramètres de sauvegarde manquants.', 400, 'sauvegarde_invalide');
    }
    $exercice = salfa_entier($parametres, 'exercice', SALFA_ANNEE_MIN, SALFA_ANNEE_MAX);
    $soldeInitial = salfa_entier($parametres, 'soldeInitial', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);

    $ecrituresBrutes = $sauvegarde['ecritures'] ?? [];
    if (!is_array($ecrituresBrutes) || count($ecrituresBrutes) > SALFA_MAX_ECRITURES) {
        throw new SalFaErreur('Liste d’écritures invalide ou trop volumineuse.', 400, 'sauvegarde_invalide');
    }
    $ecritures = [];
    $ids = [];
    $numeros = [];
    foreach ($ecrituresBrutes as $index => $brute) {
        if (!is_array($brute)) {
            throw new SalFaErreur('Écriture ' . ($index + 1) . ' invalide.', 400, 'sauvegarde_invalide');
        }
        $valide = salfa_valider_ecriture($brute, $exercice);
        if (isset($ids[$valide['id']]) || isset($numeros[strtolower($valide['numero'])])) {
            throw new SalFaErreur('Écriture ou numéro en double dans la sauvegarde.', 400, 'doublon');
        }
        $ids[$valide['id']] = true;
        $numeros[strtolower($valide['numero'])] = true;
        $ecritures[] = $valide;
    }

    $cloturesBrutes = $sauvegarde['exercicesClotures'] ?? [];
    if (!is_array($cloturesBrutes) || count($cloturesBrutes) > SALFA_MAX_CLOTURES) {
        throw new SalFaErreur('Exercices clôturés invalides ou trop nombreux.', 400, 'sauvegarde_invalide');
    }
    $clotures = [];
    $archives = [];
    foreach ($cloturesBrutes as $index => $brute) {
        if (!is_array($brute)) {
            throw new SalFaErreur('Exercice clôturé ' . ($index + 1) . ' invalide.', 400, 'sauvegarde_invalide');
        }
        $annee = salfa_entier($brute, 'annee', SALFA_ANNEE_MIN, SALFA_ANNEE_MAX - 1);
        if ($annee >= $exercice) {
            throw new SalFaErreur('Un exercice clôturé ne peut pas être postérieur à l’exercice ouvert.', 400, 'sauvegarde_invalide');
        }
        if (isset($clotures[$annee])) {
            throw new SalFaErreur('Exercice clôturé en double : ' . $annee . '.', 400, 'doublon');
        }
        $ouverture = salfa_entier($brute, 'soldeOuverture', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);
        $recettes = salfa_entier($brute, 'recettes', 0, SALFA_MONTANT_MAX);
        $depenses = salfa_entier($brute, 'depenses', 0, SALFA_MONTANT_MAX);
        $cloture = salfa_entier($brute, 'soldeCloture', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);
        salfa_verifier_solde($ouverture, $recettes, $depenses, $cloture, 'Exercice ' . $annee);
        $lignes = $brute['ecritures'] ?? [];
        if (!is_array($lignes)) {
            throw new SalFaErreur('Écritures de l’exercice ' . $annee . ' invalides.', 400, 'sauvegarde_invalide');
        }
        $somme = 0;
        foreach ($lignes as $ligne) {
            if (!is_array($ligne)) {
                throw new SalFaErreur('Écriture archivée invalide.', 400, 'sauvegarde_invalide');
            }
            $valide = salfa_valider_ecriture($ligne, $annee);
            if (isset($ids[$valide['id']]) || isset($numeros[strtolower($valide['numero'])])) {
                throw new SalFaErreur('Écriture ou numéro en double dans les archives.', 400, 'doublon');
            }
            $ids[$valide['id']] = true;
            $numeros[strtolower($valide['numero'])] = true;
            $archives[$annee][] = $valide;
            $somme += $valide['sens'] === 'RECETTE' ? $valide['montant'] : -$valide['montant'];
        }
        if (count($lignes) > 0) {
            salfa_verifier_solde($ouverture, $recettes, $depenses, $ouverture + $somme, 'Exercice ' . $annee);
        }
        $clotures[$annee] = [
            'annee' => $annee,
            'clotureLe' => salfa_champ($brute, 'clotureLe', 40),
            'ouverture' => $ouverture, 'recettes' => $recettes, 'depenses' => $depenses, 'cloture' => $cloture,
        ];
    }
    $annees = array_keys($clotures);
    sort($annees);
    for ($i = 1; $i < count($annees); $i++) {
        $prec = $clotures[$annees[$i - 1]];
        $cour = $clotures[$annees[$i]];
        if ($cour['annee'] === $prec['annee'] + 1 && $cour['ouverture'] !== $prec['cloture']) {
            throw new SalFaErreur('La chaîne des soldes reportés est incohérente pour ' . $cour['annee'] . '.', 400, 'sauvegarde_invalide');
        }
        if ($cour['annee'] > $prec['annee'] + 1) {
            throw new SalFaErreur('La chaîne des clôtures doit être continue jusqu’à ' . $exercice . '.', 400, 'sauvegarde_invalide');
        }
    }
    $derniere = $annees ? $clotures[end($annees)] : null;
    if ($derniere && $derniere['annee'] === $exercice - 1 && $soldeInitial !== $derniere['cloture']) {
        throw new SalFaErreur('Le solde d’ouverture ne correspond pas à la clôture de ' . $derniere['annee'] . '.', 400, 'sauvegarde_invalide');
    }

    $reportAnnee = null;
    $reportSolde = null;
    $report = $parametres['reportPrecedent'] ?? null;
    if (is_array($report) && isset($report['annee'], $report['solde'])) {
        $reportAnnee = salfa_entier($report, 'annee', SALFA_ANNEE_MIN, SALFA_ANNEE_MAX - 1);
        if ($reportAnnee !== $exercice - 1) {
            throw new SalFaErreur('Le report doit provenir de l’exercice immédiatement précédent.', 400, 'sauvegarde_invalide');
        }
        $reportSolde = salfa_entier($report, 'solde', -SALFA_MONTANT_MAX, SALFA_MONTANT_MAX);
    }

    $masques = $sauvegarde['masques'] ?? [];
    if (!is_array($masques)) {
        throw new SalFaErreur('Modèles invalides.', 400, 'sauvegarde_invalide');
    }
    $masquesValides = salfa_valider_masques($masques);
    // Les en-têtes imprimables suivent la sauvegarde ; un livre antérieur n'en a pas.
    $categoriesSauvegarde = $sauvegarde['categories'] ?? null;
    if ($categoriesSauvegarde !== null && (!is_array($categoriesSauvegarde) || !is_array($categoriesSauvegarde['recette'] ?? null) || !is_array($categoriesSauvegarde['depense'] ?? null))) {
        throw new SalFaErreur('Catégories de sauvegarde invalides.', 400, 'sauvegarde_invalide');
    }
    $entetesSauvegarde = $sauvegarde['entetes'] ?? null;
    if ($entetesSauvegarde !== null && !is_array($entetesSauvegarde)) {
        throw new SalFaErreur('En-têtes de bordereau invalides.', 400, 'sauvegarde_invalide');
    }
    $compteurs = $sauvegarde['compteurs'] ?? [];
    if (!is_array($compteurs)) {
        throw new SalFaErreur('Compteurs invalides.', 400, 'sauvegarde_invalide');
    }

    $pdo = salfa_pdo();
    $pdo->beginTransaction();
    try {
        salfa_verifier_revision(salfa_revision_attendue($corps));
        $pdo->exec('DELETE FROM ' . salfa_table('details'));
        $pdo->exec('DELETE FROM ' . salfa_table('ecritures'));
        $pdo->exec('DELETE FROM ' . salfa_table('clotures'));
        $pdo->exec('DELETE FROM ' . salfa_table('compteurs'));
        salfa_executer('UPDATE ' . salfa_table('parametres') . ' SET solde_initial = ?, exercice = ?, report_annee = ?, report_solde = ? WHERE id = 1', [$soldeInitial, $exercice, $reportAnnee, $reportSolde]);
        salfa_executer('DELETE FROM ' . salfa_table('masque_lignes'));
        salfa_executer('DELETE FROM ' . salfa_table('masques'));
        foreach ($masquesValides as $m) {
            salfa_executer('INSERT INTO ' . salfa_table('masques') . ' (id, nom, sens, description, ordre) VALUES (?, ?, ?, ?, ?)', [$m['id'], $m['nom'], $m['sens'], $m['description'] ?: null, $m['ordre']]);
            foreach ($m['lignes'] as $ligne) {
                salfa_executer('INSERT INTO ' . salfa_table('masque_lignes') . ' (masque_id, description, montant_defaut, ordre) VALUES (?, ?, ?, ?)', [$m['id'], $ligne['description'], $ligne['montantDefaut'], $ligne['ordre']]);
            }
        }
        if (is_array($categoriesSauvegarde)) {
            salfa_executer('DELETE FROM ' . salfa_table('categories'));
            salfa_enregistrer_categories('RECETTE', $categoriesSauvegarde['recette']);
            salfa_enregistrer_categories('DEPENSE', $categoriesSauvegarde['depense']);
        }
        if (is_array($entetesSauvegarde)) {
            // Un seul en-tête : un livre antérieur en portait deux, la dépense fait foi.
            $commun = is_array($entetesSauvegarde['depense'] ?? null)
                ? $entetesSauvegarde['depense']
                : (is_array($entetesSauvegarde['recette'] ?? null) ? $entetesSauvegarde['recette'] : $entetesSauvegarde);
            // La validation lève avant toute écriture partielle : la transaction protège le reste.
            salfa_enregistrer_entete('depense', $commun);
        }
        foreach ($ecritures as $valide) {
            salfa_inserer_ecriture($valide, null);
        }
        foreach ($clotures as $annee => $c) {
            salfa_executer(
                'INSERT INTO ' . salfa_table('clotures') . ' (annee, cloture_le, solde_ouverture, recettes, depenses, solde_cloture) VALUES (?, ?, ?, ?, ?, ?)',
                [$annee, salfa_mysql_datetime($c['clotureLe'], (string) salfa_config()['timezone']), $c['ouverture'], $c['recettes'], $c['depenses'], $c['cloture']]
            );
            foreach ($archives[$annee] ?? [] as $valide) {
                salfa_inserer_ecriture($valide, $annee);
            }
        }
        salfa_fusionner_compteurs($compteurs);
        salfa_incrementer_revision();
        $pdo->commit();
    } catch (Throwable $echec) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $echec;
    }
}

<?php
/**
 * Accès MySQL : connexion PDO, transactions verrouillées et lecture du snapshot.
 */

declare(strict_types=1);

function salfa_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $c = salfa_config();
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['hote'], (int) $c['port'], $c['base']);
    try {
        $pdo = new PDO($dsn, (string) $c['utilisateur'], (string) $c['mot_de_passe'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
    } catch (PDOException $e) {
        $detail = (bool) salfa_config()['debug'] ? ' ' . $e->getMessage() : '';
        throw new SalFaErreur(
            'Connexion à MySQL impossible. Vérifiez que WAMP est démarré, que la base existe et que api/salfa-config.php est correct.' . $detail,
            503,
            'base_indisponible'
        );
    }
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
    return $pdo;
}

function salfa_table(string $nom): string
{
    return '`' . salfa_prefixe() . $nom . '`';
}

function salfa_executer(string $sql, array $parametres = []): PDOStatement
{
    $requete = salfa_pdo()->prepare($sql);
    $requete->execute($parametres);
    return $requete;
}

/** Verrou de ligne : deux onglets ne peuvent pas s'écraser entre eux. */
function salfa_verrouiller_livre(): null
{
    $sql = 'SELECT id FROM ' . salfa_table('livre') . ' WHERE id = 1 FOR UPDATE';
    $ligne = salfa_pdo()->query($sql)->fetch();
    if (!$ligne) {
        throw new SalFaErreur('Livre introuvable : exécutez le script SQL d’installation.', 500, 'livre_absent');
    }
    return null;
}

/**
 * Charge le livre complet au format attendu par l'application (Sauvegarde).
 *
 * @return array<string, mixed>
 */
function salfa_charger_livre(): array
{
    $pdo = salfa_pdo();
    $libre = $pdo->query('SELECT * FROM ' . salfa_table('livre') . ' WHERE id = 1')->fetch();
    if (!$libre) {
        throw new SalFaErreur('Le livre n’est pas initialisé. Exécutez sql/salfa_install.sql.', 500, 'livre_absent');
    }
    $parametres = $pdo->query('SELECT * FROM ' . salfa_table('parametres') . ' WHERE id = 1')->fetch() ?: [];
    $masques = $pdo->query('SELECT * FROM ' . salfa_table('masques') . ' ORDER BY ordre, id')->fetchAll();
    $compteurs = $pdo->query('SELECT * FROM ' . salfa_table('compteurs') . ' ORDER BY cle')->fetchAll();
    $ecritures = $pdo->query('SELECT * FROM ' . salfa_table('ecritures') . ' ORDER BY date, cree_le, id')->fetchAll();
    $details = $pdo->query('SELECT * FROM ' . salfa_table('details') . ' ORDER BY ecriture_id, ordre, id')->fetchAll();
    $clotures = $pdo->query('SELECT * FROM ' . salfa_table('clotures') . ' ORDER BY annee')->fetchAll();

    $parEcriture = [];
    foreach ($details as $d) {
        $parEcriture[$d['ecriture_id']][] = [
            'id' => (string) $d['id'],
            'libelle' => (string) $d['libelle'],
            'reference' => $d['reference'] === null || $d['reference'] === '' ? null : (string) $d['reference'],
            'montant' => (int) $d['montant'],
            '_ordre' => (int) $d['ordre'],
        ];
    }

    $ecrituresParAnnee = [];
    foreach ($ecritures as $e) {
        $item = [
            'id' => (string) $e['id'],
            'numero' => (string) $e['numero'],
            'date' => (string) $e['date'],
            'sens' => (string) $e['sens'],
            'libelle' => (string) $e['libelle'],
            'categorie' => (string) $e['categorie'],
            'montant' => (int) $e['montant'],
            'createdAt' => salfa_iso((string) $e['cree_le']),
        ];
        if ($e['tiers'] !== null && $e['tiers'] !== '') {
            $item['tiers'] = (string) $e['tiers'];
        }
        if ($e['reference'] !== null && $e['reference'] !== '') {
            $item['reference'] = (string) $e['reference'];
        }
        if ($e['observation'] !== null && $e['observation'] !== '') {
            $item['observation'] = (string) $e['observation'];
        }
        if ($e['modifie_le'] !== null) {
            $item['updatedAt'] = salfa_iso((string) $e['modifie_le']);
        }
        $lignes = $parEcriture[$e['id']] ?? [];
        if ($lignes) {
            foreach ($lignes as &$l) {
                unset($l['_ordre']);
            }
            unset($l);
            $item['lignesDetail'] = $lignes;
        }
        if ($e['annee_archive'] !== null) {
            $ecrituresParAnnee[(int) $e['annee_archive']][] = $item;
        } else {
            $ecrituresParAnnee['courant'][] = $item;
        }
    }

    $masquesFormates = [];
    $parMasque = [];
    if ($masques) {
        $ids = array_column($masques, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $lignesMasques = salfa_executer(
            'SELECT * FROM ' . salfa_table('masque_lignes') . " WHERE masque_id IN ($placeholders) ORDER BY masque_id, ordre, id",
            array_values($ids)
        )->fetchAll();
        foreach ($lignesMasques as $l) {
            $parMasque[$l['masque_id']][] = [
                'description' => (string) $l['description'],
                'montantDefaut' => $l['montant_defaut'] === null ? null : (int) $l['montant_defaut'],
            ];
        }
        foreach ($masques as $m) {
            $lignes = [];
            foreach ($parMasque[$m['id']] ?? [] as $l) {
                $ligne = ['description' => $l['description']];
                if ($l['montantDefaut'] !== null) {
                    $ligne['montantDefaut'] = (int) $l['montantDefaut'];
                }
                $lignes[] = $ligne;
            }
            $masque = [
                'id' => (string) $m['id'],
                'nom' => (string) $m['nom'],
                'sens' => (string) $m['sens'],
                'lignes' => $lignes,
            ];
            if ($m['description'] !== null && $m['description'] !== '') {
                $masque['description'] = (string) $m['description'];
            }
            $masquesFormates[] = $masque;
        }
    }

    $compteursFormates = [];
    foreach ($compteurs as $c) {
        $compteursFormates[(string) $c['cle']] = (int) $c['valeur'];
    }

    $cloturesFormates = [];
    foreach ($clotures as $c) {
        $annee = (int) $c['annee'];
        $cloturesFormates[] = [
            'annee' => $annee,
            'clotureLe' => salfa_iso((string) $c['cloture_le']),
            'soldeOuverture' => (int) $c['solde_ouverture'],
            'recettes' => (int) $c['recettes'],
            'depenses' => (int) $c['depenses'],
            'soldeCloture' => (int) $c['solde_cloture'],
            'ecritures' => $ecrituresParAnnee[$annee] ?? [],
        ];
    }

    $report = null;
    if ($parametres['report_annee'] !== null && $parametres['report_solde'] !== null) {
        $report = ['annee' => (int) $parametres['report_annee'], 'solde' => (int) $parametres['report_solde']];
    }

    return [
        'format' => 'CAISSE-SALFA',
        'version' => 1,
        'revision' => (int) $libre['revision'],
        'updatedAt' => salfa_iso((string) $libre['modifie_le']),
        'ecritures' => $ecrituresParAnnee['courant'] ?? [],
        'parametres' => [
            'soldeInitial' => (int) ($parametres['solde_initial'] ?? 0),
            'exercice' => $parametres['exercice'] === null ? null : (int) $parametres['exercice'],
            'reportPrecedent' => $report,
        ],
        'masques' => $masquesFormates,
        'compteurs' => $compteursFormates,
        'exercicesClotures' => $cloturesFormates,
    ];
}

/** Horodatage MySQL (heure locale) → ISO 8601 lisible par le navigateur. */
function salfa_iso(string $mysql): string
{
    $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', $mysql, new DateTimeZone((string) salfa_config()['timezone']))
        ?: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $mysql, new DateTimeZone((string) salfa_config()['timezone']));
    if ($date === false) {
        return gmdate('c');
    }
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}

/** Écriture d'une année clôturée : refuse toute modification. */
function salfa_verifier_non_archive(string $ecritureId): void
{
    $ligne = salfa_executer(
        'SELECT annee_archive, numero FROM ' . salfa_table('ecritures') . ' WHERE id = ?',
        [$ecritureId]
    )->fetch();
    if ($ligne && $ligne['annee_archive'] !== null) {
        throw new SalFaErreur(
            'La pièce ' . $ligne['numero'] . ' appartient à l’exercice ' . $ligne['annee_archive'] . ' clôturé : elle ne peut plus être modifiée.',
            409,
            'exercice_archive'
        );
    }
}

function salfa_revision_attendue(array $corps): int
{
    if (!array_key_exists('revision', $corps)) {
        throw new SalFaErreur('Révision attendue manquante : rechargez la page.', 400, 'revision_manquante');
    }
    $revision = $corps['revision'];
    if (!is_int($revision) && !(is_string($revision) && preg_match('/^\d+$/', $revision))) {
        throw new SalFaErreur('Révision invalide.', 400, 'revision_invalide');
    }
    return (int) $revision;
}

function salfa_verifier_revision(int $attendue): void
{
    salfa_verrouiller_livre();
    $reelle = (int) salfa_pdo()->query('SELECT revision FROM ' . salfa_table('livre') . ' WHERE id = 1')->fetchColumn();
    if ($attendue !== $reelle) {
        throw new SalFaErreur(
            'Le livre a été modifié dans un autre onglet ou par un autre utilisateur. Rechargez les données avant d’enregistrer.',
            409,
            'conflit_revision'
        );
    }
}

function salfa_incrementer_revision(): int
{
    $pdo = salfa_pdo();
    $pdo->exec('UPDATE ' . salfa_table('livre') . ' SET revision = revision + 1, modifie_le = NOW(3) WHERE id = 1');
    return (int) $pdo->query('SELECT revision FROM ' . salfa_table('livre') . ' WHERE id = 1')->fetchColumn();
}

/** Exécute une mutation dans une transaction verrouillée et renvoie le livre à jour. */
function salfa_transaction(callable $action): array
{
    $pdo = salfa_pdo();
    $pdo->beginTransaction();
    try {
        $resultat = $action();
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    $livre = salfa_charger_livre();
    if (is_array($resultat) && isset($resultat['livre']) && is_array($resultat['livre'])) {
        $livre = array_merge($livre, $resultat['livre']);
    }
    return $livre;
}

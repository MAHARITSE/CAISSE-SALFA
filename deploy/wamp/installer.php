<?php
/**
 * CAISSE SALFA — installation dans le navigateur.
 *
 * À ouvrir une seule fois après avoir copié le dossier dans
 * `C:\wamp64\www\caisse-salfa` : http://localhost/caisse-salfa/installer.php
 *
 * La page crée la base MySQL, les tables, le compte administrateur et le
 * fichier de configuration. Aucune ligne de commande, aucun script .bat.
 * Une fois la configuration écrite, la page se verrouille d'elle-même : la
 * relancer ne peut plus rien modifier.
 */

declare(strict_types=1);

require __DIR__ . '/api/lib/installation.php';

$racine = __DIR__;
$installe = salfa_est_installe();
// Mot de passe oublié : l'opérateur crée ce fichier sur le serveur, ce qui vaut
// preuve d'accès au dossier. La réinitialisation supprime le fichier ensuite.
$drapeauReinitialisation = $racine . '/data/reinitialiser-mdp.txt';
$mode = !$installe ? 'installer' : (is_file($drapeauReinitialisation) ? 'reinitialiser' : 'verrouille');
$erreurs = [];
$rapport = null;
$reinitialisation = null;
$valeurs = [
    'hote' => '127.0.0.1',
    'port' => '3306',
    'base' => 'caisse_salfa',
    'utilisateur' => 'root',
    'admin' => 'admin',
    'nom' => 'Administrateur',
];

if ($mode === 'reinitialiser' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $compte = strtolower(trim((string) ($_POST['compte'] ?? '')));
    $nouveau = (string) ($_POST['nouveau_mdp'] ?? '');
    $confirmation = (string) ($_POST['nouveau_mdp_confirm'] ?? '');
    if (!preg_match('/^[a-z0-9._-]{3,80}$/', $compte)) {
        $erreurs[] = 'Identifiant invalide : 3 à 80 caractères, sans espace ni accent.';
    }
    if (mb_strlen($nouveau) < 8) {
        $erreurs[] = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
    }
    if ($nouveau !== $confirmation) {
        $erreurs[] = 'Les deux mots de passe ne sont pas identiques.';
    }
    $valeurs['compte'] = $compte;

    if ($erreurs === []) {
        try {
            $c = salfa_config();
            $pdo = salfa_pdo_serveur((string) $c['hote'], (int) $c['port'], (string) $c['utilisateur'], (string) $c['mot_de_passe']);
            $pdo->exec('USE `' . (string) $c['base'] . '`');
            $requete = $pdo->prepare('UPDATE `' . salfa_prefixe() . 'utilisateurs` SET mdp_hash = ?, actif = 1 WHERE identifiant = ?');
            $requete->execute([password_hash($nouveau, PASSWORD_DEFAULT), $compte]);
            if ($requete->rowCount() < 1) {
                throw new RuntimeException('Aucun compte « ' . $compte . ' » : vérifiez l’identifiant exact.');
            }
            @unlink($drapeauReinitialisation);
            $reinitialisation = $compte;
        } catch (Throwable $e) {
            $erreurs[] = $e->getMessage();
        }
    }
}

if ($mode === 'installer' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    foreach (array_keys($valeurs) as $cle) {
        $envoye = trim((string) ($_POST[$cle] ?? ''));
        if ($envoye !== '') {
            $valeurs[$cle] = $envoye;
        }
    }
    $motDePasseBase = (string) ($_POST['mot_de_passe'] ?? '');
    $motDePasseAdmin = (string) ($_POST['mot_de_passe_admin'] ?? '');
    $confirmation = (string) ($_POST['mot_de_passe_admin_confirm'] ?? '');

    if ($motDePasseAdmin !== $confirmation) {
        $erreurs[] = 'Les deux mots de passe administrateur ne sont pas identiques.';
    }
    if (!salfa_nom_base_valide($valeurs['base'])) {
        $erreurs[] = 'Nom de base invalide : lettres, chiffres et souligné uniquement (ex. caisse_salfa).';
    }
    if (!preg_match('/^[a-z0-9._-]{3,80}$/', strtolower($valeurs['admin']))) {
        $erreurs[] = 'Identifiant administrateur invalide : 3 à 80 caractères, sans espace ni accent.';
    }
    if (mb_strlen($motDePasseAdmin) < 8) {
        $erreurs[] = 'Le mot de passe administrateur doit contenir au moins 8 caractères.';
    }

    if ($erreurs === []) {
        try {
            $rapport = salfa_installer([
                'hote' => $valeurs['hote'],
                'port' => (int) $valeurs['port'],
                'base' => $valeurs['base'],
                'utilisateur' => $valeurs['utilisateur'],
                'mot_de_passe' => $motDePasseBase,
                'admin' => $valeurs['admin'],
                'nom' => $valeurs['nom'],
                'mot_de_passe_admin' => $motDePasseAdmin,
            ], $racine);
            $installe = true;
        } catch (Throwable $e) {
            $erreurs[] = $e->getMessage();
        }
    }
}

/** Échappement systématique : tout ce qui s'affiche peut venir d'un formulaire. */
function e(?string $texte): string
{
    return htmlspecialchars((string) $texte, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$baseUrl = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/installer.php'))), '/');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title><?= $installe ? 'Installation terminée' : 'Installation' ?> · Caisse SALFA</title>
<style>
  :root {
    --brand-700: #0e6351; --brand-800: #104f43; --brand-50: #eff8f5; --brand-200: #b4ddcf;
    --texte: #0f172a; --doux: #5b6b78; --bord: #e2e8f0; --fond: #f4f7f6;
    --rouge-fond: #fef2f2; --rouge-bord: #fecaca; --rouge-texte: #9f1239;
    --vert-fond: #ecfdf5; --vert-bord: #a7f3d0; --vert-texte: #065f46;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1rem; background: var(--fond); color: var(--texte);
    font: 16px/1.55 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    display: flex; justify-content: center; align-items: flex-start; min-height: 100vh;
  }
  main { width: 100%; max-width: 620px; }
  .carte { background: #fff; border: 1px solid var(--bord); border-radius: 14px; padding: 1.75rem; box-shadow: 0 10px 30px -18px rgba(15, 23, 42, .35); }
  .entete { display: flex; align-items: center; gap: .75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--bord); }
  .logo { width: 44px; height: 44px; border-radius: 11px; background: var(--brand-700); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; }
  .entete p { margin: 0; }
  .marque { font-weight: 800; letter-spacing: .02em; color: var(--brand-800); font-size: 1.05rem; }
  .sur-titre { font-size: .7rem; text-transform: uppercase; letter-spacing: .14em; color: var(--doux); }
  h1 { font-size: 1.3rem; margin: 1.25rem 0 .35rem; }
  .intro { margin: 0 0 1.25rem; color: var(--doux); font-size: .95rem; }
  .alerte { border: 1px solid var(--rouge-bord); background: var(--rouge-fond); color: var(--rouge-texte); border-radius: 10px; padding: .85rem 1rem; margin-bottom: 1.25rem; font-size: .92rem; }
  .alerte ul { margin: .35rem 0 0; padding-left: 1.1rem; }
  .succes { border: 1px solid var(--vert-bord); background: var(--vert-fond); color: var(--vert-texte); border-radius: 10px; padding: 1rem 1.15rem; font-size: .95rem; }
  .succes strong { display: block; font-size: 1.05rem; margin-bottom: .35rem; }
  fieldset { border: 0; margin: 0 0 1.25rem; padding: 0; }
  legend { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--doux); padding: 0; margin-bottom: .6rem; }
  .grille { display: grid; gap: .85rem; grid-template-columns: 1fr; }
  @media (min-width: 560px) { .grille.deux { grid-template-columns: 1fr 1fr; } .grille.trois { grid-template-columns: 2fr 1fr; } }
  label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: .3rem; }
  input { width: 100%; padding: .6rem .7rem; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; background: #fff; }
  input:focus { outline: 2px solid var(--brand-700); outline-offset: 1px; border-color: var(--brand-700); }
  .aide { display: block; margin-top: .3rem; font-size: .78rem; color: var(--doux); font-weight: 400; }
  details { margin: 0 0 1.25rem; font-size: .85rem; color: var(--doux); }
  details summary { cursor: pointer; font-weight: 600; color: var(--brand-800); }
  details p { margin: .5rem 0 0; }
  code { background: var(--brand-50); border: 1px solid var(--brand-200); border-radius: 5px; padding: .05rem .3rem; font-size: .85em; }
  button { width: 100%; padding: .8rem 1rem; border: 0; border-radius: 10px; background: var(--brand-700); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
  button:hover { background: var(--brand-800); }
  .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.25rem; }
  .actions a { flex: 1 1 180px; text-align: center; padding: .75rem 1rem; border-radius: 10px; background: var(--brand-700); color: #fff; font-weight: 700; text-decoration: none; }
  .actions a.second { background: #fff; color: var(--brand-800); border: 1px solid var(--brand-700); }
  .pied { margin-top: 1rem; text-align: center; font-size: .75rem; color: var(--doux); }
  .liste { margin: .75rem 0 0; padding-left: 1.1rem; }
</style>
</head>
<body>
<main>
  <div class="carte">
    <div class="entete">
      <span class="logo" aria-hidden="true">S</span>
      <p>
        <span class="marque">SALFA</span><br />
        <span class="sur-titre">Caisse principale · Installation</span>
      </p>
    </div>

<?php if ($rapport !== null): ?>
    <h1>Installation terminée</h1>
    <div class="succes" role="status">
      <strong>La caisse est prête.</strong>
      Base <code><?= e($rapport['base']) ?></code> · <?= (int) $rapport['tables'] ?> tables ·
      compte administrateur <code><?= e($rapport['identifiant']) ?></code>.<br />
      Configuration écrite dans <code><?= e($rapport['fichier']) ?></code>, hors d’accès du navigateur.
    </div>
    <p class="intro">Vous pouvez fermer cette page : elle se verrouille d’elle-même et ne pourra plus rien modifier.</p>
    <div class="actions">
      <a href="<?= e($baseUrl === '' ? '/' : $baseUrl . '/') ?>">Ouvrir la caisse</a>
      <a class="second" href="<?= e($baseUrl) ?>/api/index.php?action=verifier" target="_blank" rel="noreferrer">Diagnostic du serveur</a>
    </div>

<?php elseif ($reinitialisation !== null): ?>
    <h1>Mot de passe réinitialisé</h1>
    <div class="succes" role="status">
      <strong>Le compte « <?= e($reinitialisation) ?> » a un nouveau mot de passe.</strong>
      Le fichier <code>data/reinitialiser-mdp.txt</code> a été supprimé : la réinitialisation se verrouille d’elle-même.
    </div>
    <div class="actions">
      <a href="<?= e($baseUrl === '' ? '/' : $baseUrl . '/') ?>">Ouvrir la caisse</a>
    </div>

<?php elseif ($mode === 'verrouille'): ?>
    <h1>Déjà installé</h1>
    <div class="succes" role="status">
      <strong>Cette installation est terminée.</strong>
      La configuration existe déjà : l’installateur ne peut plus rien modifier. Pour tout réinstaller,
      supprimez <code>data/salfa-config.php</code> sur le serveur, puis rechargez cette page.
    </div>
    <p class="intro">
      <strong>Mot de passe oublié ?</strong> Créez un fichier vide
      <code>data/reinitialiser-mdp.txt</code> dans le dossier du site, rechargez cette page :
      un formulaire de réinitialisation apparaît, puis le fichier est supprimé.
      Un administrateur connecté peut aussi gérer les comptes dans l’onglet « Administration ».
    </p>
    <div class="actions">
      <a href="<?= e($baseUrl === '' ? '/' : $baseUrl . '/') ?>">Ouvrir la caisse</a>
      <a class="second" href="<?= e($baseUrl) ?>/api/index.php?action=verifier" target="_blank" rel="noreferrer">Diagnostic du serveur</a>
    </div>

<?php elseif ($mode === 'reinitialiser'): ?>
    <h1>Réinitialiser un mot de passe</h1>
    <p class="intro">
      Le fichier <code>data/reinitialiser-mdp.txt</code> a été trouvé sur le serveur : vous pouvez
      choisir un nouveau mot de passe. Il sera supprimé aussitôt, ce qui referme cette page.
    </p>

  <?php if ($erreurs !== []): ?>
    <div class="alerte" role="alert">
      <strong>Réinitialisation impossible.</strong>
      <ul><?php foreach ($erreurs as $erreur): ?><li><?= e($erreur) ?></li><?php endforeach; ?></ul>
    </div>
  <?php endif; ?>

    <form method="post" action="<?= e((string) ($_SERVER['SCRIPT_NAME'] ?? 'installer.php')) ?>">
      <fieldset>
        <legend>Compte</legend>
        <div>
          <label for="compte">Identifiant</label>
          <input id="compte" name="compte" value="<?= e($valeurs['compte'] ?? '') ?>" autocomplete="off" autocapitalize="none" spellcheck="false" required />
        </div>
        <div class="grille deux" style="margin-top:.85rem">
          <div>
            <label for="nouveau_mdp">Nouveau mot de passe</label>
            <input id="nouveau_mdp" name="nouveau_mdp" type="password" autocomplete="new-password" minlength="8" required />
            <span class="aide">8 caractères minimum.</span>
          </div>
          <div>
            <label for="nouveau_mdp_confirm">Confirmation</label>
            <input id="nouveau_mdp_confirm" name="nouveau_mdp_confirm" type="password" autocomplete="new-password" minlength="8" required />
          </div>
        </div>
      </fieldset>
      <button type="submit">Enregistrer le nouveau mot de passe</button>
    </form>

<?php else: ?>
    <h1>Installer la caisse</h1>
    <p class="intro">
      Dernière étape : les accès à MySQL et le compte administrateur. La base, les 14 tables,
      les modèles et les catégories sont créés automatiquement.
    </p>

  <?php if ($erreurs !== []): ?>
    <div class="alerte" role="alert">
      <strong>Installation interrompue.</strong>
      <ul><?php foreach ($erreurs as $erreur): ?><li><?= e($erreur) ?></li><?php endforeach; ?></ul>
    </div>
  <?php endif; ?>

    <form method="post" action="<?= e((string) ($_SERVER['SCRIPT_NAME'] ?? 'installer.php')) ?>">
      <fieldset>
        <legend>Accès MySQL</legend>
        <div class="grille deux">
          <div>
            <label for="hote">Hôte</label>
            <input id="hote" name="hote" value="<?= e($valeurs['hote']) ?>" autocomplete="off" required />
          </div>
          <div>
            <label for="port">Port</label>
            <input id="port" name="port" value="<?= e($valeurs['port']) ?>" inputmode="numeric" autocomplete="off" required />
          </div>
        </div>
        <div class="grille deux" style="margin-top:.85rem">
          <div>
            <label for="base">Base de données</label>
            <input id="base" name="base" value="<?= e($valeurs['base']) ?>" autocomplete="off" required />
            <span class="aide">Créée si elle n’existe pas.</span>
          </div>
          <div>
            <label for="utilisateur">Utilisateur MySQL</label>
            <input id="utilisateur" name="utilisateur" value="<?= e($valeurs['utilisateur']) ?>" autocomplete="off" required />
          </div>
        </div>
        <div style="margin-top:.85rem">
          <label for="mot_de_passe">Mot de passe MySQL</label>
          <input id="mot_de_passe" name="mot_de_passe" type="password" autocomplete="new-password" />
          <span class="aide">Vide si l’utilisateur n’en a pas (réglage par défaut de WAMP pour root).</span>
        </div>
      </fieldset>

      <fieldset>
        <legend>Compte administrateur</legend>
        <div class="grille deux">
          <div>
            <label for="admin">Identifiant</label>
            <input id="admin" name="admin" value="<?= e($valeurs['admin']) ?>" autocomplete="off" autocapitalize="none" spellcheck="false" required />
          </div>
          <div>
            <label for="nom">Nom complet</label>
            <input id="nom" name="nom" value="<?= e($valeurs['nom']) ?>" autocomplete="off" />
          </div>
        </div>
        <div class="grille deux" style="margin-top:.85rem">
          <div>
            <label for="mot_de_passe_admin">Mot de passe</label>
            <input id="mot_de_passe_admin" name="mot_de_passe_admin" type="password" autocomplete="new-password" minlength="8" required />
            <span class="aide">8 caractères minimum.</span>
          </div>
          <div>
            <label for="mot_de_passe_admin_confirm">Confirmation</label>
            <input id="mot_de_passe_admin_confirm" name="mot_de_passe_admin_confirm" type="password" autocomplete="new-password" minlength="8" required />
          </div>
        </div>
      </fieldset>

      <details>
        <summary>Où trouver les accès MySQL ?</summary>
        <p>
          Icône WAMP → <strong>phpMyAdmin</strong> : la page d’accueil indique le serveur
          (<code>localhost</code>, port <code>3306</code>) et l’utilisateur. Sur une installation WAMP
          neuve, l’utilisateur est <code>root</code> sans mot de passe. Ces accès restent sur le
          serveur : ils sont écrits dans <code>data/salfa-config.php</code>, jamais dans le navigateur.
        </p>
      </details>

      <button type="submit">Installer la caisse</button>
    </form>

    <p class="pied">
      Une erreur ? Le <a href="<?= e($baseUrl) ?>/api/index.php?action=verifier" target="_blank" rel="noreferrer">diagnostic du serveur</a>
      détaille PHP, MySQL et les fichiers du paquet.
    </p>
<?php endif; ?>
  </div>
  <p class="pied">CAISSE SALFA · version <?= e(SALFA_VERSION_API) ?></p>
</main>
</body>
</html>

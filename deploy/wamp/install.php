<?php
/**
 * CAISSE SALFA — installation / diagnostic en ligne (WAMP).
 * À supprimer après la mise en service : outils/installer.bat le renomme.
 *
 *  - vérifie PHP, PDO MySQL, écriture des fichiers, sessions ;
 *  - teste la connexion MySQL ;
 *  - crée les tables si la base est vide ;
 *  - ne révèle jamais le mot de passe de la base.
 */

declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$chemins = [
    'config' => __DIR__ . '/api/salfa-config.php',
    'modele' => __DIR__ . '/api/salfa-config.modele.php',
    'sql' => __DIR__ . '/sql/salfa_install.sql',
];

function e(string $valeur): string
{
    return htmlspecialchars($valeur, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$config = is_file($chemins['config']) ? (require $chemins['config']) : null;
$diagnostic = [];
$diagnostic[] = ['PHP', PHP_VERSION, version_compare(PHP_VERSION, '8.1', '>=')];
$diagnostic[] = ['PDO MySQL', extension_loaded('pdo_mysql') ? 'disponible' : 'absent', extension_loaded('pdo_mysql')];
$diagnostic[] = ['mbstring', extension_loaded('mbstring') ? 'disponible' : 'absent', extension_loaded('mbstring')];
$diagnostic[] = ['JSON', extension_loaded('json') ? 'disponible' : 'absent', extension_loaded('json')];
$diagnostic[] = ['Session PHP', function_exists('session_start') ? 'disponible' : 'absente', function_exists('session_start')];
$diagnostic[] = ['Fichier api/salfa-config.php', is_file($chemins['config']) ? 'présent' : 'absent', is_file($chemins['config'])];
$diagnostic[] = ['Répertoire api lisible', is_readable(__DIR__ . '/api') ? 'oui' : 'non', is_readable(__DIR__ . '/api')];

$erreurBase = null;
$tablesOk = null;
if (is_array($config)) {
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['hote'], (int) $config['port'], $config['base']),
            (string) $config['utilisateur'],
            (string) $config['mot_de_passe'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
        );
        $prefixe = preg_match('/^[a-zA-Z0-9_]+$/', (string) $config['prefixe']) ? $config['prefixe'] : 'salfa_';
        $tables = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($prefixe . '%'))->fetchAll(PDO::FETCH_COLUMN);
        $tablesOk = $tables;
        if (count($tables) === 0 && is_file($chemins['sql'])) {
            $sql = (string) file_get_contents($chemins['sql']);
            if (isset($_POST['installer']) && $_POST['installer'] === '1') {
                $pdo->exec($sql);
                $tables = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($prefixe . '%'))->fetchAll(PDO::FETCH_COLUMN);
                $tablesOk = $tables;
            }
        }
    } catch (Throwable $e) {
        $erreurBase = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CAISSE SALFA — installation WAMP</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    main { max-width: 900px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 22px; }
    .carte { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td, th { padding: 8px 10px; border-bottom: 1px solid #eef2f6; text-align: left; }
    .ok { color: #047857; font-weight: 600; }
    .ko { color: #be123c; font-weight: 600; }
    code, pre { background: #f1f5f9; border-radius: 6px; padding: 2px 6px; font-size: 13px; }
    ol { line-height: 1.7; }
    .bouton { display: inline-block; background: #0e6351; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
<main>
  <h1>CAISSE SALFA — installation WAMP</h1>

  <div class="carte">
    <h2>1. Environnement</h2>
    <table>
      <?php foreach ($diagnostic as [$nom, $valeur, $ok]): ?>
        <tr>
          <td><?= e($nom) ?></td>
          <td><?= e($valeur) ?></td>
          <td class="<?= $ok ? 'ok' : 'ko' ?>"><?= $ok ? 'OK' : 'À corriger' ?></td>
        </tr>
      <?php endforeach; ?>
    </table>
  </div>

  <div class="carte">
    <h2>2. Base de données</h2>
    <?php if (!is_array($config)): ?>
      <p class="ko">api/salfa-config.php est absent.</p>
      <p>Lancez <code>outils\installer.bat</code> ou copiez <code>api/salfa-config.modele.php</code> en <code>api/salfa-config.php</code> et renseignez les accès MySQL de WAMP.</p>
    <?php elseif ($erreurBase !== null): ?>
      <p class="ko">Connexion MySQL refusée.</p>
      <pre><?= e($erreurBase) ?></pre>
      <p>Vérifiez que WAMP est démarré (icône verte), que la base <code><?= e((string) $config['base']) ?></code> existe et que l’utilisateur a les droits.</p>
    <?php else: ?>
      <p class="ok">Connexion MySQL réussie.</p>
      <?php if (!$tablesOk): ?>
        <p>Aucune table n’a été trouvée. Le script <code>sql/salfa_install.sql</code> peut créer la structure et les données de départ.</p>
        <form method="post"><input type="hidden" name="installer" value="1"><button class="bouton" type="submit">Créer les tables maintenant</button></form>
      <?php else: ?>
        <p>Tables trouvées : <?= e(implode(', ', $tablesOk)) ?></p>
      <?php endif; ?>
    <?php endif; ?>
  </div>

  <div class="carte">
    <h2>3. Étapes suivantes</h2>
    <ol>
      <li>Créer le compte administrateur : <code>outils\creer-admin.bat</code>.</li>
      <li>Ouvrir l’application : <a href="/caisse-salfa/">/caisse-salfa/</a>.</li>
      <li>Se connecter, puis vérifier un ajout et une suppression d’écriture.</li>
      <li>Supprimer ce fichier <code>install.php</code> et <code>api/connexion-bootstrap.php</code> après la mise en service.</li>
    </ol>
  </div>
</main>
</body>
</html>

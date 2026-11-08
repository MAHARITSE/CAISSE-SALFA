/**
 * Build du paquet WAMP — structure obtenue dans C:\wamp64\www\caisse-salfa :
 *
 *   index.html        page d'accueil (React compilé, mode API)
 *   assets/           JS, CSS, images
 *   api/              API PHP/MySQL (index.php, points/, lib/) et son guide
 *                     api/caisse-salfa.sql : la base complète, à importer dans
 *                     phpMyAdmin si l'on ne veut pas laisser l'API la créer
 *   .htaccess         configuration Apache
 *   .user.ini         limites PHP (32 Mo)
 *   favicon.svg       icône de l'onglet
 *
 * La racine ne contient que cela : le dossier se copie tel quel dans `www`.
 *
 * Un archivage `deploy/wamp/caisse-salfa.zip` est produit en complément : il se
 * décompresse directement dans `C:\\wamp64\\www\\` et contient un dossier
 * `caisse-salfa\\` déjà nommé, comme le ZIP du modèle SALAIRE-SALFA.
 *
 * Aucun Node.js n'est nécessaire sur le serveur, et **aucune installation** :
 * le dossier se copie dans `www`, le premier appel crée la base, les tables et
 * les comptes de départ.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ecrireScriptSql } from './sql-wamp.mjs';

const racine = resolve(import.meta.dirname, '..');
const dist = join(racine, 'dist');
const wamp = join(racine, 'deploy', 'wamp');
const paquet = join(wamp, 'caisse-salfa');

console.log('→ Compilation du frontend (mode API, chemins relatifs)…');
execSync('npx tsc --noEmit && npx vite build --base ./', {
  cwd: racine,
  stdio: 'inherit',
  env: { ...process.env, VITE_MODE_API: 'api' },
});

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Échec : dist/index.html absent.');
  process.exit(1);
}

console.log('→ Copie du frontend dans le paquet…');
rmSync(paquet, { recursive: true, force: true });
mkdirSync(paquet, { recursive: true });
cpSync(dist, paquet, { recursive: true });

console.log('→ Copie de l’API, du schéma et des fichiers serveur…');
for (const element of ['api', '.htaccess', '.user.ini']) {
  const source = join(wamp, element);
  if (existsSync(source)) {
    cpSync(source, join(paquet, element), { recursive: true });
  }
}

// Base complète livrée avec le site : tables, données de départ et comptes de
// connexion, dans un seul fichier importable tel quel dans phpMyAdmin. Il est
// régénéré ici pour rester strictement identique au schéma que l'API crée
// d'elle-même au premier appel.
const sqlLivre = ecrireScriptSql(join(paquet, 'api', 'caisse-salfa.sql'));
console.log(`  Base SQL : api/caisse-salfa.sql (${Math.round(sqlLivre.octets / 1024)} Ko, ${sqlLivre.comptes} comptes de départ)`);

// Version du paquet inscrite dans la page : `api/config.php` annonce la même
// version (SALFA_VERSION_API) et `api/points/verifier.php` compare les deux,
// ce qui repère un paquet recopié à moitié sur le serveur.
const { version } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
const pageIndex = join(paquet, 'index.html');
const page = readFileSync(pageIndex, 'utf8').replace(/\s*<meta name="salfa-version"[^>]*>/g, '');
const balise = `  <meta name="salfa-version" content="${version}" />\n`;
writeFileSync(pageIndex, page.replace('</head>', `${balise}</head>`));
if (!readFileSync(pageIndex, 'utf8').includes(`content="${version}"`)) {
  console.error('Échec : la version du paquet n’a pas pu être inscrite dans index.html.');
  process.exit(1);
}
console.log(`  Version du paquet : ${version}`);

// Racine du site : exactement ce que l'on voit dans l'explorateur Windows.
const obligatoires = [
  'index.html',
  'favicon.svg',
  'assets',
  '.htaccess',
  '.user.ini',
  'api',
  'api/caisse-salfa.sql',
  'api/index.php',
  'api/config.php',
  'api/socle.php',
  'api/README.md',
  'api/.htaccess',
  'api/data/.htaccess',
  'api/installation/salfa_install.sql',
  'api/installation/.htaccess',
  'api/lib/amorce.php',
  'api/lib/db.php',
  'api/points/verifier.php',
  'api/points/configurer.php',
  'api/points/sante.php',
];
const manquants = obligatoires.filter(f => !existsSync(join(paquet, f)));

// Rien d'autre à la racine : ni schéma SQL, ni dossier de travail apparent,
// ni configuration écrite (elle vit hors du site ou dans api/data/).
const racineAutorisee = ['index.html', 'favicon.svg', 'assets', 'api', '.htaccess', '.user.ini'];
const intrus = readdirSync(paquet).filter(f => !racineAutorisee.includes(f));
const interdits = ['api/salfa-config.php', 'api/data/salfa-config.php', 'installer.php', 'api/installer.php']
  .filter(f => existsSync(join(paquet, f)));

if (intrus.length) {
  console.error('Éléments inattendus à la racine du paquet :', intrus.join(', '));
  process.exit(1);
}

/**
 * Crée l'archive du paquet.
 *
 * `zip` est utilisé quand il est disponible (Linux, macOS, Git Bash) ; sinon on
 * retombe sur PowerShell, présent partout sous Windows ou` WampServer est
 * installé. Aucune dépendance npm n'est ajoutée pour cela.
 */
function archiver(dossier, cible) {
  const parent = join(dossier, '..');
  try {
    execSync(`zip -qr "${cible}" "${basename(dossier)}"`, { cwd: parent, stdio: 'ignore' });
    return;
  } catch {
    // Pas de `zip` : on tente python3 -m zipfile, puis PowerShell, puis warning.
  }
  try {
    execSync(`python3 -m zipfile -c "${cible}" "${basename(dossier)}"`, { cwd: parent, stdio: 'ignore' });
    return;
  } catch {}
  try {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${dossier}' -DestinationPath '${cible}' -Force"`,
      { stdio: 'ignore' },
    );
    return;
  } catch {
    console.warn('  (archive ignorée : ni zip, ni python3, ni PowerShell disponibles)');
  }
}

const compter = (d) => readdirSync(d).reduce((n, f) => {
  const p = join(d, f);
  return n + (statSync(p).isDirectory() ? compter(p) : 1);
}, 0);

if (manquants.length) {
  console.error('Fichiers manquants dans deploy/wamp/caisse-salfa :', manquants.join(', '));
  process.exit(1);
}
if (interdits.length) {
  console.error('Éléments à retirer de deploy/wamp/caisse-salfa :', interdits.join(', '));
  process.exit(1);
}
console.log(`✓ Paquet WAMP prêt : ${compter(paquet)} fichiers dans deploy/wamp/caisse-salfa/`);

// Archive équivalente : à décompresser directement dans C:\\wamp64\\www\\.
// Le dossier `caisse-salfa\\` est inclus dans l'archive, donc pas de risque de
// déverser les fichiers à la racine de `www`.
const archive = join(wamp, 'caisse-salfa.zip');
rmSync(archive, { force: true });
archiver(paquet, archive);
if (existsSync(archive)) {
  console.log(`✓ Archive prête : deploy/wamp/caisse-salfa.zip (${Math.round(statSync(archive).size / 1024)} Ko)`);
} else {
  console.log('ℹ Le dossier deploy/wamp/caisse-salfa/ est prêt (l’archive ZIP n’a pas pu être générée).');
}
console.log('  Copiez le dossier (ou décompressez le ZIP) dans C:\\wamp64\\www\\ — rien d’autre à installer.');

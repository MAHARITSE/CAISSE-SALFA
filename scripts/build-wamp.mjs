/**
 * Build du paquet WAMP — structure attendue dans C:\wamp64\www\caisse-salfa :
 *
 *   index.html        page d'accueil (React compilé)
 *   assets/           JS, CSS, images
 *   api/              API PHP/MySQL (index.php + points/)
 *   data/             configuration et sauvegardes (hors web)
 *   outils/           scripts .bat + assistants PHP
 *   sql/              schéma MySQL
 *   .htaccess         configuration Apache
 *   INSTALLATION.md   mode d'emploi
 *
 * Aucun Node.js n'est nécessaire sur le serveur : seul ce résultat est publié.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const racine = resolve(import.meta.dirname, '..');
const dist = join(racine, 'dist');
const paquet = join(racine, 'deploy', 'wamp');

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

console.log('→ Copie du frontend à la racine du paquet…');
for (const dossier of ['assets']) {
  rmSync(join(paquet, dossier), { recursive: true, force: true });
  if (existsSync(join(dist, dossier))) {
    cpSync(join(dist, dossier), join(paquet, dossier), { recursive: true });
  }
}
for (const fichier of ['index.html', 'favicon.svg']) {
  if (existsSync(join(dist, fichier))) {
    cpSync(join(dist, fichier), join(paquet, fichier));
  }
}
// Ancienne structure : ne doit plus exister.
rmSync(join(paquet, 'frontend'), { recursive: true, force: true });

mkdirSync(join(paquet, 'data'), { recursive: true });
mkdirSync(join(paquet, 'data', 'sauvegardes'), { recursive: true });

const obligatoires = [
  'index.html',
  'assets',
  '.htaccess',
  'INSTALLATION.md',
  'api/index.php',
  'api/socle.php',
  'api/points/livre.php',
  'api/points/sante.php',
  'api/points/cloture.php',
  'api/points/verifier.php',
  'api/points/installer.php',
  'api/config.php',
  'data/.htaccess',
  'sql/salfa_install.sql',
  'outils/installer.bat',
  'outils/verifier.bat',
  'outils/creer-admin.bat',
  'outils/sauvegarder.bat',
  'outils/install-cli.php',
  'outils/verifier-cli.php',
];
const manquants = obligatoires.filter(f => !existsSync(join(paquet, f)));
const interdits = ['frontend', 'install.php', 'api/salfa-config.php', 'data/salfa-config.php'].filter(f => existsSync(join(paquet, f)));

const compter = (d) => readdirSync(d).reduce((n, f) => {
  const p = join(d, f);
  return n + (statSync(p).isDirectory() ? compter(p) : 1);
}, 0);

if (manquants.length) {
  console.error('Fichiers manquants dans deploy/wamp :', manquants.join(', '));
  process.exit(1);
}
if (interdits.length) {
  console.error('Éléments à retirer de deploy/wamp :', interdits.join(', '));
  process.exit(1);
}
console.log(`✓ Paquet WAMP prêt : ${compter(paquet)} fichiers dans deploy/wamp/`);

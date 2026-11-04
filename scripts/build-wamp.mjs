/**
 * Build du paquet WAMP :
 *  1. compile le frontend en mode API (base relative, donc servable depuis
 *     http://localhost/caisse-salfa/) ;
 *  2. copie dist/ dans deploy/wamp/frontend/ ;
 *  3. copie l'API, le .htaccess et install.php.
 *
 * Aucun Node n'est nécessaire sur le serveur : seul ce résultat est publié.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const racine = resolve(import.meta.dirname, '..');
const dist = join(racine, 'dist');
const cible = join(racine, 'deploy', 'wamp');

console.log('→ Compilation du frontend (mode API)…');
execSync('npx tsc --noEmit && npx vite build --base ./', {
  cwd: racine,
  stdio: 'inherit',
  env: { ...process.env, VITE_MODE_API: 'api' },
});

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Échec : dist/index.html absent.');
  process.exit(1);
}

console.log('→ Copie vers deploy/wamp/frontend…');
rmSync(join(cible, 'frontend'), { recursive: true, force: true });
mkdirSync(join(cible, 'frontend'), { recursive: true });
cpSync(dist, join(cible, 'frontend'), { recursive: true });

/** Vérification finale : le paquet doit être autonome. */
const obligatoires = [
  'frontend/index.html',
  'api/index.php',
  'api/config.php',
  'sql/salfa_install.sql',
  'outils/installer.bat',
  '.htaccess',
  'install.php',
];
const manquants = obligatoires.filter(f => !existsSync(join(cible, f)));
const fichiers = (d) => readdirSync(d).reduce((n, f) => {
  const p = join(d, f);
  return n + (statSync(p).isDirectory() ? fichiers(p) : 1);
}, 0);

if (manquants.length) {
  console.error('Fichiers manquants dans deploy/wamp :', manquants.join(', '));
  process.exit(1);
}
console.log(`✓ Paquet WAMP prêt : ${fichiers(cible)} fichiers dans deploy/wamp/`);

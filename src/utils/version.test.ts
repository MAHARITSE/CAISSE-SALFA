import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION_APPLICATION } from './version';

/**
 * Une version affichée à trois endroits — `package.json`, `src/utils/version.ts`
 * et la constante `SALFA_VERSION_API` du paquet WAMP — finit toujours par
 * diverger (le paquet livré annonçait 1.2 côté diagnostic et 1.1 côté santé).
 * Ce test interdit la dérive : un oubli casse la suite de tests.
 */
describe('version de l’application', () => {
  // jsdom ne fournit pas d’URL `file:` : on lit depuis la racine du projet.
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');
  const paquet = JSON.parse(lire('package.json')) as { version: string };
  const configApi = lire('deploy/wamp/api/config.php');

  it('suit la version du paquet npm', () => {
    expect(VERSION_APPLICATION).toBe(paquet.version);
  });

  it('suit la version annoncée par l’API PHP du paquet WAMP', () => {
    const trouvee = /const SALFA_VERSION_API = '([0-9.]+)';/.exec(configApi)?.[1];
    expect(trouvee).toBeDefined();
    expect(trouvee).toBe(VERSION_APPLICATION);
  });

  it('garde la forme majeure.mineure.correctif', () => {
    expect(VERSION_APPLICATION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('n’est plus annoncée en dur dans les points d’API', () => {
    for (const point of ['sante', 'verifier']) {
      const source = lire(`deploy/wamp/api/points/${point}.php`);
      expect(source).toContain("'versionApi' => SALFA_VERSION_API");
    }
  });
});

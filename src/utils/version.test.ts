import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION_APPLICATION } from './version';

/**
 * Une version affichée à deux endroits — `package.json` et
 * `src/utils/version.ts` — finit toujours par diverger (le paquet livré
 * annonçait 1.2 côté diagnostic et 1.1 côté santé). Ce test interdit la
 * dérive : un oubli casse la suite de tests.
 */
describe('version de l’application', () => {
  // jsdom ne fournit pas d'URL `file:` : on lit depuis la racine du projet.
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');
  const paquet = JSON.parse(lire('package.json')) as { version: string };

  it('suit la version du paquet npm', () => {
    expect(VERSION_APPLICATION).toBe(paquet.version);
  });

  it('aligne SALFA_VERSION_API côté PHP sur la version du paquet', () => {
    const configPhp = lire('deploy/wamp/api/config.php');
    const correspondance = configPhp.match(/const\s+SALFA_VERSION_API\s*=\s*'([^']+)'/);
    expect(correspondance?.[1]).toBe(paquet.version);
  });

  it('garde la forme majeure.mineure.correctif', () => {
    expect(VERSION_APPLICATION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

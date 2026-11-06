/**
 * Vérifie le fichier SQL livré avec le paquet WAMP.
 *
 * Ce fichier est la base de données elle-même : une faute de frappe dedans ne
 * se voit qu'à l'import dans phpMyAdmin, chez l'utilisateur. Ces tests
 * s'assurent donc qu'il est complet, rejouable et fermé au navigateur, et ils
 * échouent si `npm run build:wamp` n'a pas été relancé après une modification
 * du schéma (fichier périmé).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const racine = join(process.cwd());
const paquet = join(racine, 'deploy', 'wamp', 'caisse-salfa');
const fichier = join(paquet, 'api', 'caisse-salfa.sql');
const contenu = existsSync(fichier) ? readFileSync(fichier, 'utf8') : '';
const config = readFileSync(join(racine, 'deploy', 'wamp', 'api', 'config.php'), 'utf8');

/** Valeur de départ lue dans api/config.php, comme le fait le build. */
function valeur(cle: string): string | undefined {
  return config.match(new RegExp(`'${cle}'\\s*=>\\s*'([^']*)'`))?.[1];
}

const TABLE_ATTENDUE = [
  'salfa_livre', 'salfa_parametres', 'salfa_ecritures', 'salfa_details',
  'salfa_masques', 'salfa_masque_lignes', 'salfa_entetes', 'salfa_categories',
  'salfa_compteurs', 'salfa_clotures', 'salfa_utilisateurs', 'salfa_sessions',
  'salfa_tentatives', 'salfa_journal_audit',
];

describe('fichier SQL livré avec le paquet', () => {
  it('est présent à la racine de api/', () => {
    expect(existsSync(fichier)).toBe(true);
  });

  it('crée la base et les 14 tables salfa_', () => {
    expect(contenu).toMatch(new RegExp(`CREATE DATABASE IF NOT EXISTS \`${valeur('base')}\``));
    expect(contenu).toMatch(new RegExp(`USE \`${valeur('base')}\`;`));
    for (const table of TABLE_ATTENDUE) {
      expect(contenu, `table ${table} absente du SQL livré`).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(contenu.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(14);
  });

  it('crée les deux comptes de connexion avec une empreinte bcrypt', () => {
    expect(contenu).toContain(`('${valeur('compte_admin')}', '${valeur('compte_admin_nom')}'`);
    expect(contenu).toContain(`('${valeur('compte_comptable')}', '${valeur('compte_comptable_nom')}'`);
    // Aucun mot de passe en clair, seulement des empreintes $2y$ (bcrypt).
    expect(contenu).not.toMatch(/VALUES *\([^)]*'(admin123|comptable123)'/);
    expect(contenu.match(/\$2y\$10\$[./A-Za-z0-9]{53}/g)).toHaveLength(2);
  });

  it('est rejouable : rien n’est recréé sans garde-fou ni écrasé', () => {
    // Tables et données de départ en « IF NOT EXISTS » / « ON DUPLICATE KEY ».
    expect(contenu).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(contenu).toMatch(/ON DUPLICATE KEY UPDATE/);
    // Aucune destruction massive : les seuls DELETE portent sur les postes des
    // deux modèles livrés, remplacés à l'identique à chaque import.
    expect(contenu).not.toMatch(/\b(DROP|TRUNCATE)\b/i);
    for (const suppression of contenu.match(/DELETE FROM[^;]*/gi) ?? []) {
      expect(suppression).toMatch(/^DELETE FROM salfa_masque_lignes WHERE masque_id IN \(/);
    }
  });

  it('se termine par des contrôles lisibles après import', () => {
    for (const controle of ['tables salfa_ présentes', 'livre initialisé', 'comptes de connexion', 'administrateur actif']) {
      expect(contenu).toContain(controle);
    }
    expect(contenu).toMatch(/WHERE TABLE_SCHEMA = DATABASE\(\)/);
  });

  it('reste fermé côté Apache et absent de la racine du site', () => {
    // La racine du paquet ne contient que ces six éléments.
    const racinePaquet = execFileSync('ls', ['-A', paquet], { encoding: 'utf8' }).trim().split('\n').sort();
    expect(racinePaquet).toEqual(['.htaccess', '.user.ini', 'api', 'assets', 'favicon.svg', 'index.html']);
    // Un .sql ne doit jamais être servi : la règle est dans api/.htaccess.
    const htaccess = readFileSync(join(paquet, 'api', '.htaccess'), 'utf8');
    expect(htaccess).toMatch(/\\\.sql/);
  });

  it('est à jour par rapport au schéma interne', () => {
    // Le fichier du paquet doit contenir mot pour mot le schéma d'api/installation.
    const schema = readFileSync(join(racine, 'deploy', 'wamp', 'api', 'installation', 'salfa_install.sql'), 'utf8')
      .trimEnd()
      .replace(/CREATE DATABASE IF NOT EXISTS `[A-Za-z0-9_]+`/, `CREATE DATABASE IF NOT EXISTS \`${valeur('base')}\``);
    expect(contenu).toContain(schema.split('\n').slice(10).join('\n').trim().slice(0, 200));
  });
});

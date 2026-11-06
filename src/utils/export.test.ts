import { describe, expect, it } from 'vitest';
import { ecritureTest } from '../test/fixtures';
import { celluleCsv, genererLivreCsv } from './export';
import { aujourdHui, parserMontant } from './format';
import { lireSauvegarde, preparerSauvegarde, lireSauvegardeSql, preparerSqlLivre } from './backup';
import { livreTest } from '../test/fixtures';

describe('exports et saisie des montants', () => {
  it('neutralise les formules CSV mais conserve les nombres négatifs', () => {
    for (const formule of ['=1+1', '+CMD', '-CMD', '@SUM(A1)', '  =HYPERLINK("x")']) expect(celluleCsv(formule)).toMatch(/^"?'/);
    expect(celluleCsv(-500)).toBe('-500');
    expect(celluleCsv('a;b')).toBe('"a;b"');
    expect(celluleCsv('a"b')).toBe('"a""b"');
  });
  it('ne compte pas deux fois une écriture détaillée et sépare référence et observation', () => {
    const csv = genererLivreCsv([{ ...ecritureTest({ reference: 'F-1', observation: 'Note', lignesDetail: [
      { id: 'd1', libelle: 'Consultation', reference: 'Q-1', montant: 4000 },
      { id: 'd2', libelle: 'Pharmacie', montant: 6000 },
    ] }), solde: 10000 }], { periode: 'novembre 2026', soldeOuverture: 0, recettes: 10000, depenses: 0, soldeFin: 10000 });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = csv.slice(1).split('\r\n').map(r => r.split(';'));
    const donnees = rows.slice(6, rows.findIndex(r => r[2] === 'TOTAUX DE LA PÉRIODE'));
    const recettes = donnees.reduce((s, r) => s + (Number(r[8]) || 0), 0);
    expect(recettes).toBe(10000);
    expect(csv).toContain('F-1;Note;');
    expect(csv).not.toContain(';Mode;');
    expect(csv).toContain('Q-1');
    expect(csv).toContain('SOLDE DE CLÔTURE');
  });
  it('utilise la date locale et refuse les nombres ambigus ou décimaux', () => {
    expect(aujourdHui(new Date(2026, 10, 3, 0, 15))).toBe('2026-11-03');
    expect(parserMontant('1 000')).toBe(1000);
    expect(parserMontant('-500', true)).toBe(-500);
    for (const v of ['', '1.5', '1e3', 'NaN', '-1', '1,5']) expect(parserMontant(v)).toBeNull();
  });
  it('effectue un aller-retour JSON sans perte et refuse les fichiers invalides', () => {
    const livre = livreTest({ ecritures: [ecritureTest()] });
    const relu = lireSauvegarde(preparerSauvegarde(livre));
    expect(relu.ecritures).toEqual(livre.ecritures);
    expect(relu.masques).toEqual(livre.masques);
    expect(relu.exportedAt).toBeTruthy();
    expect(() => lireSauvegarde('{')).toThrow('JSON valide');
    expect(() => lireSauvegarde('[]')).toThrow('objet attendu');
  });
  it('exporte et vérifie un instantané SQL sans exécuter les instructions du fichier', () => {
    const livre = livreTest({ ecritures: [ecritureTest({ libelle: "Écriture d'été ; ' spéciale" })] });
    const sql = preparerSqlLivre(livre);
    expect(sql).toContain('CREATE TABLE');
    expect(lireSauvegardeSql(sql).ecritures).toEqual(livre.ecritures);
    expect(() => lireSauvegardeSql('DROP TABLE salfa_ecritures;')).toThrow('non compatible');
    expect(() => lireSauvegardeSql(sql + sql)).toThrow('non compatible');
  });

});

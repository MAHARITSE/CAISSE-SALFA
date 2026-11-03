import { describe, expect, it } from 'vitest';
import { ecritureTest, livreTest } from '../test/fixtures';
import { estDateValide, validerEcriture, validerSauvegarde } from './validation';

describe('validation financière et calendaire', () => {
  it('accepte une écriture valide et conserve mode, références et observation', () => {
    const e = ecritureTest({ reference: 'F-1', observation: 'Note', mode: 'Virement', lignesDetail: [{ id: 'd1', libelle: 'Consultation', reference: 'Q-1', montant: 10000 }] });
    expect(validerEcriture(e)).toEqual(e);
  });
  it('rejette les dates impossibles et les dates non normalisées', () => {
    expect(estDateValide('2024-02-29')).toBe(true);
    for (const date of ['2026-02-30', '2026-13-01', '2026-11-03T00:00:00Z', '', '1899-12-31']) expect(estDateValide(date)).toBe(false);
    expect(() => validerEcriture(ecritureTest({ date: '2026-02-30' }))).toThrow('date réelle');
  });
  it.each([0, -100, 1.5, NaN, Infinity, '1000', 1_000_000_000_000])('rejette le montant %s', montant => {
    expect(() => validerEcriture(ecritureTest({ montant: montant as number }))).toThrow();
  });
  it('refuse un total différent de la somme des postes au lieu de le corriger en silence', () => {
    expect(() => validerEcriture(ecritureTest({ lignesDetail: [{ id: 'd1', libelle: 'Poste', montant: 9000 }] }))).toThrow('somme des postes');
  });
  it('refuse un sens inconnu', () => {
    expect(() => validerEcriture({ ...ecritureTest(), sens: 'ENTREE' })).toThrow('type d’opération');
  });
  it('refuse les identifiants et numéros de pièce en double', () => {
    const e = ecritureTest();
    expect(() => validerSauvegarde(livreTest({ ecritures: [e, { ...e }] }))).toThrow('double');
    expect(() => validerSauvegarde(livreTest({ ecritures: [e, { ...e, id: 'autre' }] }))).toThrow('Numéro de pièce en double');
  });
  it('autorise un solde initial négatif mais refuse un solde initial hors limites', () => {
    expect(validerSauvegarde(livreTest({ parametres: { soldeInitial: -500 } })).parametres.soldeInitial).toBe(-500);
    expect(() => validerSauvegarde(livreTest({ parametres: { soldeInitial: Number.MAX_SAFE_INTEGER }, ecritures: [ecritureTest()] }))).toThrow('solde d’ouverture');
  });
  it('valide le format et la version des sauvegardes', () => {
    expect(() => validerSauvegarde({ ...livreTest(), version: 2 })).toThrow('Version');
    expect(() => validerSauvegarde({ ...livreTest(), format: 'AUTRE' })).toThrow('CAISSE SALFA');
  });
});

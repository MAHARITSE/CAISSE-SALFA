import { describe, expect, it } from 'vitest';
import { ecritureTest, livreTest, parametresTest } from '../test/fixtures';
import { estDateValide, validerEcriture, validerSauvegarde } from './validation';

describe('validation financière et calendaire', () => {
  it('accepte une écriture valide et conserve références et observation', () => {
    const e = ecritureTest({ reference: 'F-1', observation: 'Note', lignesDetail: [{ id: 'd1', libelle: 'Consultation', reference: 'Q-1', montant: 10000 }] });
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
    expect(validerSauvegarde(livreTest({ parametres: parametresTest({ soldeInitial: -500 }) })).parametres.soldeInitial).toBe(-500);
    expect(() => validerSauvegarde(livreTest({ parametres: parametresTest({ soldeInitial: Number.MAX_SAFE_INTEGER }), ecritures: [ecritureTest()] }))).toThrow('solde d’ouverture');
  });
  it('valide le format et la version des sauvegardes', () => {
    expect(() => validerSauvegarde({ ...livreTest(), version: 2 })).toThrow('Version');
    expect(() => validerSauvegarde({ ...livreTest(), format: 'AUTRE' })).toThrow('CAISSE SALFA');
  });

  it('refuse un livre incohérent : écriture hors exercice, archive postérieure ou report rompu', () => {
    const archive = { annee: 2025, clotureLe: '2025-12-31T18:00:00.000Z', soldeOuverture: 0, recettes: 1000, depenses: 0, soldeCloture: 1000, ecritures: [] };
    const base = { parametres: parametresTest({ soldeInitial: 1000, exercice: 2026, reportPrecedent: { annee: 2025, solde: 1000 } }), exercicesClotures: [archive] };
    expect(validerSauvegarde(livreTest(base)).exercicesClotures).toHaveLength(1);
    expect(() => validerSauvegarde(livreTest({ parametres: parametresTest(), ecritures: [ecritureTest({ date: '2025-11-03' })] })))
      .toThrow('hors de l’exercice 2026');
    expect(() => validerSauvegarde(livreTest({ ...base, parametres: parametresTest({ soldeInitial: 999, exercice: 2026 }) })))
      .toThrow('ne correspond pas à la clôture de 2025');
    expect(() => validerSauvegarde(livreTest({ ...base, exercicesClotures: [{ ...archive, soldeCloture: 1200 }] })))
      .toThrow('solde de clôture ne correspond pas');
    expect(() => validerSauvegarde(livreTest({ ...base, exercicesClotures: [archive, { ...archive, annee: 2026 }] })))
      .toThrow('ne peut pas être postérieur');
    const trou = { annee: 2023, clotureLe: '2023-12-31T18:00:00.000Z', soldeOuverture: 0, recettes: 0, depenses: 0, soldeCloture: 0, ecritures: [] };
    expect(() => validerSauvegarde(livreTest({ parametres: parametresTest({ exercice: 2026 }), exercicesClotures: [trou] })))
      .toThrow('chaîne des clôtures');
  });
});

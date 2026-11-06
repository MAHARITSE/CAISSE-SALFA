import { describe, expect, it } from 'vitest';
import { formaterSaisieMontant } from '../components/ChampMontant';
import { formatAr, montantAffiche, nombre, masqueMajuscules, parserMontant } from './format';

/** Espace insécable étroite utilisée comme séparateur de milliers. */
const SEP = '\u202f';

describe('masque de saisie des montants', () => {
  it('sépare les milliers pendant la frappe', () => {
    expect(formaterSaisieMontant('1')).toBe('1');
    expect(formaterSaisieMontant('1234')).toBe(`1${SEP}234`);
    expect(formaterSaisieMontant('1234567')).toBe(`1${SEP}234${SEP}567`);
    expect(formaterSaisieMontant('1000000')).toBe(`1${SEP}000${SEP}000`);
  });

  it('ignore ce qui n’est pas un chiffre et les zéros de tête', () => {
    expect(formaterSaisieMontant('12a34b')).toBe(`1${SEP}234`);
    expect(formaterSaisieMontant('0000')).toBe('0');
    expect(formaterSaisieMontant('012345')).toBe(`12${SEP}345`);
    expect(formaterSaisieMontant('1,5')).toBe('15');
  });

  it('produit toujours une valeur que le moteur accepte', () => {
    for (const saisie of ['0', '999', '1000', '1250000', '999999999999']) {
      expect(parserMontant(formaterSaisieMontant(saisie))).toBe(Number(saisie));
    }
    // Le champ reformate l'existant sans le corrompre.
    expect(parserMontant(formaterSaisieMontant('1 250 000'))).toBe(1250000);
  });

  it('accepte un signe négatif quand il est autorisé', () => {
    expect(formaterSaisieMontant('-50000', true)).toBe(`-50${SEP}000`);
    expect(parserMontant(formaterSaisieMontant('-50000', true), true)).toBe(-50000);
  });
});

describe('masque des libellés', () => {
  it('garde les majuscules actives sans changer la longueur', () => {
    expect(masqueMajuscules('achat de carburant')).toBe('ACHAT DE CARBURANT');
    expect(masqueMajuscules('Déjà Mixte')).toBe('DÉJÀ MIXTE');
    expect(masqueMajuscules('à conserver')).toHaveLength('à conserver'.length);
    expect(masqueMajuscules('')).toBe('');
  });
});

describe('affichage des montants', () => {
  it('sépare les milliers et affiche toujours deux décimales sans devise dans les tableaux', () => {
    expect(montantAffiche(116656000)).toBe(`116${SEP}656${SEP}000,00`);
    expect(montantAffiche(-1234.5)).toBe(`-1${SEP}234,50`);
    expect(formatAr(4626500)).toBe(`4${SEP}626${SEP}500,00 Ar`);
    expect(nombre(1234)).toBe(`1${SEP}234`);
  });
});

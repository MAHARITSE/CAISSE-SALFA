import { describe, expect, it } from 'vitest';
import { montantEnLettres, nombreEnLettres } from './nombreEnLettres';

describe('montant en toutes lettres', () => {
  it('écrit les nombres comme sur les bordereaux officiels', () => {
    expect(nombreEnLettres(0)).toBe('zéro');
    expect(nombreEnLettres(1)).toBe('un');
    expect(nombreEnLettres(16)).toBe('seize');
    expect(nombreEnLettres(21)).toBe('vingt et un');
    expect(nombreEnLettres(71)).toBe('soixante et onze');
    expect(nombreEnLettres(80)).toBe('quatre-vingts');
    expect(nombreEnLettres(81)).toBe('quatre-vingt-un');
    expect(nombreEnLettres(91)).toBe('quatre-vingt-onze');
    expect(nombreEnLettres(100)).toBe('cent');
    expect(nombreEnLettres(200)).toBe('deux cents');
    expect(nombreEnLettres(201)).toBe('deux cent un');
  });

  it('gère mille, millions et milliards', () => {
    expect(nombreEnLettres(1000)).toBe('mille');
    expect(nombreEnLettres(2000)).toBe('deux mille');
    expect(nombreEnLettres(80000)).toBe('quatre-vingt mille');
    expect(nombreEnLettres(1_000_000)).toBe('un million');
    expect(nombreEnLettres(2_000_001)).toBe('deux millions un');
    expect(nombreEnLettres(1_000_000_000)).toBe('un milliard');
  });

  it('reproduit les totaux des deux modèles fournis', () => {
    expect(nombreEnLettres(2_657_400)).toBe('deux millions six cent cinquante-sept mille quatre cents');
    expect(nombreEnLettres(4_042_000)).toBe('quatre millions quarante-deux mille');
  });

  it('produit la phrase du bordereau', () => {
    // Libellé relevé mot pour mot sur les deux modèles fournis.
    expect(montantEnLettres(4_042_000)).toBe('Arrêtez à la somme de quatre millions quarante-deux mille Ariary');
  });

  it('refuse ce qui n’est pas un entier positif', () => {
    expect(() => nombreEnLettres(-1)).toThrow();
    expect(() => nombreEnLettres(1.5)).toThrow();
  });
});

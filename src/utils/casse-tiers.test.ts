import { describe, expect, it } from 'vitest';
import { majusculesDebutMots } from './format';

describe('casse du tiers à enregistrer', () => {
  it('reproduit les majuscules initiales visibles sans changer les autres lettres', () => {
    expect(majusculesDebutMots('marovavy lucia')).toBe('Marovavy Lucia');
    expect(majusculesDebutMots('mr jean de l croix')).toBe('Mr Jean De L Croix');
    expect(majusculesDebutMots('école Jean-durant')).toBe('École Jean-Durant');
    expect(majusculesDebutMots('d’andria')).toBe('D’andria');
    expect(majusculesDebutMots('SALFA')).toBe('SALFA');
  });
});

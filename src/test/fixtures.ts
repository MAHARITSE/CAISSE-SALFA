import type { Ecriture, Sauvegarde } from '../types';
import { creerDonnees } from '../utils/ledger';

export function ecritureTest(overrides: Partial<Ecriture> = {}): Ecriture {
  return {
    id: 'e-test-1', numero: 'RC-2026-0001', date: '2026-11-03', sens: 'RECETTE',
    libelle: 'Recettes du jour', categorie: 'Recettes journalières', montant: 10000,
    mode: 'Espèces', createdAt: '2026-11-03T08:00:00.000Z', ...overrides,
  };
}

export function livreTest(overrides: Partial<Sauvegarde> = {}): Sauvegarde {
  return {
    format: 'CAISSE-SALFA', version: 1, revision: 0, updatedAt: '2026-11-03T09:00:00.000Z',
    ...creerDonnees(2026), ...overrides,
  };
}

/** Paramètres complets pour un exercice de test. */
export function parametresTest(overrides: Partial<Sauvegarde['parametres']> = {}) {
  return { soldeInitial: 0, exercice: 2026, reportPrecedent: null, ...overrides };
}

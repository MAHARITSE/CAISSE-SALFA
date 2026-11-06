/**
 * Livre reçu du serveur : le navigateur ne doit jamais casser.
 *
 * L'écran « L'affichage a rencontré un problème » venait d'un livre MySQL
 * partiel : la table des en-têtes était vide (`entetes` = `[]`) et les
 * catégories n'avaient pas encore été semées. `livre.entetes.lignes` levait
 * alors un TypeError, et l'application se fermait avant d'afficher quoi que
 * ce soit.
 */
import { describe, expect, it } from 'vitest';
import { normaliserLivreServeur } from './api';
import { enteteParDefaut } from './entete';
import { categoriesParDefaut } from './constants';

const base = {
  format: 'CAISSE-SALFA', version: 1, revision: 3, updatedAt: '2026-01-01T00:00:00.000Z',
  ecritures: [], parametres: { soldeInitial: 0, exercice: 2026, reportPrecedent: null },
  masques: [], compteurs: {}, exercicesClotures: [],
};

describe('normaliserLivreServeur', () => {
  it('remplace un en-tête absent par le modèle livré', () => {
    const livre = normaliserLivreServeur(base);
    expect(livre.entetes.lignes).toHaveLength(enteteParDefaut().lignes.length);
  });

  it('remplace un en-tête vide renvoyé par le serveur', () => {
    const livre = normaliserLivreServeur({ ...base, entetes: [] });
    expect(livre.entetes.lignes.length).toBeGreaterThan(0);
    expect(livre.entetes.mode).toBe('textes');
  });

  it('complète des catégories vides', () => {
    const livre = normaliserLivreServeur({ ...base, categories: { recette: [], depense: [] } });
    expect(livre.categories.recette).toEqual(categoriesParDefaut().recette);
    expect(livre.categories.depense).toEqual(categoriesParDefaut().depense);
  });

  it('accepte un livre totalement vide sans lever d’exception', () => {
    const livre = normaliserLivreServeur(null);
    expect(livre.ecritures).toEqual([]);
    expect(livre.entetes.lignes.length).toBeGreaterThan(0);
    expect(livre.categories.recette.length).toBeGreaterThan(0);
    expect(livre.parametres.exercice).toBeUndefined();
  });

  it('conserve les données réelles du serveur', () => {
    const ecriture = {
      id: 'e1', numero: 'RC-2026-0001', date: '2026-01-02', sens: 'RECETTE' as const,
      libelle: 'CONSULTATION', categorie: 'Consultations', montant: 5000,
      createdAt: '2026-01-02T08:00:00.000Z',
    };
    const livre = normaliserLivreServeur({ ...base, revision: 9, ecritures: [ecriture], compteurs: { 'RC-2026': 1 } });
    expect(livre.revision).toBe(9);
    expect(livre.ecritures[0]).toMatchObject({ numero: 'RC-2026-0001', montant: 5000 });
    expect(livre.compteurs).toEqual({ 'RC-2026': 1 });
  });
});

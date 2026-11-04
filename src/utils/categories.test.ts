import { describe, expect, it } from 'vitest';
import { categoriesParDefaut, categoriesPourListe } from './constants';
import { enregistrerCategories } from './ledger';
import { validerCategories, validerDonnees } from './validation';
import { livreTest } from '../test/fixtures';

describe('catégories de saisie', () => {
  it('livre deux listes distinctes : recettes et dépenses', () => {
    const { recette, depense } = categoriesParDefaut();
    expect(recette).toContain('Consultations');
    expect(depense).toContain('Achats médicaments');
    // Aucune catégorie de recette ne fuit côté dépense, et inversement.
    expect(depense).not.toContain('Consultations');
    expect(recette).not.toContain('Achats médicaments');
    expect(categoriesPourListe(categoriesParDefaut(), 'RECETTE')).toEqual(recette);
    expect(categoriesPourListe(categoriesParDefaut(), 'DEPENSE')).toEqual(depense);
  });

  it('modifie une seule liste, sans toucher à l’autre', () => {
    const depart = livreTest();
    const avant = depart.categories.recette;
    const apres = enregistrerCategories(depart, 'DEPENSE', ['Carburant', 'Entretien']);
    expect(apres.categories.depense).toEqual(['Carburant', 'Entretien']);
    expect(apres.categories.recette).toEqual(avant);
    expect(depart.categories.depense).not.toEqual(['Carburant', 'Entretien']);
  });

  it('nettoie les libellés et ignore les doublons sans la casse', () => {
    const resultat = validerCategories({ recette: ['  Soins ', 'SOINS', 'Laboratoire'], depense: ['Divers'] });
    expect(resultat.recette).toEqual(['Soins', 'Laboratoire']);
    expect(resultat.depense).toEqual(['Divers']);
  });

  it('refuse une liste vide et un libellé vide', () => {
    expect(() => validerCategories({ recette: [], depense: ['Divers'] })).toThrow('ne peut pas être vide');
    // Un libellé vide est refusé avant même la question de la liste vide.
    expect(() => validerCategories({ recette: ['Soins'], depense: ['   '] })).toThrow('valeur obligatoire');
    expect(() => enregistrerCategories(livreTest(), 'RECETTE', [''])).toThrow();
  });

  it('accepte un livre antérieur : les listes livrées prennent le relais', () => {
    const livre = livreTest();
    const sansCategories = { ...livre, categories: undefined };
    expect(validerDonnees(sansCategories).categories).toEqual(categoriesParDefaut());
    // Une seule liste absente est complétée sans écraser l'autre.
    const partiel = validerCategories({ recette: ['Soins'] });
    expect(partiel.recette).toEqual(['Soins']);
    expect(partiel.depense).toEqual(categoriesParDefaut().depense);
  });

  it('conserve une catégorie retirée sur les écritures existantes', () => {
    const livre = livreTest();
    const ecriture = {
      id: 'e-ancienne', numero: 'RC-2026-0001', date: '2026-11-03', sens: 'RECETTE' as const,
      libelle: 'Ancienne recette', categorie: 'Catégorie disparue', montant: 1000,
      createdAt: '2026-11-03T08:00:00.000Z',
    };
    const avec = validerDonnees({ ...livre, ecritures: [ecriture] });
    const sansCategorie = enregistrerCategories(avec, 'RECETTE', ['Consultations']);
    expect(sansCategorie.categories.recette).toEqual(['Consultations']);
    // L'écriture garde son libellé : aucune donnée historique n'est réécrite.
    expect(sansCategorie.ecritures[0].categorie).toBe('Catégorie disparue');
  });
});

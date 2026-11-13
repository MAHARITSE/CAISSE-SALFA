import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireSauvegarde } from './backup';
import { calculerJournal, totaliser } from './ledger';

describe('jeu d’essai livré', () => {
  const livre = lireSauvegarde(readFileSync('demo/jeu-essai.json', 'utf8'));
  it('est une sauvegarde valide', () => {
    expect(livre.ecritures).toHaveLength(52);
    expect(livre.parametres.exercice).toBe(2026);
  });
  it('alimente les trois derniers mois', () => {
    const journal = calculerJournal(livre);
    const mois = [...new Set(journal.map(e => e.date.slice(0, 7)))];
    expect(mois).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(totaliser(journal)).toEqual({ recettes: 24479650, depenses: 7374000 });
    expect(journal.at(-1)!.solde).toBe(18355650);
  });
  it('propose des pièces détaillées pour les deux bordereaux', () => {
    const avecDetails = livre.ecritures.filter(e => e.lignesDetail?.length);
    expect(avecDetails).toHaveLength(52);
    expect(new Set(livre.ecritures.map(e => e.sens))).toEqual(new Set(['RECETTE', 'DEPENSE']));
    // Un seul en-tête, commun aux deux imprimés.
    expect(livre.entetes).toHaveProperty('lignes');
    expect(livre.entetes).not.toHaveProperty('depense');
    expect(livre.entetes.images.length).toBeGreaterThanOrEqual(2);
  });
  it('inclut des comptes, clients, fournisseurs et virements d’exemple', () => {
    expect(livre.virements).toBeDefined();
    expect(livre.virements!.comptes).toHaveLength(2);
    expect(livre.virements!.tiers.filter(t => t.type === 'CLIENT').length).toBeGreaterThanOrEqual(4);
    expect(livre.virements!.tiers.filter(t => t.type === 'FOURNISSEUR').length).toBeGreaterThanOrEqual(5);
    expect(livre.virements!.ecritures.length).toBeGreaterThanOrEqual(6);
  });
});

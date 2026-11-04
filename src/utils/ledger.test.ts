import { describe, expect, it } from 'vitest';
import { ecritureTest, livreTest } from '../test/fixtures';
import { calculerJournal, enregistrerEcriture, filtrerJournal, prochainNumero, restaurerEcriture, soldeOuverture, supprimerEcriture, totaliser } from './ledger';

const filtres = { mois: '2026-11', toutAfficher: false, sens: 'TOUS' as const, categorie: '', recherche: '' };

describe('calculs du livre', () => {
  it('reporte le solde des mois précédents et trie stablement les écritures', () => {
    const donnees = livreTest({ parametres: { soldeInitial: 1000 }, ecritures: [
      ecritureTest({ id: 'b', numero: 'RC-2026-0002', montant: 200 }),
      ecritureTest({ id: 'a', numero: 'RC-2026-0001', montant: 100 }),
      ecritureTest({ id: 'oct', numero: 'RC-2026-0003', date: '2026-10-31', montant: 500 }),
      ecritureTest({ id: 'dep', numero: 'DP-2026-0001', sens: 'DEPENSE', montant: 50 }),
    ] });
    const journal = calculerJournal(donnees);
    expect(journal.map(e => e.id)).toEqual(['oct', 'a', 'b', 'dep']);
    expect(journal.map(e => e.solde)).toEqual([1500, 1600, 1800, 1750]);
    expect(soldeOuverture(journal, '2026-11', false, 1000)).toBe(1500);
    const mois = filtrerJournal(journal, filtres);
    expect(totaliser(mois)).toEqual({ recettes: 300, depenses: 50 });
  });
  it('recherche sans accent, y compris dans les références des postes', () => {
    const journal = calculerJournal(livreTest({ ecritures: [ecritureTest({ lignesDetail: [{ id: 'd', libelle: 'Médicament', reference: 'Q-été', montant: 10000 }] })] }));
    expect(filtrerJournal(journal, { ...filtres, recherche: 'medicament' })).toHaveLength(1);
    expect(filtrerJournal(journal, { ...filtres, recherche: 'q-ete' })).toHaveLength(1);
  });
  it('ne réutilise jamais le numéro supprimé et permet de restaurer la pièce', () => {
    let donnees = enregistrerEcriture(livreTest(), ecritureTest());
    const premiere = donnees.ecritures[0];
    expect(premiere.numero).toBe('RC-2026-0001');
    donnees = supprimerEcriture(donnees, premiere.id);
    expect(prochainNumero(donnees, 'RECETTE', premiere.date)).toBe('RC-2026-0002');
    donnees = enregistrerEcriture(donnees, ecritureTest({ id: 'nouvelle' }));
    expect(donnees.ecritures[0].numero).toBe('RC-2026-0002');
    donnees = restaurerEcriture(donnees, premiere);
    expect(donnees.ecritures).toHaveLength(2);
    expect(() => restaurerEcriture(donnees, premiere)).toThrow('existe déjà');
  });
  it('conserve le numéro et la création d’origine lors d’une édition', () => {
    const initial = enregistrerEcriture(livreTest(), ecritureTest());
    const e = initial.ecritures[0];
    const modifie = enregistrerEcriture(initial, { ...e, date: '2027-01-01', montant: 20000, numero: 'RC-2027-9999' });
    expect(modifie.ecritures[0].numero).toBe(e.numero);
    expect(modifie.ecritures[0].createdAt).toBe(e.createdAt);
    expect(modifie.ecritures[0].updatedAt).toBeTruthy();
  });
});

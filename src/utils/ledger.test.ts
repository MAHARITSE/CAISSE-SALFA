import { describe, expect, it } from 'vitest';
import { ecritureTest, livreTest, parametresTest } from '../test/fixtures';
import { validerDonnees } from './validation';
import { calculerJournal, cloturerExercice, migrerExercicesLegacy, enregistrerEcriture, filtrerJournal, prochainNumero, restaurerEcriture, soldeCloture, soldeOuverture, supprimerEcriture, totaliser } from './ledger';

const filtres = { mois: '2026-11', toutAfficher: false, sens: 'TOUS' as const, categorie: '', recherche: '' };

describe('calculs du livre', () => {
  it('reporte le solde des mois précédents et trie stablement les écritures', () => {
    const donnees = livreTest({ parametres: parametresTest({ soldeInitial: 1000 }), ecritures: [
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
    const modifie = enregistrerEcriture(initial, { ...e, date: '2026-12-31', montant: 20000, numero: 'RC-2026-9999' });
    expect(modifie.ecritures[0].numero).toBe(e.numero);
    expect(modifie.ecritures[0].createdAt).toBe(e.createdAt);
    expect(modifie.ecritures[0].updatedAt).toBeTruthy();
  });
  it('refuse une saisie hors de l’exercice ouvert', () => {
    const donnees = livreTest();
    expect(() => enregistrerEcriture(donnees, ecritureTest({ date: '2027-01-01' }))).toThrow('exercice 2026 ouvert');
  });
  it('clôture l’exercice : archive figée, solde reporté et compteurs conservés', () => {
    let donnees = enregistrerEcriture(livreTest({ parametres: parametresTest({ soldeInitial: 1000 }) }), ecritureTest({ montant: 5000 }));
    donnees = enregistrerEcriture(donnees, ecritureTest({ id: 'e-dep', numero: 'DP-2026-0001', sens: 'DEPENSE', categorie: 'Divers', montant: 2000 }));
    expect(soldeCloture(donnees)).toBe(4000);
    donnees = cloturerExercice(donnees, '2026-12-31T18:00:00.000Z');
    expect(donnees.ecritures).toEqual([]);
    expect(donnees.parametres).toEqual({ soldeInitial: 4000, exercice: 2027, reportPrecedent: { annee: 2026, solde: 4000 } });
    expect(donnees.exercicesClotures).toHaveLength(1);
    const archive = donnees.exercicesClotures[0];
    expect(archive).toMatchObject({ annee: 2026, soldeOuverture: 1000, recettes: 5000, depenses: 2000, soldeCloture: 4000 });
    expect(archive.ecritures).toHaveLength(2);
    // L'exercice suivant numérote dans sa propre année, sans réutiliser ceux de l'archive.
    expect(prochainNumero(donnees, 'RECETTE', '2027-01-05')).toBe('RC-2027-0001');
    expect(() => enregistrerEcriture(donnees, ecritureTest({ date: '2026-12-31' }))).toThrow('exercice 2027 ouvert');
    // Une seconde clôture ouvre 2028 sans réécrire l'archive 2026.
    const seconde = cloturerExercice(donnees, '2027-12-31T18:00:00.000Z');
    expect(seconde.exercicesClotures.map(c => c.annee)).toEqual([2026, 2027]);
    expect(seconde.exercicesClotures[0]).toEqual(archive);
    expect(seconde.parametres.exercice).toBe(2028);
    expect(seconde.parametres.soldeInitial).toBe(4000);
  });

  it('normalise un livre multi-années antérieur aux exercices : années passées archivées, année courante ouverte', () => {
    const livre = livreTest({
      parametres: { soldeInitial: 500, exercice: undefined, reportPrecedent: null },
      ecritures: [
        ecritureTest({ id: 'a', numero: 'RC-2025-0001', date: '2025-06-01', montant: 2000 }),
        ecritureTest({ id: 'b', numero: 'DP-2025-0001', sens: 'DEPENSE', date: '2025-07-01', montant: 500 }),
        ecritureTest({ id: 'c', numero: 'RC-2026-0001', date: '2026-02-01', montant: 100 }),
      ],
    });
    const { livre: normalise, avertissement } = migrerExercicesLegacy(livre, 2026);
    expect(avertissement).toContain('clôturés automatiquement');
    expect(normalise.parametres).toMatchObject({ exercice: 2026, soldeInitial: 2000, reportPrecedent: { annee: 2025, solde: 2000 } });
    expect(normalise.ecritures.map(e => e.id)).toEqual(['c']);
    expect(normalise.exercicesClotures).toHaveLength(1);
    expect(normalise.exercicesClotures[0]).toMatchObject({ annee: 2025, soldeOuverture: 500, recettes: 2000, depenses: 500, soldeCloture: 2000 });
    // Un livre déjà conforme n'est pas modifié.
    expect(migrerExercicesLegacy(normalise, 2026)).toEqual({ livre: normalise, avertissement: null });

    // Années discontinues : la chaîne reste continue, les années vides sont archivées à zéro.
    const discontinu = migrerExercicesLegacy(livreTest({
      parametres: { soldeInitial: 0, exercice: undefined, reportPrecedent: null },
      ecritures: [ecritureTest({ numero: 'RC-2023-0001', date: '2023-05-05', montant: 700 })],
    }), 2026).livre;
    expect(discontinu.exercicesClotures.map(c => c.annee)).toEqual([2023, 2024, 2025]);
    expect(discontinu.exercicesClotures.map(c => c.soldeCloture)).toEqual([700, 700, 700]);
    expect(discontinu.parametres).toEqual({ soldeInitial: 700, exercice: 2026, reportPrecedent: { annee: 2025, solde: 700 } });
    // Le livre normalisé reste valide (chaîne des soldes contrôlée à l'enregistrement).
    expect(() => validerDonnees(discontinu)).not.toThrow();
  });
});

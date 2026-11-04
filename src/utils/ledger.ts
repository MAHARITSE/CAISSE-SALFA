import type { DonneesCaisse, Ecriture, FiltresJournal, LigneJournal, Sens } from '../types';
import { masquesParDefaut } from './constants';
import { dateValide, exiger, validerDonnees } from './validation';

export function identifiant(prefixe = 'e'): string {
  const aleatoire = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefixe}-${aleatoire}`;
}

export function creerDonnees(): DonneesCaisse {
  return { ecritures: [], parametres: { soldeInitial: 0 }, masques: masquesParDefaut(), compteurs: {} };
}

/** Tri stable, même date et même horodatage : l'identifiant départage les pièces. */
export function comparerEcritures(a: Ecriture, b: Ecriture): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function calculerJournal(donnees: DonneesCaisse): LigneJournal[] {
  let solde = donnees.parametres.soldeInitial;
  return [...donnees.ecritures].sort(comparerEcritures).map(e => {
    solde += e.sens === 'RECETTE' ? e.montant : -e.montant;
    exiger(Number.isSafeInteger(solde), 'Le solde cumulé dépasse la précision numérique fiable.');
    return { ...e, solde };
  });
}

export function totaliser(lignes: Pick<Ecriture, 'sens' | 'montant'>[]) {
  return lignes.reduce((t, e) => {
    t[e.sens === 'RECETTE' ? 'recettes' : 'depenses'] += e.montant;
    return t;
  }, { recettes: 0, depenses: 0 });
}

export function soldeOuverture(journal: LigneJournal[], mois: string, tout: boolean, initial: number): number {
  if (tout) return initial;
  let solde = initial;
  for (const e of journal) {
    if (e.date >= `${mois}-01`) break;
    solde = e.solde;
  }
  return solde;
}

export function normaliserRecherche(valeur: string): string {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filtrerJournal(journal: LigneJournal[], f: FiltresJournal): LigneJournal[] {
  const q = normaliserRecherche(f.recherche);
  return journal.filter(e => {
    if (!f.toutAfficher && e.date.slice(0, 7) !== f.mois) return false;
    if (f.sens !== 'TOUS' && e.sens !== f.sens) return false;
    if (f.categorie && e.categorie !== f.categorie) return false;
    if (!q) return true;
    const champs = [e.libelle, e.categorie, e.numero, e.tiers, e.reference, e.observation,
      ...(e.lignesDetail?.flatMap(l => [l.libelle, l.reference]) ?? [])];
    return champs.some(c => c && normaliserRecherche(c).includes(q));
  });
}

export function prefixeNumero(sens: Sens, date: string): string {
  return `${sens === 'RECETTE' ? 'RC' : 'DP'}-${date.slice(0, 4)}-`;
}

/** Le compteur conservé empêche la réutilisation du numéro d'une pièce supprimée. */
export function prochainNumero(donnees: DonneesCaisse, sens: Sens, date: string): string {
  const prefixe = prefixeNumero(sens, date);
  let max = donnees.compteurs[prefixe.slice(0, -1)] ?? 0;
  for (const e of donnees.ecritures) {
    if (e.sens === sens && e.numero.startsWith(prefixe)) {
      const suffixe = e.numero.slice(prefixe.length);
      if (/^\d+$/.test(suffixe)) max = Math.max(max, Number(suffixe));
    }
  }
  exiger(max < 1_000_000_000, 'Limite de numérotation atteinte pour cette année.');
  return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}

export function enregistrerEcriture(donnees: DonneesCaisse, saisie: Ecriture): DonneesCaisse {
  const ancienne = donnees.ecritures.find(e => e.id === saisie.id);
  let ecriture: Ecriture;
  const compteurs = { ...donnees.compteurs };
  if (ancienne) {
    // Une modification ne change ni l'identité de la pièce, ni son numéro d'origine.
    ecriture = { ...saisie, numero: ancienne.numero, sens: ancienne.sens, createdAt: ancienne.createdAt, updatedAt: new Date().toISOString() };
  } else {
    const numero = prochainNumero(donnees, saisie.sens, saisie.date);
    ecriture = { ...saisie, numero, createdAt: new Date().toISOString(), updatedAt: undefined };
    const prefixe = prefixeNumero(saisie.sens, saisie.date).slice(0, -1);
    compteurs[prefixe] = Number(numero.slice(prefixe.length + 1));
  }
  const ecritures = ancienne ? donnees.ecritures.map(e => e.id === ecriture.id ? ecriture : e) : [...donnees.ecritures, ecriture];
  return validerDonnees({ ...donnees, ecritures, compteurs });
}

export function supprimerEcriture(donnees: DonneesCaisse, id: string): DonneesCaisse {
  exiger(donnees.ecritures.some(e => e.id === id), 'Cette écriture n’existe plus. Actualisez le livre.');
  return { ...donnees, ecritures: donnees.ecritures.filter(e => e.id !== id) };
}

export function restaurerEcriture(donnees: DonneesCaisse, ecriture: Ecriture): DonneesCaisse {
  exiger(!donnees.ecritures.some(e => e.id === ecriture.id || e.numero.toLowerCase() === ecriture.numero.toLowerCase()),
    'Cette pièce existe déjà : annulation impossible.');
  return validerDonnees({ ...donnees, ecritures: [...donnees.ecritures, ecriture] });
}

export function changerSoldeInitial(donnees: DonneesCaisse, soldeInitial: number): DonneesCaisse {
  return validerDonnees({ ...donnees, parametres: { soldeInitial } });
}

export function enregistrerMasques(donnees: DonneesCaisse, masques: DonneesCaisse['masques']): DonneesCaisse {
  return validerDonnees({ ...donnees, masques });
}

export function analyseCategories(lignes: Ecriture[], sens: Sens) {
  const map = new Map<string, { nom: string; montant: number; nombre: number }>();
  let total = 0;
  for (const e of lignes) {
    if (e.sens !== sens) continue;
    const courant = map.get(e.categorie) ?? { nom: e.categorie, montant: 0, nombre: 0 };
    courant.montant += e.montant;
    courant.nombre++;
    map.set(e.categorie, courant);
    total += e.montant;
  }
  return { total, categories: [...map.values()].sort((a, b) => b.montant - a.montant).map(c => ({ ...c, part: total ? c.montant / total * 100 : 0 })) };
}

export function verifierDate(date: string): string {
  return dateValide(date, 'Date de l’opération');
}

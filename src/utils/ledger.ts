import type { DonneesCaisse, Ecriture, ExerciceCloture, FiltresJournal, LigneJournal, Sauvegarde, Sens } from '../types';
import { ANNEE_MAX, ANNEE_MIN, categoriesParDefaut, masquesParDefaut, MONTANT_MAX } from './constants';
import { dateValide, exiger, validerDonnees } from './validation';
import { entetesParDefaut, normaliserEntetes, type DocumentEntete, type EnteteDocument } from './entete';

export function identifiant(prefixe = 'e'): string {
  const aleatoire = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefixe}-${aleatoire}`;
}

export function creerDonnees(annee = new Date().getFullYear()): DonneesCaisse {
  return {
    ecritures: [], parametres: { soldeInitial: 0, exercice: annee, reportPrecedent: null },
    masques: masquesParDefaut(), compteurs: {}, exercicesClotures: [], entetes: entetesParDefaut(),
    categories: categoriesParDefaut(),
  };
}

const anneeDe = (date: string): number => Number(date.slice(0, 4));

/** Un livre ne contient qu'un exercice : une saisie hors exercice est refusée, pas décalée. */
export function exigerExercice(donnees: DonneesCaisse, date: string): void {
  const annee = anneeDe(date);
  exiger(annee === donnees.parametres.exercice,
    `La date doit appartenir à l’exercice ${donnees.parametres.exercice} ouvert. Clôturez l’exercice pour passer à l’année suivante.`);
}

/** Solde de clôture de l'exercice ouvert, hors filtres. */
export function soldeCloture(donnees: DonneesCaisse): number {
  const journal = calculerJournal(donnees);
  return journal.length ? journal[journal.length - 1].solde : donnees.parametres.soldeInitial;
}

/**
 * Clôture l'exercice ouvert : ses écritures deviennent une archive figée et le suivant
 * repart avec le solde reporté, sans historique cumulé interminable.
 * La validation finale garantit qu'une clôture invalide n'est jamais enregistrée.
 */
export function cloturerExercice(donnees: DonneesCaisse, clotureLe = new Date().toISOString()): DonneesCaisse {
  const soldeInitial = donnees.parametres.soldeInitial;
  const exercice = donnees.parametres.exercice ?? new Date().getFullYear();
  // Une année ne se clôture qu'une fois révolue : pas de clôture anticipée en cours d'année.
  exiger(anneeDe(clotureLe) > exercice,
    `L’exercice ${exercice} ne peut être clôturé qu’à partir du 1er janvier ${exercice + 1}, une fois l’année révolue.`);
  // Un même exercice ne peut être clôturé qu'une fois : on ne réécrit jamais une archive.
  exiger(!donnees.exercicesClotures.some(c => c.annee === exercice),
    `L’exercice ${exercice} est déjà clôturé : ses écritures ne comptent plus dans le livre.`);
  exiger(exercice < ANNEE_MAX, 'Année maximale atteinte : impossible d’ouvrir un exercice suivant.');
  const { recettes, depenses } = totaliser(donnees.ecritures);
  const soldeFin = soldeInitial + recettes - depenses;
  exiger(Number.isSafeInteger(soldeFin) && Math.abs(soldeFin) <= MONTANT_MAX,
    'Le solde de clôture dépasse la plage autorisée. Vérifiez les montants avant de clôturer.');
  const archive: ExerciceCloture = {
    annee: exercice, clotureLe,
    soldeOuverture: soldeInitial, recettes, depenses, soldeCloture: soldeFin,
    ecritures: [...donnees.ecritures].sort(comparerEcritures),
  };
  const cloture: DonneesCaisse = {
    ecritures: [],
    parametres: {
      soldeInitial: soldeFin,
      exercice: exercice + 1,
      reportPrecedent: { annee: exercice, solde: soldeFin },
    },
    masques: donnees.masques,
    entetes: donnees.entetes,
    categories: donnees.categories,
    compteurs: donnees.compteurs,
    exercicesClotures: [...donnees.exercicesClotures, archive].sort((a, b) => a.annee - b.annee),
  };
  // Revalide l'ensemble : une clôture incohérente n'est jamais enregistrée.
  return { ...validerDonnees(cloture), exercicesClotures: cloture.exercicesClotures };
}

/** Clôture automatique des années passées d'un livre créé avant la gestion des exercices. */
export function migrerExercicesLegacy(livre: Sauvegarde, anneeCourante: number): { livre: Sauvegarde; avertissement: string | null } {
  const exercice = livre.parametres?.exercice;
  const annees = [...new Set(livre.ecritures.map(e => anneeDe(e.date)))].sort((a, b) => a - b);
  if (typeof exercice === 'number' && annees.every(a => a === exercice)) {
    return { livre, avertissement: null };
  }
  const cible = typeof exercice === 'number'
    ? Math.max(exercice, ...annees)
    : Math.max(anneeCourante, ...annees);
  let solde = livre.parametres?.soldeInitial ?? 0;
  const archives: ExerciceCloture[] = [];
  // Chaîne continue depuis la première année mouvementée : une année vide est archivée à zéro,
  // mais un livre qui commence cette année n'invente pas d'exercice antérieur.
  for (let annee = annees.length ? annees[0] : cible; annee < cible; annee++) {
    const ecritures = livre.ecritures.filter(e => anneeDe(e.date) === annee).sort(comparerEcritures);
    const { recettes, depenses } = totaliser(ecritures);
    archives.push({
      annee, clotureLe: `${annee}-12-31T23:59:59.000Z`,
      soldeOuverture: solde, recettes, depenses, soldeCloture: solde + recettes - depenses,
      ecritures,
    });
    solde += recettes - depenses;
  }
  const restantes = livre.ecritures.filter(e => anneeDe(e.date) === cible);
  const derniere = archives[archives.length - 1];
  const dejaArchivees = new Set((livre.exercicesClotures ?? []).map(c => c.annee));
  const nouvelles = archives.filter(a => !dejaArchivees.has(a.annee));
  return {
    livre: {
      ...livre,
      ecritures: restantes,
      parametres: {
        soldeInitial: derniere ? derniere.soldeCloture : livre.parametres?.soldeInitial ?? 0,
        exercice: cible,
        reportPrecedent: derniere ? { annee: derniere.annee, solde: derniere.soldeCloture } : null,
      },
      exercicesClotures: [...(livre.exercicesClotures ?? []), ...nouvelles].sort((a, b) => a.annee - b.annee),
    },
    avertissement: nouvelles.length
      ? `Vos données couvraient plusieurs années : les exercices ${nouvelles.map(a => a.annee).join(', ')} ont été clôturés automatiquement et archivés. L’exercice ${cible} est maintenant ouvert. Vérifiez l’onglet « Exercices & clôtures » puis téléchargez une sauvegarde.`
      : null,
  };
}

/** Une clôture n'est possible qu'à partir du 1er janvier suivant l'exercice. */
export function clotureAutorisee(exercice: number, aujourdHui = new Date()): boolean {
  const a = aujourdHui.getFullYear();
  return a > exercice;
}

export function exigerAnnee(annee: number): void {
  exiger(Number.isInteger(annee) && annee >= ANNEE_MIN && annee <= ANNEE_MAX,
    `Année invalide : une année entre ${ANNEE_MIN} et ${ANNEE_MAX} est attendue.`);
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
  exigerExercice(donnees, saisie.date);
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
  exigerExercice(donnees, ecriture.date);
  exiger(!donnees.ecritures.some(e => e.id === ecriture.id || e.numero.toLowerCase() === ecriture.numero.toLowerCase()),
    'Cette pièce existe déjà : annulation impossible.');
  return validerDonnees({ ...donnees, ecritures: [...donnees.ecritures, ecriture] });
}

export function changerSoldeInitial(donnees: DonneesCaisse, soldeInitial: number): DonneesCaisse {
  return validerDonnees({ ...donnees, parametres: { soldeInitial } });
}

/** Enregistre l'en-tête d'un seul document, sans toucher à l'autre. */
export function enregistrerEntete(donnees: DonneesCaisse, document: DocumentEntete, entete: EnteteDocument): DonneesCaisse {
  const entetes = normaliserEntetes({ ...donnees.entetes, [document]: entete });
  const propre = entetes[document];
  exiger(propre.mode === 'image' ? propre.image !== '' : propre.lignes.some(l => l.texte.trim() !== ''),
    'L’en-tête est vide : choisissez une image ou renseignez au moins une ligne de texte.');
  return { ...donnees, entetes };
}

/** Remplace les catégories d'un sens, sans toucher à l'autre liste. */
export function enregistrerCategories(donnees: DonneesCaisse, sens: Sens, categories: string[]): DonneesCaisse {
  const donneesSuivantes = { ...donnees, categories: { ...donnees.categories, [sens === 'RECETTE' ? 'recette' : 'depense']: categories } };
  return { ...donnees, categories: validerDonnees(donneesSuivantes).categories };
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

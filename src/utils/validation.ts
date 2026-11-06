import type { DonneesCaisse, Ecriture, ExerciceCloture, LigneDetail, MasqueSaisie, Parametres, Sauvegarde, Sens } from '../types';
import { ANNEE_MAX, ANNEE_MIN, MAX_CATEGORIES, MAX_CLOTURES, MAX_DETAILS, MAX_ECRITURES, MAX_LONGUEUR_CATEGORIE, MONTANT_MAX, categoriesParDefaut, categoriesPour } from './constants';
import { entetesParDefaut, normaliserEntetes } from './entete';
import type { Categories } from '../types';

/** Une erreur de validation est toujours bloquante : aucune ligne n'est écartée en silence. */
export function exiger(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function objet(valeur: unknown, champ: string): Record<string, unknown> {
  exiger(valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur), `${champ} : objet attendu.`);
  return valeur as Record<string, unknown>;
}

export function tableau(valeur: unknown, champ: string, max: number): unknown[] {
  exiger(Array.isArray(valeur), `${champ} : liste attendue.`);
  exiger(valeur.length <= max, `${champ} : nombre maximal dépassé (${max}).`);
  return valeur;
}

export function texte(valeur: unknown, champ: string, max = 200, obligatoire = false): string {
  exiger(typeof valeur === 'string', `${champ} : texte attendu.`);
  const propre = valeur.trim();
  exiger(!obligatoire || propre.length > 0, `${champ} : valeur obligatoire.`);
  exiger(propre.length <= max, `${champ} : ${max} caractères maximum.`);
  return propre;
}

function texteFacultatif(valeur: unknown, champ: string, max = 200): string | undefined {
  if (valeur === undefined || valeur === null || valeur === '') return undefined;
  return texte(valeur, champ, max) || undefined;
}

export function montantEntier(valeur: unknown, champ: string, maximum = MONTANT_MAX): number {
  exiger(typeof valeur === 'number' && Number.isSafeInteger(valeur) && valeur >= 0 && valeur <= maximum,
    `${champ} : montant entier entre 0 et ${maximum.toLocaleString('fr-FR')} Ar attendu.`);
  return valeur;
}

export function montantPoste(valeur: unknown, champ: string, maximum = MONTANT_MAX): number {
  exiger(typeof valeur === 'number' && Number.isSafeInteger(valeur) && Math.abs(valeur) <= maximum,
    `${champ} : montant entier entre -${maximum.toLocaleString('fr-FR')} et ${maximum.toLocaleString('fr-FR')} Ar attendu.`);
  return valeur;
}

export function estDateValide(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const annee = Number(valeur.slice(0, 4));
  if (annee < 1900 || annee > 9999) return false;
  const date = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === valeur;
}

export function dateValide(valeur: unknown, champ: string): string {
  exiger(estDateValide(valeur), `${champ} : date réelle au format AAAA-MM-JJ attendue (année ≥ 1900).`);
  return valeur;
}

export function horodatage(valeur: unknown, champ: string): string {
  exiger(typeof valeur === 'string' && valeur.length <= 40 && Number.isFinite(Date.parse(valeur)),
    `${champ} : horodatage invalide.`);
  return valeur;
}

function sensValide(valeur: unknown, champ: string): Sens {
  exiger(valeur === 'RECETTE' || valeur === 'DEPENSE', `${champ} : type d’opération invalide.`);
  return valeur;
}

export function validerEcriture(valeur: unknown, chemin = 'Écriture'): Ecriture {
  const e = objet(valeur, chemin);
  const sens = sensValide(e.sens, chemin);
  const champ = `${chemin}${typeof e.numero === 'string' ? ` (${e.numero.slice(0, 80)})` : ''}`;
  let lignesDetail: LigneDetail[] | undefined;
  if (e.lignesDetail !== undefined && e.lignesDetail !== null) {
    const ids = new Set<string>();
    lignesDetail = tableau(e.lignesDetail, `${champ}.détails`, MAX_DETAILS).map((v, i) => {
      const l = objet(v, `${champ}.poste ${i + 1}`);
      const id = texte(l.id, 'Identifiant du poste', 120, true);
      exiger(!ids.has(id), `${champ} : identifiant de poste en double.`);
      ids.add(id);
      return {
        id,
        libelle: texte(l.libelle, 'Libellé du poste', 200, true),
        reference: texteFacultatif(l.reference, 'Référence du poste'),
        montant: montantPoste(l.montant, 'Montant du poste'),
      };
    }).filter(l => l.montant !== 0);
    exiger(lignesDetail.some(l => l.montant > 0), `${champ} : un détail doit contenir au moins un montant positif.`);
  }
  const montant = montantEntier(e.montant, `${champ}.montant`);
  exiger(montant > 0, `${champ} : le montant doit être supérieur à zéro.`);
  if (lignesDetail) {
    const total = lignesDetail.reduce((s, l) => s + l.montant, 0);
    exiger(total === montant, `${champ} : le total ne correspond pas à la somme des postes.`);
  }
  return {
    id: texte(e.id, 'Identifiant de l’écriture', 120, true),
    numero: texte(e.numero, `${champ}.numéro`, 80, true),
    date: dateValide(e.date, `${champ}.date`),
    sens,
    libelle: texte(e.libelle, `${champ}.libellé`, 200, true),
    categorie: texte(e.categorie, `${champ}.catégorie`, 120, true),
    tiers: texteFacultatif(e.tiers, `${champ}.tiers`),
    montant,
    lignesDetail: lignesDetail?.length ? lignesDetail : undefined,
    mode: texteFacultatif(e.mode, `${champ}.mode`, 80),
    reference: texteFacultatif(e.reference, `${champ}.référence`),
    observation: texteFacultatif(e.observation, `${champ}.observation`, 2000),
    createdAt: horodatage(e.createdAt, `${champ}.création`),
    updatedAt: e.updatedAt == null ? undefined : horodatage(e.updatedAt, `${champ}.modification`),
  };
}

function validerMasque(valeur: unknown, index: number): MasqueSaisie {
  const m = objet(valeur, `Masque ${index + 1}`);
  const lignes = tableau(m.lignes, `${m.nom}.postes`, MAX_DETAILS);
  exiger(lignes.length > 0, `Le masque ${index + 1} doit contenir au moins un poste.`);
  return {
    id: texte(m.id, 'Identifiant du masque', 120, true),
    nom: texte(m.nom, 'Nom du masque', 120, true),
    sens: sensValide(m.sens, 'Type du masque'),
    description: texteFacultatif(m.description, 'Description du masque', 500),
    libelle: texteFacultatif(m.libelle, 'Libellé associé du masque', 200),
    lignes: lignes.map((v, i) => {
      const l = objet(v, `Poste ${i + 1}`);
      return {
        description: texte(l.description, 'Description du poste', 200, true),
        montantDefaut: l.montantDefaut == null ? undefined : montantEntier(l.montantDefaut, 'Montant par défaut'),
      };
    }),
  };
}

function validerParametres(valeur: unknown): Parametres {
  const p = objet(valeur, 'Paramètres');
  exiger(typeof p.soldeInitial === 'number' && Number.isSafeInteger(p.soldeInitial) && Math.abs(p.soldeInitial) <= MONTANT_MAX,
    'Le solde d’ouverture doit être un montant entier valide (un solde négatif est autorisé).');
  const exercice: number | undefined = p.exercice == null ? undefined : (p.exercice as number);
  exiger(exercice === undefined || (Number.isInteger(exercice) && exercice >= ANNEE_MIN && exercice <= ANNEE_MAX),
    `Exercice invalide : une année entre ${ANNEE_MIN} et ${ANNEE_MAX} est attendue.`);
  let reportPrecedent: Parametres['reportPrecedent'] = null;
  if (p.reportPrecedent != null) {
    const r = objet(p.reportPrecedent, 'Report de l’exercice précédent');
    exiger(exercice !== undefined && typeof r.annee === 'number' && Number.isInteger(r.annee) && r.annee === exercice - 1,
      'Le report doit provenir de l’exercice immédiatement précédent.');
    exiger(typeof r.solde === 'number' && Number.isSafeInteger(r.solde) && Math.abs(r.solde) <= MONTANT_MAX,
      'Le solde reporté doit être un montant entier valide.');
    reportPrecedent = { annee: r.annee, solde: r.solde };
  }
  return { soldeInitial: p.soldeInitial, exercice, reportPrecedent };
}

function validerCloture(valeur: unknown, index: number): ExerciceCloture {
  const c = objet(valeur, `Exercice clôturé ${index + 1}`);
  exiger(typeof c.annee === 'number' && Number.isInteger(c.annee) && c.annee >= ANNEE_MIN && c.annee <= ANNEE_MAX,
    `Exercice clôturé ${index + 1} : année invalide.`);
  const montant = (v: unknown, champ: string): number => {
    exiger(typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= MONTANT_MAX,
      `Exercice ${c.annee} : ${champ} doit être un montant entier valide.`);
    return v;
  };
  const ecritures = tableau(c.ecritures, `Exercice ${c.annee}.écritures`, MAX_ECRITURES)
    .map((e, i) => validerEcriture(e, `Exercice ${c.annee}, écriture ${i + 1}`));
  for (const e of ecritures) {
    exiger(Number(e.date.slice(0, 4)) === c.annee, `Exercice ${c.annee} : l’écriture ${e.numero} porte une autre année.`);
  }
  const soldeOuverture = montant(c.soldeOuverture, 'le solde d’ouverture');
  const recettes = montant(c.recettes, 'le total des recettes');
  const depenses = montant(c.depenses, 'le total des dépenses');
  const soldeCloture = montant(c.soldeCloture, 'le solde de clôture');
  exiger(recettes + depenses <= MAX_ECRITURES * MONTANT_MAX, `Exercice ${c.annee} : totaux incohérents.`);
  exiger(soldeOuverture + recettes - depenses === soldeCloture,
    `Exercice ${c.annee} : le solde de clôture ne correspond pas aux mouvements archivés.`);
  return {
    annee: c.annee,
    clotureLe: horodatage(c.clotureLe, `Exercice ${c.annee}.clôture`),
    soldeOuverture, recettes, depenses, soldeCloture, ecritures,
  };
}

/**
 * Catégories de saisie, séparées par sens. Une catégorie peut toutefois avoir
 * disparu de la liste : les écritures déjà enregistrées restent lisibles.
 */
export function validerCategories(valeur: unknown): Categories {
  if (valeur === undefined || valeur === null) return categoriesParDefaut();
  const c = objet(valeur, 'Catégories');
  const liste = (v: unknown, sens: Sens): string[] => {
    if (v === undefined || v === null) return categoriesPour(sens);
    const brutes = tableau(v, `Catégories de ${sens === 'RECETTE' ? 'recettes' : 'dépenses'}`, MAX_CATEGORIES);
    const vues = new Set<string>();
    const propres: string[] = [];
    for (const [index, brut] of brutes.entries()) {
      const nom = texte(brut, `Catégorie ${index + 1}`, MAX_LONGUEUR_CATEGORIE, true).trim();
      const cle = nom.toLowerCase();
      if (vues.has(cle)) continue; // un doublon est ignoré, il n'empêche pas l'enregistrement
      vues.add(cle);
      propres.push(nom);
    }
    exiger(propres.length > 0, `La liste des catégories de ${sens === 'RECETTE' ? 'recettes' : 'dépenses'} ne peut pas être vide.`);
    return propres;
  };
  return { recette: liste(c.recette, 'RECETTE'), depense: liste(c.depense, 'DEPENSE') };
}

export function validerDonnees(valeur: unknown): DonneesCaisse {
  const d = objet(valeur, 'Livre');
  const liste = tableau(d.ecritures, 'Écritures', MAX_ECRITURES);
  const ecritures = liste.map((e, i) => validerEcriture(e, `Écriture ${i + 1}`));
  const ids = new Set<string>();
  const numeros = new Set<string>();
  for (const e of ecritures) {
    exiger(!ids.has(e.id), `Identifiant d’écriture en double : ${e.id}.`);
    exiger(!numeros.has(e.numero.toLowerCase()), `Numéro de pièce en double : ${e.numero}.`);
    ids.add(e.id);
    numeros.add(e.numero.toLowerCase());
  }
  const p = objet(d.parametres, 'Paramètres');
  const parametres = validerParametres(p);
  const masques = tableau(d.masques, 'Masques', 500).map(validerMasque);
  const idsMasques = new Set<string>();
  for (const m of masques) {
    exiger(!idsMasques.has(m.id), `Identifiant de masque en double : ${m.id}.`);
    idsMasques.add(m.id);
  }
  const compteursBruts = objet(d.compteurs ?? {}, 'Compteurs');
  const compteurs: Record<string, number> = {};
  for (const [cle, v] of Object.entries(compteursBruts)) {
    exiger(/^(RC|DP)-\d{4}$/.test(cle), `Compteur invalide : ${cle}.`);
    exiger(typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000_000,
      `Compteur ${cle} : entier positif invalide.`);
    compteurs[cle] = v;
  }
  const exercicesClotures = tableau(d.exercicesClotures ?? [], 'Exercices clôturés', MAX_CLOTURES)
    .map(validerCloture).sort((a, b) => a.annee - b.annee);
  const annees = new Set<number>();
  for (const c of exercicesClotures) {
    exiger(!annees.has(c.annee), `L’exercice ${c.annee} est archivé en double.`);
    if (parametres.exercice !== undefined) {
      exiger(c.annee < parametres.exercice, `L’exercice clôturé ${c.annee} ne peut pas être postérieur à l’exercice ouvert ${parametres.exercice}.`);
    }
    annees.add(c.annee);
  }
  // Chaîne de clôture continue : chaque exercice clôturé se termine par le solde qui ouvre le suivant.
  for (const c of exercicesClotures) {
    const suivant = exercicesClotures.find(x => x.annee === c.annee + 1);
    if (suivant) {
      exiger(suivant.soldeOuverture === c.soldeCloture,
        `Exercices ${c.annee} et ${suivant.annee} : le solde reporté ne correspond pas à la clôture précédente.`);
    } else if (parametres.exercice !== undefined && c.annee + 1 === parametres.exercice) {
      exiger(parametres.soldeInitial === c.soldeCloture,
        `Le solde d’ouverture de ${parametres.exercice} ne correspond pas à la clôture de ${c.annee}.`);
    }
    if (parametres.exercice !== undefined && c.annee < parametres.exercice - 1) {
      exiger(exercicesClotures.some(x => x.annee === c.annee + 1),
        `Exercice ${c.annee + 1} manquant : la chaîne des clôtures doit être continue jusqu’à ${parametres.exercice}.`);
    }
  }
  let solde = parametres.soldeInitial;
  for (const e of ecritures) {
    // Un livre ancien sans exercice reste lisible ; il est normalisé à l'ouverture.
    exiger(parametres.exercice === undefined || Number(e.date.slice(0, 4)) === parametres.exercice,
      `L’écriture ${e.numero} appartient à ${e.date.slice(0, 4)}, hors de l’exercice ${parametres.exercice} ouvert.`);
    solde += e.sens === 'RECETTE' ? e.montant : -e.montant;
    exiger(Number.isSafeInteger(solde), 'Le solde cumulé dépasse la précision numérique fiable. Réduisez les montants du livre.');
  }
  // Un livre qui ne fige pas son en-tête (sauvegarde générique, jeu d'essai)
  // reprend celui livré par l'application, sans copie obsolète.
  const entetes = d.entetes === undefined ? normaliserEntetes(entetesParDefaut()) : normaliserEntetes(d.entetes);
  const categories = validerCategories(d.categories);
  return { ecritures, parametres, masques, compteurs, exercicesClotures, entetes, categories };
}

export function validerSauvegarde(valeur: unknown): Sauvegarde {
  const s = objet(valeur, 'Sauvegarde');
  exiger(s.format === 'CAISSE-SALFA', 'Ce fichier n’est pas une sauvegarde CAISSE SALFA.');
  exiger(s.version === 1, 'Version de sauvegarde non prise en charge (version 1 attendue).');
  exiger(typeof s.revision === 'number' && Number.isSafeInteger(s.revision) && s.revision >= 0 && s.revision < Number.MAX_SAFE_INTEGER,
    'Révision de sauvegarde invalide.');
  return {
    format: 'CAISSE-SALFA',
    version: 1,
    revision: s.revision,
    updatedAt: horodatage(s.updatedAt, 'Date de sauvegarde'),
    exportedAt: s.exportedAt == null ? undefined : horodatage(s.exportedAt, 'Date d’export'),
    ...validerDonnees(s),
  };
}

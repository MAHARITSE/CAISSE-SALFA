import type { DonneesCaisse, Ecriture, LigneDetail, MasqueSaisie, Sauvegarde, Sens } from '../types';
import { MAX_DETAILS, MAX_ECRITURES, MONTANT_MAX } from './constants';

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
        montant: montantEntier(l.montant, 'Montant du poste'),
      };
    }).filter(l => l.montant > 0);
    exiger(lignesDetail.length > 0, `${champ} : un détail doit contenir au moins un montant positif.`);
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
    lignes: lignes.map((v, i) => {
      const l = objet(v, `Poste ${i + 1}`);
      return {
        description: texte(l.description, 'Description du poste', 200, true),
        montantDefaut: l.montantDefaut == null ? undefined : montantEntier(l.montantDefaut, 'Montant par défaut'),
      };
    }),
  };
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
  exiger(typeof p.soldeInitial === 'number' && Number.isSafeInteger(p.soldeInitial) && Math.abs(p.soldeInitial) <= MONTANT_MAX,
    'Le solde d’ouverture doit être un montant entier valide (un solde négatif est autorisé).');
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
  let solde = p.soldeInitial;
  for (const e of ecritures) {
    solde += e.sens === 'RECETTE' ? e.montant : -e.montant;
    exiger(Number.isSafeInteger(solde), 'Le solde cumulé dépasse la précision numérique fiable. Réduisez les montants du livre.');
  }
  return { ecritures, parametres: { soldeInitial: p.soldeInitial }, masques, compteurs };
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

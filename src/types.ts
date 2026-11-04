import type { EntetesDocuments } from './utils/entete';

export type { EntetesDocuments };
export type Sens = 'RECETTE' | 'DEPENSE';

/** Les montants sont des entiers en ariary (MGA), jamais des flottants. */
export interface LigneDetail {
  id: string;
  libelle: string;
  reference?: string;
  montant: number;
}

export interface Ecriture {
  id: string;
  numero: string;
  date: string; // Date locale AAAA-MM-JJ, sans conversion UTC.
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers?: string;
  montant: number;
  lignesDetail?: LigneDetail[];
  /** Ancien champ conservé pour relire les sauvegardes : l'application ne gère que les espèces. */
  mode?: string;
  reference?: string;
  observation?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Parametres {
  /** Solde antérieur à l'historique conservé dans ce livre. */
  soldeInitial: number;
  /** Année de l'exercice ouvert. Absente uniquement pour un livre antérieur aux exercices. */
  exercice?: number;
  /** Résultat de l'exercice précédent repris à l'ouverture, Null si le livre a commencé sans clôture. */
  reportPrecedent: { annee: number; solde: number } | null;
}

/** Archive figée d'un exercice clôturé ; elle n'est pas modifiable et ne compte plus dans les soldes. */
export interface ExerciceCloture {
  annee: number;
  clotureLe: string;
  /** Solde d'ouverture de l'exercice clôturé. */
  soldeOuverture: number;
  recettes: number;
  depenses: number;
  /** Solde repris par l'exercice suivant. */
  soldeCloture: number;
  ecritures: Ecriture[];
}

export interface LigneJournal extends Ecriture {
  solde: number;
}

export interface MasqueSaisie {
  id: string;
  nom: string;
  sens: Sens;
  description?: string;
  lignes: { description: string; montantDefaut?: number }[];
}

export interface DonneesCaisse {
  ecritures: Ecriture[];
  parametres: Parametres;
  masques: MasqueSaisie[];
  /** Compteurs persistants : supprimer une pièce ne libère pas son numéro. */
  compteurs: Record<string, number>;
  /** Exercices déjà clôturés, du plus ancien au plus récent. */
  exercicesClotures: ExerciceCloture[];
  /** En-têtes imprimables de l'engagement de dépense et de l'autorisation de recette. */
  entetes: EntetesDocuments;
}

/** Même format pour le stockage local et les sauvegardes JSON importables. */
export interface Sauvegarde extends DonneesCaisse {
  format: 'CAISSE-SALFA';
  version: 1;
  revision: number;
  updatedAt: string;
  exportedAt?: string;
}

export interface ChargementLivre {
  livre: Sauvegarde;
  erreur: string | null;
  avertissement: string | null;
  migration: boolean;
  /** Livre lu sans exercice explicite (ancienne version) : à normaliser et réenregistrer. */
  normalisation: boolean;
}

export interface FiltresJournal {
  mois: string;
  toutAfficher: boolean;
  sens: 'TOUS' | Sens;
  categorie: string;
  recherche: string;
}

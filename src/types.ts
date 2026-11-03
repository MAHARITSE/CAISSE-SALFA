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
  mode?: string;
  reference?: string;
  observation?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Parametres {
  /** Solde antérieur à l'historique conservé dans ce livre. */
  soldeInitial: number;
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
}

export interface FiltresJournal {
  mois: string;
  toutAfficher: boolean;
  sens: 'TOUS' | Sens;
  categorie: string;
  mode: string;
  recherche: string;
}

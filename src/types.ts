export type Sens = 'RECETTE' | 'DEPENSE';

/** Sous-ligne pour détailler un libellé (ex. bordereau des recettes du jour). */
export interface LigneDetail {
  id: string;
  libelle: string; // Ex: MEDICAMENT, CONSULTATION, ECHOGRAPHIE...
  reference?: string; // Ex: quittance / code / ticket n° (70601...)
  montant: number; // MGA
}

/** Une ligne du livre journal de trésorerie. */
export interface Ecriture {
  id: string;
  numero: string; // RC-2026-0001 (recette) / DP-2026-0001 (dépense)
  date: string; // AAAA-MM-JJ
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers?: string;
  montant: number; // MGA, toujours positif (total des sous-lignes si détaillées)
  lignesDetail?: LigneDetail[];
  mode?: string;
  reference?: string;
  observation?: string;
  createdAt: string;
}

export interface Parametres {
  soldeInitial: number; // report à nouveau de la trésorerie
}

/** Ligne calculée pour l'affichage. */
export interface LigneJournal extends Ecriture {
  solde: number; // solde cumulé après l'écriture
}

/** Masque de saisie pré-défini pour générer les sous-lignes d'une recette ou d'une dépense. */
export interface MasqueSaisie {
  id: string;
  nom: string;
  sens: Sens;
  description?: string;
  lignes: {
    description: string;
    montantDefaut?: number;
  }[];
}

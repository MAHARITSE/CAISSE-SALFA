export type Sens = 'RECETTE' | 'DEPENSE';

export type Mode = 'Espèces' | 'Chèque' | 'Virement' | 'Mobile Money';

/** Une ligne du livre journal de trésorerie. */
export interface Ecriture {
  id: string;
  numero: string; // RC-2026-0001 (recette) / DP-2026-0001 (dépense)
  date: string; // AAAA-MM-JJ
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers?: string;
  montant: number; // MGA, toujours positif
  mode: Mode;
  reference?: string;
  createdAt: string;
}

export interface Parametres {
  soldeInitial: number; // report à nouveau de la trésorerie
}

/** Ligne calculée pour l'affichage. */
export interface LigneJournal extends Ecriture {
  solde: number; // solde cumulé après l'écriture
}

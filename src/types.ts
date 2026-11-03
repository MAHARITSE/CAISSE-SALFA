export type ModePaiement = 'Espèces' | 'Chèque' | 'Virement' | 'Mobile Money';

export type Onglet = 'saisie' | 'journal';

/** Une dépense enregistrée dans la caisse. */
export interface Depense {
  id: string;
  numero: string; // DEP-2026-0001
  date: string; // AAAA-MM-JJ
  libelle: string;
  montant: number; // MGA
  categorie: string;
  beneficiaire: string;
  modePaiement: ModePaiement;
  notes?: string;
  createdAt: string;
}

/** Une dépense type du masque de saisie. */
export interface MasqueDepense {
  id: string;
  designation: string;
  libelle: string;
  montant: number;
  categorie: string;
  beneficiaire: string;
  modePaiement: ModePaiement;
}

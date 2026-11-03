export type UserRole = 'caissier' | 'comptable' | 'administrateur';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatar?: string;
}

export type TransactionType = 'RECETTE' | 'DEPENSE';
export type PaymentMode = 'Espèces' | 'Virement' | 'Chèque' | 'Mobile Money';
export type TransactionStatus = 'Validé' | 'En attente' | 'Clôturé';

export interface CaisseTransaction {
  id: string;
  numeroPiece: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  libelle: string;
  montant: number; // MGA
  montantEnLettres: string;
  categorie: string;
  beneficiaire: string;
  modePaiement: PaymentMode;
  statut: TransactionStatus;
  compteBanqueId?: string;
  notes?: string;
  createdAt: string;
}

export type DemandeStatus = 'En attente' | 'Approuvé' | 'Rejeté' | 'Liquidé';
export type UrgencyLevel = 'Normale' | 'Urgente' | 'Très Urgente';

export interface DemandeFonds {
  id: string;
  codeDemande: string;
  date: string;
  demandeur: string;
  departement: string;
  motif: string;
  montant: number;
  urgency: UrgencyLevel;
  statut: DemandeStatus;
  approuvePar?: string;
  dateApprobation?: string;
  motifRejet?: string;
}

export type BeneficiaireType = 'Fournisseur' | 'Personnel' | 'Organisme' | 'Patient';

export interface Beneficiaire {
  id: string;
  nom: string;
  type: BeneficiaireType;
  cinOuNif: string;
  telephone: string;
  email: string;
  adresse: string;
  banque: string;
  rib: string;
  soldeTotalTransact: number;
  nombreTransactions: number;
}

export interface CompteBancaire {
  id: string;
  nomBanque: string;
  numeroCompte: string;
  titulaire: string;
  rib: string;
  soldeActuel: number;
  devise: string;
}

export type VirementStatus = 'Brouillon' | 'Transmis' | 'Exécuté' | 'Annulé';

export interface OrdreVirement {
  id: string;
  codeVirement: string;
  dateVirement: string;
  compteSourceId: string;
  beneficiaireId: string;
  montant: number;
  motif: string;
  referencePaiement: string;
  statut: VirementStatus;
}

export interface BilletageCount {
  b20000: number; // Billet 20 000 Ariary
  b10000: number; // Billet 10 000 Ariary
  b5000: number;  // Billet 5 000 Ariary
  b2000: number;  // Billet 2 000 Ariary
  b1000: number;  // Billet 1 000 Ariary
  pieces: number; // Monnaies & Pièces (Ariary)
}

export interface ClotureCaisse {
  id: string;
  dateCloture: string;
  caissier: string;
  soldeInitial: number;
  totalRecettes: number;
  totalDepenses: number;
  soldeTheorique: number;
  billetage: BilletageCount;
  soldePhysique: number;
  ecart: number;
  observations: string;
  statut: 'Conforme' | 'Écart constaté';
}

export interface FilterState {
  searchQuery: string;
  type: 'TOUS' | 'RECETTE' | 'DEPENSE';
  categorie: string;
  modePaiement: string;
  dateDebut: string;
  dateFin: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'saisie'
  | 'memoire'
  | 'demandes'
  | 'beneficiaires'
  | 'banque'
  | 'cloture'
  | 'rapports';

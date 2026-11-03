import { CaisseTransaction, DemandeFonds, Beneficiaire, CompteBancaire, OrdreVirement, ClotureCaisse, MasqueDepense } from '../types';
import { numberToWordsMGA } from './numberToWords';

export const INITIAL_TRANSACTIONS: CaisseTransaction[] = [
  {
    id: 'tx-001',
    numeroPiece: 'REC-2026-0001',
    type: 'RECETTE',
    date: '2026-08-25',
    libelle: 'Versement recettes consultations externes - Dispensaire SALFA',
    montant: 2450000,
    montantEnLettres: numberToWordsMGA(2450000),
    categorie: 'Consultations & Soins',
    beneficiaire: 'Caisse Principale Dispensaire',
    modePaiement: 'Espèces',
    statut: 'Validé',
    createdAt: '2026-08-25T08:30:00Z'
  },
  {
    id: 'tx-002',
    numeroPiece: 'DEP-2026-0001',
    type: 'DEPENSE',
    date: '2026-08-25',
    libelle: 'Achat consommables médicaux et seringues à usage unique',
    montant: 820000,
    montantEnLettres: numberToWordsMGA(820000),
    categorie: 'Pharmacie & Médicaments',
    beneficiaire: 'Pharmacie Centrale Antananarivo',
    modePaiement: 'Espèces',
    statut: 'Validé',
    createdAt: '2026-08-25T10:15:00Z'
  },
  {
    id: 'tx-003',
    numeroPiece: 'REC-2026-0002',
    type: 'RECETTE',
    date: '2026-08-26',
    libelle: 'Règlement facture prestation laboratoire d analyse',
    montant: 1800000,
    montantEnLettres: numberToWordsMGA(1800000),
    categorie: 'Laboratoire & Analyses',
    beneficiaire: 'Clinique Partenaire Anosy',
    modePaiement: 'Chèque',
    statut: 'Validé',
    createdAt: '2026-08-26T09:00:00Z'
  },
  {
    id: 'tx-004',
    numeroPiece: 'DEP-2026-0002',
    type: 'DEPENSE',
    date: '2026-08-26',
    libelle: 'Achat carburant pour groupe électrogène et ambulance SALFA',
    montant: 650000,
    montantEnLettres: numberToWordsMGA(650000),
    categorie: 'Carburant & Transport',
    beneficiaire: 'Station TOTALEnergies Ankorondrano',
    modePaiement: 'Espèces',
    statut: 'Validé',
    createdAt: '2026-08-26T14:20:00Z'
  },
  {
    id: 'tx-005',
    numeroPiece: 'DEP-2026-0003',
    type: 'DEPENSE',
    date: '2026-08-27',
    libelle: 'Paiement fournitures de bureau et papier d impression',
    montant: 320000,
    montantEnLettres: numberToWordsMGA(320000),
    categorie: 'Fournitures de bureau',
    beneficiaire: 'Papeterie de la Capitale',
    modePaiement: 'Espèces',
    statut: 'Validé',
    createdAt: '2026-08-27T11:00:00Z'
  },
  {
    id: 'tx-006',
    numeroPiece: 'REC-2026-0003',
    type: 'RECETTE',
    date: '2026-08-28',
    libelle: 'Subvention projet santé communautaire partenaire ONG',
    montant: 15000000,
    montantEnLettres: numberToWordsMGA(15000000),
    categorie: 'Subventions & Projets',
    beneficiaire: 'Partenaire Action Santé',
    modePaiement: 'Virement',
    statut: 'Validé',
    compteBanqueId: 'bank-001',
    createdAt: '2026-08-28T09:30:00Z'
  },
  {
    id: 'tx-007',
    numeroPiece: 'DEP-2026-0004',
    type: 'DEPENSE',
    date: '2026-08-28',
    libelle: 'Acompte maintenance équipement radiologie et scanner',
    montant: 3400000,
    montantEnLettres: numberToWordsMGA(3400000),
    categorie: 'Maintenance & Équipements',
    beneficiaire: 'MedTech Madagascar SARL',
    modePaiement: 'Virement',
    statut: 'Validé',
    compteBanqueId: 'bank-001',
    createdAt: '2026-08-28T15:45:00Z'
  },
  {
    id: 'tx-008',
    numeroPiece: 'DEP-2026-0005',
    type: 'DEPENSE',
    date: '2026-08-29',
    libelle: 'Avance sur frais de mission équipe médicale mobile',
    montant: 950000,
    montantEnLettres: numberToWordsMGA(950000),
    categorie: 'Frais de mission',
    beneficiaire: 'Dr. Rakotomalala Jean',
    modePaiement: 'Espèces',
    statut: 'En attente',
    createdAt: '2026-08-29T08:15:00Z'
  }
];

export const INITIAL_DEMANDES: DemandeFonds[] = [
  {
    id: 'dem-001',
    codeDemande: 'DEM-2026-001',
    date: '2026-08-28',
    demandeur: 'Dr. Randrianarisoa Mireille',
    departement: 'Service Pédiatrie',
    motif: 'Achat d urgence réactifs de laboratoire pédiatrique',
    montant: 1200000,
    urgency: 'Très Urgente',
    statut: 'Approuvé',
    approuvePar: 'Directeur Financier',
    dateApprobation: '2026-08-28T11:00:00Z'
  },
  {
    id: 'dem-002',
    codeDemande: 'DEM-2026-002',
    date: '2026-08-29',
    demandeur: 'Raveloson Paul',
    departement: 'Service Maintenance & Logistique',
    motif: 'Réparation groupe électrogène de secours centre médical',
    montant: 850000,
    urgency: 'Urgente',
    statut: 'En attente'
  },
  {
    id: 'dem-003',
    codeDemande: 'DEM-2026-003',
    date: '2026-08-27',
    demandeur: 'Ratsimbazafy Voahirana',
    departement: 'Service Informatique',
    motif: 'Acquisition câbles réseau et prises pour extension bureau',
    montant: 450000,
    urgency: 'Normale',
    statut: 'Liquidé',
    approuvePar: 'Chef Comptable',
    dateApprobation: '2026-08-27T14:30:00Z'
  }
];

export const INITIAL_BENEFICIAIRES: Beneficiaire[] = [
  {
    id: 'ben-001',
    nom: 'Pharmacie Centrale Antananarivo',
    type: 'Fournisseur',
    cinOuNif: '2001984711 / 2020B001',
    telephone: '+261 34 02 123 45',
    email: 'contact@pharmacie-centrale.mg',
    adresse: 'Analakely, Antananarivo 101',
    banque: 'BNI MADAGASCAR',
    rib: '00002 01001 00012345678 45',
    soldeTotalTransact: 4820000,
    nombreTransactions: 6
  },
  {
    id: 'ben-002',
    nom: 'MedTech Madagascar SARL',
    type: 'Fournisseur',
    cinOuNif: '3002918273 / 2019B088',
    telephone: '+261 32 07 888 99',
    email: 'commercial@medtech.mg',
    adresse: 'Zone Ankorondrano, Antananarivo',
    banque: 'BANK OF AFRICA',
    rib: '00008 02005 00098765432 12',
    soldeTotalTransact: 12400000,
    nombreTransactions: 3
  },
  {
    id: 'ben-003',
    nom: 'Station TOTALEnergies Ankorondrano',
    type: 'Fournisseur',
    cinOuNif: '1002938475 / 2015B045',
    telephone: '+261 33 11 555 00',
    email: 'total.ankorondrano@totalenergies.mg',
    adresse: 'Ankorondrano, Antananarivo',
    banque: 'SOCIETE GENERALE MG',
    rib: '00003 01002 00055443322 89',
    soldeTotalTransact: 2150000,
    nombreTransactions: 4
  },
  {
    id: 'ben-004',
    nom: 'Dr. Rakotomalala Jean',
    type: 'Personnel',
    cinOuNif: '101 221 045 892',
    telephone: '+261 34 56 789 01',
    email: 'j.rakotomalala@salfa.mg',
    adresse: 'Lot IVG 45 Isoraka, Antananarivo',
    banque: 'BNI MADAGASCAR',
    rib: '00002 01001 00078912345 67',
    soldeTotalTransact: 1950000,
    nombreTransactions: 2
  }
];

export const INITIAL_BANQUES: CompteBancaire[] = [
  {
    id: 'bank-001',
    nomBanque: 'BNI MADAGASCAR - Compte Principal SALFA',
    numeroCompte: '00002 01001 12345678901 22',
    titulaire: 'SAMPAN I ASA LOTERANA MOMBA NY FAHASALAMA (SALFA)',
    rib: 'BNI-MG-12345678',
    soldeActuel: 48500000,
    devise: 'MGA'
  },
  {
    id: 'bank-002',
    nomBanque: 'BANK OF AFRICA (BOA) - Compte Projets',
    numeroCompte: '00008 02005 98765432109 44',
    titulaire: 'SALFA - DEPARTEMENT PROJETS SANTE',
    rib: 'BOA-MG-98765432',
    soldeActuel: 27200000,
    devise: 'MGA'
  },
  {
    id: 'bank-003',
    nomBanque: 'SOCIETE GENERALE MADAGASCAR - Caisse Réserve',
    numeroCompte: '00003 01002 55443322110 88',
    titulaire: 'SALFA - DIRECTION FINANCIERE',
    rib: 'SGMG-MG-55443322',
    soldeActuel: 15800000,
    devise: 'MGA'
  }
];

export const INITIAL_VIREMENTS: OrdreVirement[] = [
  {
    id: 'vir-001',
    codeVirement: 'VIR-2026-001',
    dateVirement: '2026-08-28',
    compteSourceId: 'bank-001',
    beneficiaireId: 'ben-002',
    montant: 3400000,
    motif: 'Acompte contrat maintenance équipement radiologie',
    referencePaiement: 'REF-MEDTECH-2026-08',
    statut: 'Exécuté'
  }
];

export const INITIAL_CLOTURE: ClotureCaisse = {
  id: 'clot-2026-08-28',
  dateCloture: '2026-08-28',
  caissier: 'Andriamanitra Hasina (Caissier Principal)',
  soldeInitial: 3500000,
  totalRecettes: 19250000,
  totalDepenses: 5190000,
  soldeTheorique: 17560000,
  billetage: {
    b20000: 750,  // 15,000,000
    b10000: 220,  // 2,200,000
    b5000: 60,    // 300,000
    b2000: 25,    // 50,000
    b1000: 10,    // 10,000
    pieces: 0
  },
  soldePhysique: 17560000,
  ecart: 0,
  observations: 'Caisse fermée et conforme sans écart. Billets vérifiés.',
  statut: 'Conforme'
};

export const INITIAL_MASQUES_DEPENSES: MasqueDepense[] = [
  {
    id: 'mdep-001',
    code: 'MDEP-0001',
    designation: 'Consommables médicaux',
    libelle: 'Achat consommables médicaux et seringues à usage unique',
    categorie: 'Consommables Médicaux',
    beneficiaire: 'Pharmacie Centrale Antananarivo',
    modePaiement: 'Espèces',
    montantDefaut: 820000,
    notes: 'Réf. bon de commande pharmacie',
    actif: true,
    ordre: 0,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'mdep-002',
    code: 'MDEP-0002',
    designation: 'Carburant ambulance',
    libelle: 'Achat carburant pour groupe électrogène et ambulance SALFA',
    categorie: 'Carburant & Transport',
    beneficiaire: 'Station TOTALEnergies Ankorondrano',
    modePaiement: 'Espèces',
    montantDefaut: 650000,
    actif: true,
    ordre: 1,
    createdAt: '2026-08-01T08:05:00Z',
    updatedAt: '2026-08-01T08:05:00Z'
  },
  {
    id: 'mdep-003',
    code: 'MDEP-0003',
    designation: 'Fournitures de bureau',
    libelle: 'Achat fournitures de bureau et consommables administratifs',
    categorie: 'Fournitures de bureau',
    beneficiaire: 'Papeterie Analakely',
    modePaiement: 'Espèces',
    montantDefaut: 180000,
    actif: true,
    ordre: 2,
    createdAt: '2026-08-01T08:10:00Z',
    updatedAt: '2026-08-01T08:10:00Z'
  },
  {
    id: 'mdep-004',
    code: 'MDEP-0004',
    designation: 'Frais de mission',
    libelle: 'Frais de mission et déplacement du personnel soignant',
    categorie: 'Frais de mission',
    beneficiaire: 'Personnel SALFA',
    modePaiement: 'Espèces',
    montantDefaut: 350000,
    actif: true,
    ordre: 3,
    createdAt: '2026-08-01T08:15:00Z',
    updatedAt: '2026-08-01T08:15:00Z'
  },
  {
    id: 'mdep-005',
    code: 'MDEP-0005',
    designation: 'Maintenance équipements',
    libelle: 'Contrat de maintenance des équipements radiologiques',
    categorie: 'Maintenance & Équipements',
    beneficiaire: 'MedTech Madagascar SARL',
    modePaiement: 'Virement',
    montantDefaut: 3400000,
    compteBanqueId: 'bank-001',
    actif: true,
    ordre: 4,
    createdAt: '2026-08-01T08:20:00Z',
    updatedAt: '2026-08-01T08:20:00Z'
  },
  {
    id: 'mdep-006',
    code: 'MDEP-0006',
    designation: 'Eau et électricité',
    libelle: "Règlement facture d'eau et d'électricité JIRAMA",
    categorie: 'Eau & Électricité',
    beneficiaire: 'JIRAMA',
    modePaiement: 'Chèque',
    montantDefaut: 420000,
    actif: true,
    ordre: 5,
    createdAt: '2026-08-01T08:25:00Z',
    updatedAt: '2026-08-01T08:25:00Z'
  }
];

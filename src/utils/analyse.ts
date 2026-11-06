import type { Sens } from '../types';

/** Regroupe un libellé de sous-ligne en pôle / famille analytique pour l'analyse approfondie. */
export function determinerPoleDetail(sens: Sens, libelleDetail: string, categorieParente: string): string {
  const t = libelleDetail.toUpperCase().trim();
  if (sens === 'RECETTE') {
    if (['MEDICAMENT', 'MÉDICAMENT', 'MEDIC', 'PHARMACIE', 'SERINGUE', 'OXYGENE', 'GANT', 'PRODUIT'].some(k => t.includes(k))) {
      return 'Pharmacie & Médicaments';
    }
    if (['BLOC', 'CHIRURGIE', 'OPERATION', 'OPÉRATION', 'ANESTHESIE'].some(k => t.includes(k))) {
      return 'Bloc opératoire & Chirurgie';
    }
    if (['ECHO', 'ÉCHO', 'RADIO', 'ECG', 'IMAGERIE'].some(k => t.includes(k))) {
      return 'Imagerie & Échographie';
    }
    if (['LABO', 'ANALYSE', 'TDR', 'ANAPATH'].some(k => t.includes(k))) {
      return 'Laboratoire & Analyses';
    }
    if (['HOSP', 'CHAMBRE', 'LOYER HOPITAL', 'LIT', 'EVASAN'].some(k => t.includes(k))) {
      return 'Hospitalisation & Chambres';
    }
    if (['DENTIST', 'EXTRACTION', 'PLOMBAGE', 'DETARTRAGE'].some(k => t.includes(k))) {
      return 'Dentisterie';
    }
    if (['MATERN', 'ACCOUCHEMENT', 'CPN', 'SAGE FEMME'].some(k => t.includes(k))) {
      return 'Maternité & Accouchements';
    }
    if (['CONSULTATION', 'OPHTALMO', 'VISITE', 'CERTIFICAT'].some(k => t.includes(k))) {
      return 'Consultations médicales';
    }
    if (['SOIN', 'PANSEMENT', 'VACCIN', 'INJECTION'].some(k => t.includes(k))) {
      return 'Soins infirmiers & Vaccins';
    }
    if (['REGLEMENT', 'RÈGLEMENT', 'REMBOURSEMENT', 'AVANCE', 'PRET', 'PRÊT', 'FACTURE'].some(k => t.includes(k))) {
      return 'Règlements & Remboursements';
    }
    return 'Autres prestations & patients';
  }

  // Côté DEPENSE : sous-familles analytiques détaillées
  if (['VERSEMENT', 'BNI', 'BFV', 'BOA', 'BANQUE', 'MVOLA', 'CHEQUE'].some(k => t.includes(k))) {
    return 'Versements bancaires & Trésorerie';
  }
  if (['QUINZAINE', 'QUIZAINE', 'AVANCE', 'PRET'].some(k => t.includes(k))) {
    return 'Avances & Quinzaines du personnel';
  }
  if (['SALAIRE', 'SOLDE DE TOUT COMPTE', '13EME'].some(k => t.includes(k))) {
    return 'Salaires mensuels';
  }
  if (['INDEMNITE', 'INDEMINITE', 'ONDEMNITE', 'GARDE', 'PRIME', 'CONGE', 'CNAPS', 'OSTIE', 'IRSA', 'SOCIAL', 'FAMANGIANA'].some(k => t.includes(k))) {
    return 'Indemnités, Gardes & Charges sociales';
  }
  if (['HONORAIRE', 'INTERIM', 'INTERMAIRE', 'VACATION', 'ORDRE', 'ANALYSE EXTERNE', 'ANAPATH'].some(k => t.includes(k))) {
    return 'Honoraires, Intérims & Sous-traitance médicale';
  }
  if (['MEDICAMENT', 'ARTESUNATE', 'SERUM', 'OXYGENE', 'VACCIN', 'PHARMACIE', 'CDM'].some(k => t.includes(k))) {
    return 'Médicaments, Sérums & Oxygène';
  }
  if (['PRODUIT BLOC', 'PRODUIT DENTAIRE', 'PRODUIT LABO', 'TDR', 'GANT', 'SERINGUE', 'REACTIF', 'CONSOMMABLE', 'CARNET', 'FICHE', 'EAU VIVE'].some(k => t.includes(k))) {
    return 'Consommables & Fournitures médicales';
  }
  if (['GASOIL', 'GAZOIL', 'ESSENCE', 'CARBURANT', 'LUBRIFIANT', 'HUILE'].some(k => t.includes(k))) {
    return 'Carburants & Lubrifiants (Groupe / Véhicules)';
  }
  if (['BAJAJ', 'TAXI', 'POSY', 'COLIS', 'TRANSPORT', 'DOCKER', 'COURSE', 'ENVOI'].some(k => t.includes(k))) {
    return 'Transport local, Bajaj & Expéditions colis';
  }
  if (['JIRAMA', 'ELECTRICITE', 'EAU', 'GAZ', 'VITOGAZ', 'CHARBON', 'AMPOULE', 'LED', 'NEON', 'PILE'].some(k => t.includes(k))) {
    return 'Eau, Électricité (JIRAMA), Gaz & Éclairage';
  }
  if (['STARLINK', 'INTERNET', 'CREDIT', 'TELMA', 'ORANGE', 'AIRTEL', 'YAS', 'CANAL', 'FLOTTE'].some(k => t.includes(k))) {
    return 'Télécommunications, Crédits & Internet (Starlink)';
  }
  if (['REMBOURSEMENT', 'RAMBOURSEMENT', 'REMBOURSSEMENT', 'RETOUR'].some(k => t.includes(k))) {
    return 'Remboursements patients & Rétrocessions';
  }
  if (['CONSTRUCTION', 'CIMENT', 'PARPAING', 'PEINTURE', 'PLOMBERIE', 'SOUDURE', 'BOIS', 'TOLE', 'TRAVAUX', 'REPARATION', 'MACON', 'MENUISIER'].some(k => t.includes(k))) {
    return 'Travaux, Bâtiment & Réparations';
  }
  return categorieParente || 'Autres charges d’exploitation';
}


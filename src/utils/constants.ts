import type { Categories, MasqueSaisie, Sens } from '../types';

export const MONTANT_MAX = 999_999_999_999;
export const MAX_ECRITURES = 10_000;
export const MAX_DETAILS = 200;
export const MAX_IMPORT_OCTETS = 8 * 1024 * 1024;
/** L'établissement ne gère que la caisse en espèces ; le champ mode est retiré.
 *  Les éventuelles écritures importées qui portent un autre mode restent lisibles. */
export const MODE_UNIQUE = 'Espèces';
export const ANNEE_MIN = 1900;
export const ANNEE_MAX = 9999;
export const MAX_CLOTURES = 400;
export const MAX_CATEGORIES = 200;
/** Longueur maximale d'un libellé de catégorie. */
export const MAX_LONGUEUR_CATEGORIE = 120;

export const CATEGORIES_RECETTE = [
  'Recettes journalières', 'Consultations', 'Pharmacie', 'Laboratoire',
  'Hospitalisation', 'Maternité', 'Imagerie', 'Subventions & dons',
  'Remboursements', 'Autres recettes',
];

export const CATEGORIES_DEPENSE = [
  'Achats médicaments', 'Consommables médicaux', 'Fournitures de bureau',
  'Carburant & transport', 'Maintenance & équipements', 'Salaires & primes',
  'Frais de mission', 'Honoraires', 'Eau & électricité',
  'Téléphone & internet', 'Remboursements & rétrocessions',
  'Versements bancaires', 'Divers',
];

export const categoriesPour = (sens: Sens): string[] =>
  sens === 'RECETTE' ? [...CATEGORIES_RECETTE] : [...CATEGORIES_DEPENSE];

/** Catégories livrées avec la caisse : elles servent aussi de modèle de départ. */
export function categoriesParDefaut(): Categories {
  return { recette: [...CATEGORIES_RECETTE], depense: [...CATEGORIES_DEPENSE] };
}

/** Les deux listes sont indépendantes : une recette n'a pas les catégories d'une dépense. */
export const categoriesPourListe = (categories: Categories, sens: Sens): string[] =>
  sens === 'RECETTE' ? [...categories.recette] : [...categories.depense];

export function masquesParDefaut(): MasqueSaisie[] {
  return [
    {
      id: 'masque-recettes-hopital',
      nom: 'Bordereau recettes hôpital',
      sens: 'RECETTE',
      description: 'Les 12 postes du carnet de caisse hospitalier.',
      libelle: 'RECETTES JOURNALIERES DU SERVICE',
      lignes: [
        'CONSULTATION', 'ECHOGRAPHIE', 'CHAMBRE', 'LABORATOIRE',
        'MATERNITE', 'MEDICAMENT', 'SOINS', 'HOSPITALISATION',
        'DENTISTERIE', 'BLOC', 'DIVERS', 'VACCIN',
      ].map(description => ({ description })),
    },
    {
      id: 'masque-depenses-courantes',
      nom: 'Charges courantes & fonctionnement',
      sens: 'DEPENSE',
      description: 'Dépenses périodiques d’exploitation.',
      libelle: 'CHARGES COURANTES D’EXPLOITATION',
      lignes: [
        'ACHATS MEDICAMENTS', 'FOURNITURES MEDICALES', 'CARBURANT',
        'EAU & ELECTRICITE', 'MAINTENANCE', 'DIVERS',
      ].map(description => ({ description })),
    },
  ];
}

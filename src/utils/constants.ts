import type { MasqueSaisie, Sens } from '../types';

export const MONTANT_MAX = 999_999_999_999;
export const MAX_ECRITURES = 10_000;
export const MAX_DETAILS = 200;
export const MAX_IMPORT_OCTETS = 8 * 1024 * 1024;
/** L'établissement ne gère que la caisse en espèces ; le champ mode est retiré.
 *  Les éventuelles écritures importées qui portent un autre mode restent lisibles. */
export const MODE_UNIQUE = 'Espèces';

export const CATEGORIES_RECETTE = [
  'Recettes journalières', 'Consultations', 'Pharmacie', 'Laboratoire',
  'Hospitalisation', 'Maternité', 'Imagerie', 'Subventions & dons',
  'Remboursements', 'Autres recettes',
];

export const CATEGORIES_DEPENSE = [
  'Achats médicaments', 'Consommables médicaux', 'Fournitures de bureau',
  'Carburant & transport', 'Maintenance & équipements', 'Salaires & primes',
  'Frais de mission', 'Honoraires', 'Eau & électricité',
  'Téléphone & internet', 'Divers',
];

export const categoriesPour = (sens: Sens): string[] =>
  sens === 'RECETTE' ? [...CATEGORIES_RECETTE] : [...CATEGORIES_DEPENSE];

export function masquesParDefaut(): MasqueSaisie[] {
  return [
    {
      id: 'masque-recettes-hopital',
      nom: 'Bordereau recettes hôpital',
      sens: 'RECETTE',
      description: 'Les 12 postes du carnet de caisse hospitalier.',
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
      lignes: [
        'ACHATS MEDICAMENTS', 'FOURNITURES MEDICALES', 'CARBURANT',
        'EAU & ELECTRICITE', 'MAINTENANCE', 'DIVERS',
      ].map(description => ({ description })),
    },
  ];
}

import type { Ecriture, LigneDetail, Sauvegarde, Sens } from '../types';
import { categoriesParDefaut, MODE_UNIQUE } from './constants';
import { creerDonnees, enregistrerEcriture } from './ledger';
import { ajouterCompteVirement, ajouterTiers, ajouterVirement, validerRegistreVirements, type RegistreVirements } from './virements';

/**
 * Jeu de démonstration.
 *
 * Il sert à voir l'application en fonctionnement sur un livre vide : recettes et
 * dépenses de caisse avec leurs lignes de détail, deux comptes bancaires avec
 * leur RIB, des clients, des fournisseurs et des virements — dont une DED qui
 * porte son ordre de virement.
 *
 * Deux règles gouvernent sa construction :
 *  - les dates sont bâties sur l'année en cours, pour que les pièces tombent dans
 *    l'exercice affiché et apparaissent dans les périodes ;
 *  - il ne s'applique qu'à un livre vide, et le livre réel est remplacé comme
 *    lors d'une restauration (sauvegarde SQL téléchargée avant).
 */

const nb = (valeur: number): string => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(valeur);

/** Date d'une pièce : le jour, dans le mois demandé de l'année en cours. */
function dateDe(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

interface ModeleEcriture {
  id: string;
  mois: number;
  jour: number;
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers: string;
  montant: number;
  lignes?: Array<[string, number]>;
  observation?: string;
}

/** Trois mois d'activité : recettes du dispensaire et dépenses courantes. */
const ECRITURES: ModeleEcriture[] = [
  {
    id: 'exemple-rc-1', mois: 1, jour: 5, sens: 'RECETTE', libelle: 'RECETTES JOURNALIÈRES DU SERVICE',
    categorie: 'Recettes journalières', tiers: '', montant: 1_850_000,
    lignes: [['CONSULTATION', 620_000], ['LABORATOIRE', 480_000], ['PHARMACIE', 450_000], ['MATERNITE', 300_000]],
    observation: 'Exemple : une journée type du carnet de caisse.',
  },
  {
    id: 'exemple-dp-1', mois: 1, jour: 8, sens: 'DEPENSE', libelle: 'ACHAT MÉDICAMENTS PHARMACIE CENTRALE',
    categorie: 'Achats médicaments', tiers: 'PHARMACIE CENTRALE', montant: 720_000,
    lignes: [['ANTIBIOTIQUES', 420_000], ['PARACÉTAMOL', 180_000], ['SÉRINGUES', 120_000]],
  },
  {
    id: 'exemple-dp-2', mois: 1, jour: 12, sens: 'DEPENSE', libelle: 'CARBURANT GROUPE ÉLECTROGÈNE',
    categorie: 'Carburant & transport', tiers: 'STATION TOTAL TOLIARA', montant: 240_000,
  },
  {
    id: 'exemple-rc-2', mois: 2, jour: 4, sens: 'RECETTE', libelle: 'SUBVENTION ASSOCIATION PARTENAIRE',
    categorie: 'Subventions & dons', tiers: 'ASSOCIATION FANILO', montant: 2_500_000,
    observation: 'Exemple : subvention trimestrielle.',
  },
  {
    id: 'exemple-dp-3', mois: 2, jour: 10, sens: 'DEPENSE', libelle: 'SALAIRES ET PRIMES PERSONNEL',
    categorie: 'Salaires & primes', tiers: '', montant: 3_150_000,
    lignes: [['INFIRMIERS', 1_850_000], ['AGENTS D’ENTRETIEN', 700_000], ['GARDIENS', 600_000]],
  },
  {
    id: 'exemple-dp-4', mois: 2, jour: 18, sens: 'DEPENSE', libelle: 'FACTURE JIRAMA EAU ET ÉLECTRICITÉ',
    categorie: 'Eau & électricité', tiers: 'JIRAMA', montant: 410_000,
  },
  {
    id: 'exemple-rc-3', mois: 3, jour: 6, sens: 'RECETTE', libelle: 'RECETTES JOURNALIÈRES DU SERVICE',
    categorie: 'Recettes journalières', tiers: '', montant: 1_640_000,
    lignes: [['CONSULTATION', 540_000], ['ECHOGRAPHIE', 380_000], ['SOINS', 420_000], ['VACCIN', 300_000]],
  },
  {
    id: 'exemple-dp-5', mois: 3, jour: 9, sens: 'DEPENSE', libelle: 'CONSOMMABLES MÉDICAUX BLOC OPÉRATOIRE',
    categorie: 'Consommables médicaux', tiers: 'MÉDICAL SERVICE', montant: 530_000,
  },
];

export const NOMBRE_EXEMPLES = ECRITURES.length;

/**
 * Écritures d'exemple, numérotées par les mêmes règles que la saisie réelle :
 * `RC-AAAA-0001` et `DP-AAAA-0001`, compteurs compris.
 */
export function ecrituresExemple(annee: number): Ecriture[] {
  let donnees = creerDonnees(annee);
  for (const modele of ECRITURES) {
    const lignes: LigneDetail[] | undefined = modele.lignes?.map(([libelle, montant], index) => ({
      id: `${modele.id}-ligne-${index + 1}`, libelle, montant,
    }));
    const ecriture: Ecriture = {
      id: modele.id,
      numero: '',
      date: dateDe(annee, modele.mois, modele.jour),
      sens: modele.sens,
      libelle: modele.libelle,
      categorie: modele.categorie,
      montant: modele.montant,
      mode: MODE_UNIQUE,
      ...(modele.tiers ? { tiers: modele.tiers } : {}),
      ...(lignes ? { lignesDetail: lignes } : {}),
      ...(modele.observation ? { observation: modele.observation } : {}),
      createdAt: new Date(annee, modele.mois - 1, modele.jour, 9, 0, 0).toISOString(),
    };
    donnees = enregistrerEcriture(donnees, ecriture);
  }
  return donnees.ecritures;
}

/** Comptes bancaires de l'hôpital, avec le RIB imprimé sur les ordres de virement. */
export function registreExemple(annee: number): RegistreVirements {
  let registre = ajouterCompteVirement({ comptes: [], ecritures: [], tiers: [], compteurs: {} }, {
    id: 'exemple-compte-bni-c', banque: 'BNI/C', numeroCompte: '00005 00401234567',
    titulaire: 'SALFA — Hôpital Loterana Toliary Tanambao', adresse: 'BP 99 — Toliara', codeBanque: '00005',
  });
  registre = ajouterCompteVirement(registre, {
    id: 'exemple-compte-bni-d', banque: 'BNI/D', numeroCompte: '00005 00409876543',
    titulaire: 'SALFA — Hôpital Loterana Toliary Tanambao', adresse: 'BP 99 — Toliara', codeBanque: '00005',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-fanilo', type: 'CLIENT', nom: 'ASSOCIATION FANILO', telephone: '034 12 345 67',
    adresse: 'Lot II M 45 — Antananarivo', banque: 'BOA', numeroCompte: '00004 00112233445',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-madagascar', type: 'CLIENT', nom: 'ONG SANTÉ MADAGASCAR', telephone: '020 22 334 45',
    adresse: 'Rue des Écoles — Toliara', banque: 'BNI', numeroCompte: '00005 00998877665',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-oxygene', type: 'FOURNISSEUR', nom: 'SOCIÉTÉ OXYGÈNE MADA', telephone: '020 75 123 45',
    adresse: 'Zone industrielle — Antananarivo', banque: 'BOA', numeroCompte: '00004 98765432101',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-medical', type: 'FOURNISSEUR', nom: 'MÉDICAL SERVICE', telephone: '034 05 678 90',
    adresse: 'Bazar Be — Toliara', banque: 'BNI', numeroCompte: '00005 00223344556',
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vr-1', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 1, 15), sens: 'RECETTE',
    libelle: 'VERSEMENT ASSOCIATION FANILO', categorie: 'Subventions & dons', tiers: 'ASSOCIATION FANILO',
    tiersId: 'exemple-client-fanilo', reference: 'VIR-2026-0115', observation: 'Exemple : recette reçue par virement.',
    montant: 1_200_000, createdAt: new Date(annee, 0, 15, 10, 0, 0).toISOString(),
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vd-1', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 2, 20), sens: 'DEPENSE',
    libelle: 'ACHAT OXYGÈNE MÉDICAL', categorie: 'Consommables médicaux', tiers: 'SOCIÉTÉ OXYGÈNE MADA',
    tiersId: 'exemple-four-oxygene', reference: 'FACT-2026-0218',
    observation: 'Exemple : la DED porte son ordre de virement BNI 114018.',
    montant: 980_000, createdAt: new Date(annee, 1, 20, 11, 0, 0).toISOString(),
    beneficiaireAdresse: 'Zone industrielle — Antananarivo', beneficiaireBanque: 'BOA',
    beneficiaireCompte: '00004 98765432101',
  });
  return validerRegistreVirements(registre);
}

/**
 * Livre complet d'exemple, prêt pour la restauration : exercice de l'année en
 * cours, catégories livrées, écritures, virements, comptes et fiches.
 */
export function jeuDeDemonstration(livre: Sauvegarde, annee = new Date().getFullYear()): Sauvegarde {
  const base = creerDonnees(annee);
  return {
    format: 'CAISSE-SALFA',
    version: 1,
    revision: livre.revision,
    updatedAt: new Date().toISOString(),
    ...base,
    categories: categoriesParDefaut(),
    ecritures: ecrituresExemple(annee),
    virements: registreExemple(annee),
  };
}

/**
 * Les exemples ne sont proposés que sur un livre vide : ils ne doivent jamais
 * effacer une comptabilité réelle.
 */
export function exempleDisponible(livre: Sauvegarde): boolean {
  return livre.ecritures.length === 0
    && (livre.virements?.ecritures.length ?? 0) === 0
    && (livre.virements?.tiers.length ?? 0) === 0;
}

/** Résumé lisible, affiché dans la confirmation. */
export function resumeExemple(annee = new Date().getFullYear()): string {
  return `${NOMBRE_EXEMPLES} écritures de caisse et 2 virements sur l'exercice ${annee}, pour un total de ${nb(ecrituresExemple(annee).reduce((s, e) => s + e.montant, 0))} Ar de pièces.`;
}

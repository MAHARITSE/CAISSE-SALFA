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

/**
 * Fiches et comptes d'exemple, sans aucun virement : ils peuvent être ajoutés à
 * un livre déjà en service, là où les pièces d'exemple, elles, ne le peuvent pas.
 */
export function fichesExemple(): RegistreVirements {
  let registre = ajouterCompteVirement({ comptes: [], ecritures: [], tiers: [], compteurs: {} }, {
    id: 'exemple-compte-bni-c', banque: 'BNI/C', numeroCompte: '00005 00041 43200100200 85',
    titulaire: 'SALFA — Hôpital Loterana Toliary Tanambao', adresse: 'BP 99 — Toliara', codeBanque: '00005',
  });
  registre = ajouterCompteVirement(registre, {
    id: 'exemple-compte-bni-d', banque: 'BNI/D', numeroCompte: '00005 00041 43200100201 82',
    titulaire: 'SALFA — Hôpital Loterana Toliary Tanambao', adresse: 'BP 99 — Toliara', codeBanque: '00005',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-fanilo', type: 'CLIENT', nom: 'ASSOCIATION FANILO', telephone: '034 12 345 67',
    adresse: 'Lot II M 45 — Antananarivo', banque: 'BOA', numeroCompte: '00004 00010 00112233445 19',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-madagascar', type: 'CLIENT', nom: 'ONG SANTÉ MADAGASCAR', telephone: '020 22 334 45',
    adresse: 'Rue des Écoles — Toliara', banque: 'BNI', numeroCompte: '00005 00041 00998877665 34',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-mutuelle', type: 'CLIENT', nom: 'MUTUELLE SANTÉ SUD', telephone: '032 14 567 89',
    adresse: 'Avenue de France — Toliara', banque: 'BOA', numeroCompte: '00004 00041 00334455667 52',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-client-aro', type: 'CLIENT', nom: 'ASSURANCE ARO SANTÉ', telephone: '020 22 201 54',
    adresse: 'Place de l’Indépendance — Antananarivo', banque: 'BNI', numeroCompte: '00005 00001 00119988776 71',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-oxygene', type: 'FOURNISSEUR', nom: 'SOCIÉTÉ OXYGÈNE MADA', telephone: '020 75 123 45',
    adresse: 'Zone industrielle — Antananarivo', banque: 'BOA', numeroCompte: '00004 00010 98765432101 42',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-medical', type: 'FOURNISSEUR', nom: 'MÉDICAL SERVICE', telephone: '034 05 678 90',
    adresse: 'Bazar Be — Toliara', banque: 'BNI', numeroCompte: '00005 00041 00223344556 28',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-pharmacie', type: 'FOURNISSEUR', nom: 'PHARMACIE CENTRALE SALFA', telephone: '020 22 612 30',
    adresse: 'Andravoahangy — Antananarivo', banque: 'BNI', numeroCompte: '00005 00001 00445566778 61',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-jirama', type: 'FOURNISSEUR', nom: 'JIRAMA TOLIARA', telephone: '020 94 410 12',
    adresse: 'Boulevard Lyautey — Toliara', banque: 'BFV-SG', numeroCompte: '00008 00041 00778899001 37',
  });
  registre = ajouterTiers(registre, {
    id: 'exemple-four-imprimerie', type: 'FOURNISSEUR', nom: 'IMPRIMERIE DU SUD', telephone: '034 41 220 18',
    adresse: 'Sanfily — Toliara', banque: 'BOA', numeroCompte: '00004 00041 00556677889 46',
  });
  return validerRegistreVirements(registre);
}

/** Virements d'exemple : recettes reçues et DED payées, réparties sur les comptes, clients et fournisseurs. */
export function virementsExemple(annee: number): RegistreVirements['ecritures'] {
  let registre = ajouterVirement(fichesExemple(), {
    id: 'exemple-vr-1', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 1, 15), sens: 'RECETTE',
    libelle: 'VERSEMENT ASSOCIATION FANILO', categorie: 'Subventions & dons', tiers: 'ASSOCIATION FANILO',
    tiersId: 'exemple-client-fanilo', reference: `VIR-${annee}-0115`, observation: 'Exemple : recette reçue par virement.',
    montant: 1_200_000, createdAt: new Date(annee, 0, 15, 10, 0, 0).toISOString(),
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vd-1', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 2, 20), sens: 'DEPENSE',
    libelle: 'ACHAT OXYGÈNE MÉDICAL', categorie: 'Consommables médicaux', tiers: 'SOCIÉTÉ OXYGÈNE MADA',
    tiersId: 'exemple-four-oxygene', reference: `FACT-${annee}-0218`,
    observation: 'Exemple : la DED porte son ordre de virement BNI 114018.',
    montant: 980_000, createdAt: new Date(annee, 1, 20, 11, 0, 0).toISOString(),
    beneficiaireAdresse: 'Zone industrielle — Antananarivo', beneficiaireBanque: 'BOA',
    beneficiaireCompte: '00004 00010 98765432101 42',
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vr-2', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 2, 25), sens: 'RECETTE',
    libelle: 'PRISE EN CHARGE MUTUELLE SANTÉ SUD', categorie: 'Remboursements', tiers: 'MUTUELLE SANTÉ SUD',
    tiersId: 'exemple-client-mutuelle', reference: `VIR-${annee}-0225`,
    observation: 'Règlement trimestriel des dossiers mutualistes.',
    montant: 1_650_000, createdAt: new Date(annee, 1, 25, 9, 30, 0).toISOString(),
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vd-2', compteId: 'exemple-compte-bni-d', date: dateDe(annee, 3, 4), sens: 'DEPENSE',
    libelle: 'APPROVISIONNEMENT MÉDICAMENTS ESSENTIELS', categorie: 'Achats médicaments', tiers: 'PHARMACIE CENTRALE SALFA',
    tiersId: 'exemple-four-pharmacie', reference: `FAC-PH-${annee}-084`,
    observation: 'Dotation mensuelle pharmacie de l’hôpital.',
    montant: 2_450_000, createdAt: new Date(annee, 2, 4, 14, 15, 0).toISOString(),
    beneficiaireAdresse: 'Andravoahangy — Antananarivo', beneficiaireBanque: 'BNI',
    beneficiaireCompte: '00005 00001 00445566778 61',
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vd-3', compteId: 'exemple-compte-bni-d', date: dateDe(annee, 3, 12), sens: 'DEPENSE',
    libelle: 'FACTURE EAU ET ÉLECTRICITÉ HÔPITAL', categorie: 'Eau & électricité', tiers: 'JIRAMA TOLIARA',
    tiersId: 'exemple-four-jirama', reference: `JIR-${annee}-0312`,
    observation: 'Virement permanent mensuel JIRAMA.',
    montant: 640_000, createdAt: new Date(annee, 2, 12, 10, 45, 0).toISOString(),
    beneficiaireAdresse: 'Boulevard Lyautey — Toliara', beneficiaireBanque: 'BFV-SG',
    beneficiaireCompte: '00008 00041 00778899001 37', permanent: true,
  });
  registre = ajouterVirement(registre, {
    id: 'exemple-vr-3', compteId: 'exemple-compte-bni-c', date: dateDe(annee, 3, 18), sens: 'RECETTE',
    libelle: 'RÈGLEMENT DOSSIERS ASSURANCE ARO', categorie: 'Remboursements', tiers: 'ASSURANCE ARO SANTÉ',
    tiersId: 'exemple-client-aro', reference: `VIR-ARO-${annee}-18`,
    observation: 'Remboursement hospitalisations conventionnées.',
    montant: 890_000, createdAt: new Date(annee, 2, 18, 15, 20, 0).toISOString(),
  });
  return registre.ecritures;
}

/** Registre complet d'exemple : comptes, clients, fournisseurs et virements. */
export function registreExemple(annee: number): RegistreVirements {
  let registre = fichesExemple();
  for (const virement of virementsExemple(annee)) registre = ajouterVirement(registre, virement);
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

/**
 * Fiches d'exemple ajoutables à un livre déjà en service : comptes bancaires et
 * clients/fournisseurs manquants. Les virements, eux, changeraient l'historique
 * et ne sont donc proposés que sur un registre vide.
 */
export function fichesExempleManquantes(registre: RegistreVirements | undefined): {
  comptes: RegistreVirements['comptes']; tiers: RegistreVirements['tiers'];
} {
  const exemple = fichesExemple();
  const comptesActuels = registre?.comptes ?? [];
  const tiersActuels = registre?.tiers ?? [];
  const cleCompte = (c: { banque: string; numeroCompte: string }) =>
    `${c.banque.toLocaleLowerCase('fr')}\0${c.numeroCompte.toLocaleLowerCase('fr')}`;
  const cleTiers = (t: { type: string; nom: string }) => `${t.type}\0${t.nom.toLocaleLowerCase('fr')}`;
  const comptesExistants = new Set(comptesActuels.map(cleCompte));
  const tiersExistants = new Set(tiersActuels.map(cleTiers));
  return {
    comptes: exemple.comptes.filter(c => !comptesExistants.has(cleCompte(c))),
    tiers: exemple.tiers.filter(t => !tiersExistants.has(cleTiers(t))),
  };
}

/** Virements d'exemple ajoutables seulement si le registre n'en porte aucun. */
export function virementsExempleManquants(registre: RegistreVirements | undefined): RegistreVirements['ecritures'] {
  return (registre?.ecritures.length ?? 0) === 0 ? virementsExemple(new Date().getFullYear()) : [];
}

/** Résumé lisible, affiché dans la confirmation. */
export function resumeExemple(annee = new Date().getFullYear()): string {
  const nbVirements = virementsExemple(annee).length;
  return `${NOMBRE_EXEMPLES} écritures de caisse et ${nbVirements} virements sur l'exercice ${annee}, pour un total de ${nb(ecrituresExemple(annee).reduce((s, e) => s + e.montant, 0))} Ar de pièces.`;
}

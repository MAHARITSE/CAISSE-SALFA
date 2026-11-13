import type { Sens } from '../types';
import { MAX_ECRITURES } from './constants';
import { dateValide, exiger, horodatage, montantEntier, objet, tableau, texte } from './validation';
import type { Role } from './roles';

/** Registre distinct : ces montants ne font pas partie du solde en espèces. */
export interface CompteVirement {
  id: string;
  /** Banque de l'établissement, telle qu'imprimée (« BNI », « BNI/C »…). */
  banque: string;
  numeroCompte: string;
  /** Identité imprimée sur l'ordre de virement remis à la banque. */
  titulaire?: string;
  adresse?: string;
  /** Code établissement du RIB (5 chiffres à la BNI Madagascar). */
  codeBanque?: string;
}

export interface Virement {
  id: string;
  numero: string;
  compteId: string;
  date: string;
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers: string;
  reference: string;
  observation: string;
  montant: number;
  createdAt: string;
  updatedAt?: string;
  /**
   * Mentions de l'ordre de virement remis à la banque (formulaire BNI 114018).
   * Facultatives : une ligne vide reste en blanc sur le papier, à remplir à la
   * main, pour ne jamais bloquer l'enregistrement d'un virement.
   */
  beneficiaireAdresse?: string;
  /** Établissement bancaire ou CCP du bénéficiaire. */
  beneficiaireBanque?: string;
  /** Compte ou RIB du bénéficiaire (indépendant du compte débité). */
  beneficiaireCompte?: string;
  /** Ordre permanent : la banque exécute le virement à chaque échéance. */
  permanent?: boolean;
  /**
   * Fiche client ou fournisseur du bénéficiaire. Absente des virements saisis
   * avant les fiches : leur tiers reste alors écrit à la main.
   */
  tiersId?: string;
}

/**
 * Fiche d'un client (recette) ou d'un fournisseur (DED).
 *
 * Elle porte l'identité imprimée sur l'ordre de virement remis à la banque. Le
 * RIB est obligatoire pour un fournisseur : sans lui, la banque ne peut pas
 * créditer le bénéficiaire et l'ordre de virement partirait incomplet. Un client
 * n'en reçoit pas : il n'y a rien à virer sur un compte.
 */
export interface Tiers {
  id: string;
  type: 'CLIENT' | 'FOURNISSEUR';
  nom: string;
  telephone: string;
  adresse: string;
  banque: string;
  numeroCompte: string;
}

export interface RegistreVirements {
  comptes: CompteVirement[];
  ecritures: Virement[];
  /** Clients et fournisseurs : le bénéficiaire d'un virement vient d'ici. */
  tiers: Tiers[];
  /** Le compteur est conservé même si une écriture est retirée. */
  compteurs: Record<string, number>;
}

export function peutGererVirements(role: Role | string): boolean {
  return role === 'admin' || role === 'comptable';
}

export function registreVirementsVide(): RegistreVirements {
  return { comptes: [], ecritures: [], tiers: [], compteurs: {} };
}

/** Libellé d'une fiche, tel qu'on le lit dans un menu ou une liste. */
export function libelleTiers(tiers: Tiers): string {
  return `${tiers.nom} — ${tiers.type === 'CLIENT' ? 'client' : 'fournisseur'}`;
}

/** Un fournisseur sans RIB ne peut pas être payé par virement. */
export function ribComplet(tiers: Pick<Tiers, 'banque' | 'numeroCompte'>): boolean {
  return Boolean(tiers.banque.trim() && tiers.numeroCompte.trim());
}

/** Mention facultative de l'ordre de virement : absente plutôt que vide. */
function optionnel(valeur: unknown): string | undefined {
  if (valeur === undefined || valeur === null || valeur === '') return undefined;
  return texte(valeur, 'Mention de l’ordre de virement', 200) || undefined;
}

function tiersValide(valeur: unknown): Tiers {
  const t = objet(valeur, 'Client ou fournisseur');
  exiger(t.type === 'CLIENT' || t.type === 'FOURNISSEUR', 'Type de client : client ou fournisseur attendu.');
  const fiche: Tiers = {
    id: texte(t.id, 'Identifiant de la fiche', 120, true),
    type: t.type,
    nom: texte(t.nom, 'Nom du client ou du fournisseur', 200, true),
    telephone: t.telephone == null ? '' : texte(t.telephone, 'Téléphone', 40),
    adresse: t.adresse == null ? '' : texte(t.adresse, 'Adresse', 200),
    banque: t.banque == null ? '' : texte(t.banque, 'Établissement bancaire', 120),
    numeroCompte: t.numeroCompte == null ? '' : texte(t.numeroCompte, 'Compte ou RIB', 120),
  };
  // Le RIB d'un fournisseur est imprimé sur l'ordre de virement : il ne peut
  // pas manquer, sinon la banque ne saurait pas où créditer l'argent.
  if (fiche.type === 'FOURNISSEUR') {
    exiger(fiche.banque, 'Renseignez l’établissement bancaire du fournisseur : son RIB figure sur l’ordre de virement.');
    exiger(fiche.numeroCompte, 'Renseignez le compte ou RIB du fournisseur : il figure sur l’ordre de virement.');
  }
  return fiche;
}

function compteValide(valeur: unknown): CompteVirement {
  const compte = objet(valeur, 'Compte bancaire');
  const nom = texte(compte.banque, 'Banque', 120, true);
  const numero = texte(compte.numeroCompte, 'Numéro de compte', 120);
  const titulaire = compte.titulaire == null ? '' : texte(compte.titulaire, 'Titulaire du compte', 200);
  const adresse = compte.adresse == null ? '' : texte(compte.adresse, 'Adresse du compte', 200);
  const code = compte.codeBanque == null ? '' : texte(compte.codeBanque, 'Code banque', 5);
  exiger(!code || /^\d{5}$/.test(code), 'Code banque : cinq chiffres attendus.');
  return {
    id: texte(compte.id, 'Identifiant du compte', 120, true),
    banque: nom,
    numeroCompte: numero,
    // Facultatif : le titulaire par défaut est celui de l'hôpital.
    titulaire: titulaire || undefined,
    adresse: adresse || undefined,
    codeBanque: code || undefined,
  };
}

function virementValide(valeur: unknown): Virement {
  const v = objet(valeur, 'Virement');
  const date = dateValide(v.date, 'Date du virement');
  exiger(v.sens === 'RECETTE' || v.sens === 'DEPENSE', 'Type de virement invalide.');
  const numero = texte(v.numero, 'Numéro de virement', 80, true);
  const prefixe = v.sens === 'RECETTE' ? 'VR' : 'VD';
  const correspondance = /^(VR|VD)-(\d{4})-(\d{4,9})$/.exec(numero);
  exiger(correspondance && correspondance[1] === prefixe && correspondance[2] === date.slice(0, 4), 'Numéro de virement invalide pour ce type ou cette année.');
  exiger(Number(correspondance[3]) > 0, 'Numéro de virement invalide.');
  const montant = montantEntier(v.montant, 'Montant du virement');
  exiger(montant > 0, 'Le montant du virement doit être positif.');
  return {
    id: texte(v.id, 'Identifiant du virement', 120, true),
    numero, date, sens: v.sens,
    compteId: texte(v.compteId, 'Compte bancaire', 120, true),
    libelle: texte(v.libelle, 'Libellé', 200, true),
    categorie: texte(v.categorie, 'Catégorie', 120, true),
    tiers: texte(v.tiers ?? '', 'Tiers', 200),
    reference: texte(v.reference ?? '', 'Référence', 200),
    observation: texte(v.observation ?? '', 'Observation', 500),
    montant,
    createdAt: horodatage(v.createdAt, 'Date de création'),
    ...(v.updatedAt == null ? {} : { updatedAt: horodatage(v.updatedAt, 'Date de modification') }),
    ...(optionnel(v.beneficiaireAdresse) ? { beneficiaireAdresse: optionnel(v.beneficiaireAdresse) } : {}),
    ...(optionnel(v.beneficiaireBanque) ? { beneficiaireBanque: optionnel(v.beneficiaireBanque) } : {}),
    ...(optionnel(v.beneficiaireCompte) ? { beneficiaireCompte: optionnel(v.beneficiaireCompte) } : {}),
    ...(v.permanent === true ? { permanent: true } : {}),
    ...(v.tiersId == null ? {} : { tiersId: texte(v.tiersId, 'Client ou fournisseur', 120, true) }),
  };
}

/** Validation stricte pour ne pas perdre silencieusement un compte ou une pièce. */
export function validerRegistreVirements(valeur: unknown): RegistreVirements {
  const registre = objet(valeur, 'Registre des virements');
  const comptes = tableau(registre.comptes, 'Comptes bancaires', 500).map(compteValide);
  const idsComptes = new Set<string>();
  const numerosComptes = new Set<string>();
  for (const compte of comptes) {
    exiger(!idsComptes.has(compte.id), 'Identifiant de compte bancaire en double.');
    const cle = `${compte.banque.toLocaleLowerCase('fr')}\0${compte.numeroCompte.toLocaleLowerCase('fr')}`;
    exiger(!numerosComptes.has(cle), 'Ce compte bancaire existe déjà.');
    idsComptes.add(compte.id); numerosComptes.add(cle);
  }
  const tiersBruts = registre.tiers === undefined ? [] : tableau(registre.tiers, 'Clients et fournisseurs', 5000);
  const tiers = tiersBruts.map(tiersValide);
  const idsTiers = new Set<string>();
  const nomsTiers = new Set<string>();
  for (const fiche of tiers) {
    exiger(!idsTiers.has(fiche.id), 'Identifiant de client ou de fournisseur en double.');
    const cle = `${fiche.type}\0${fiche.nom.toLocaleLowerCase('fr')}`;
    exiger(!nomsTiers.has(cle), `« ${fiche.nom} » est déjà enregistré.`);
    idsTiers.add(fiche.id); nomsTiers.add(cle);
  }
  const ecritures = tableau(registre.ecritures, 'Virements', MAX_ECRITURES).map(virementValide);
  const ids = new Set<string>();
  const numeros = new Set<string>();
  const minimum: Record<string, number> = {};
  for (const v of ecritures) {
    exiger(idsComptes.has(v.compteId), 'Un virement référence un compte bancaire introuvable.');
    if (v.tiersId !== undefined && !idsTiers.has(v.tiersId)) exiger(false, 'Un virement référence un client ou un fournisseur introuvable.');
    exiger(!ids.has(v.id) && !numeros.has(v.numero), 'Virement ou numéro en double.');
    ids.add(v.id); numeros.add(v.numero);
    const cle = v.numero.slice(0, 7);
    minimum[cle] = Math.max(minimum[cle] ?? 0, Number(v.numero.slice(8)));
  }
  const compteursBruts = objet(registre.compteurs, 'Compteurs des virements');
  const compteurs: Record<string, number> = {};
  for (const [cle, valeurCompteur] of Object.entries(compteursBruts)) {
    exiger(/^(VR|VD)-\d{4}$/.test(cle), 'Clé de compteur de virement invalide.');
    exiger(typeof valeurCompteur === 'number' && Number.isSafeInteger(valeurCompteur) && valeurCompteur >= (minimum[cle] ?? 0) && valeurCompteur <= 999_999_999, 'Compteur de virement invalide.');
    compteurs[cle] = valeurCompteur;
  }
  for (const cle of Object.keys(minimum)) exiger(compteurs[cle] !== undefined, 'Compteur de virement manquant.');
  return { comptes, ecritures, tiers, compteurs };
}

export function ajouterCompteVirement(registre: RegistreVirements, compte: CompteVirement): RegistreVirements {
  return validerRegistreVirements({ ...registre, comptes: [...registre.comptes, compte] });
}

/** Ajout atomique : aucun compte n'est créé si l'un des deux est invalide. */
export function ajouterComptesVirement(registre: RegistreVirements, comptes: CompteVirement[]): RegistreVirements {
  exiger(comptes.length > 0 && comptes.length <= 500, 'Liste de comptes bancaires invalide.');
  return validerRegistreVirements({ ...registre, comptes: [...registre.comptes, ...comptes] });
}

export function modifierCompteVirement(registre: RegistreVirements, compte: CompteVirement): RegistreVirements {
  exiger(registre.comptes.some(c => c.id === compte.id), 'Compte bancaire introuvable.');
  return validerRegistreVirements({ ...registre, comptes: registre.comptes.map(c => c.id === compte.id ? compte : c) });
}

/**
 * Supprime un compte bancaire resté sans virement.
 *
 * Un compte qui porte des virements n'est jamais supprimé : les pièces déjà
 * émises et leurs réimpressions perdraient leur RIB. Le message le dit, plutôt
 * que de laisser l'interface proposer une action impossible.
 */
export function supprimerCompteVirement(registre: RegistreVirements, compteId: string): RegistreVirements {
  const compte = registre.comptes.find(c => c.id === compteId);
  exiger(compte, 'Compte bancaire introuvable.');
  exiger(!registre.ecritures.some(v => v.compteId === compteId),
    'Ce compte porte des virements : il ne peut pas être supprimé. Corrigez son RIB plutôt.');
  return validerRegistreVirements({ ...registre, comptes: registre.comptes.filter(c => c.id !== compteId) });
}

export type NouvelleOperationVirement = Omit<Virement, 'numero' | 'updatedAt'>;
export function ajouterVirement(registre: RegistreVirements, operation: NouvelleOperationVirement): RegistreVirements {
  exiger(operation.tiersId !== undefined,
    'Choisissez le client (recette) ou le fournisseur (DED) : son nom et son RIB figurent sur l’ordre de virement.');
  verifierTiersDuVirement(registre, operation);
  const date = dateValide(operation.date, 'Date du virement');
  exiger(operation.sens === 'RECETTE' || operation.sens === 'DEPENSE', 'Type de virement invalide.');
  const cle = `${operation.sens === 'RECETTE' ? 'VR' : 'VD'}-${date.slice(0, 4)}`;
  const suivant = (registre.compteurs[cle] ?? 0) + 1;
  exiger(suivant <= 999_999_999, 'Limite de numérotation des virements atteinte.');
  return validerRegistreVirements({
    ...registre,
    ecritures: [...registre.ecritures, { ...operation, numero: `${cle}-${String(suivant).padStart(4, '0')}` }],
    compteurs: { ...registre.compteurs, [cle]: suivant },
  });
}

export function modifierVirement(registre: RegistreVirements, operation: Virement): RegistreVirements {
  const ancienne = registre.ecritures.find(v => v.id === operation.id);
  exiger(ancienne, 'Virement introuvable.');
  exiger(operation.numero === ancienne.numero && operation.sens === ancienne.sens && operation.createdAt === ancienne.createdAt,
    'L’identité et le type du virement ne peuvent pas être modifiés.');
  verifierTiersDuVirement(registre, operation);
  return validerRegistreVirements({ ...registre, ecritures: registre.ecritures.map(v => v.id === operation.id ? operation : v) });
}

/* -------------------------------------------------------------------------
 * Fiches clients et fournisseurs : le bénéficiaire d'un virement.
 * ---------------------------------------------------------------------- */

export function ajouterTiers(registre: RegistreVirements, fiche: Tiers): RegistreVirements {
  return validerRegistreVirements({ ...registre, tiers: [...registre.tiers, fiche] });
}

export function modifierTiers(registre: RegistreVirements, fiche: Tiers): RegistreVirements {
  exiger(registre.tiers.some(t => t.id === fiche.id), 'Client ou fournisseur introuvable.');
  return validerRegistreVirements({ ...registre, tiers: registre.tiers.map(t => t.id === fiche.id ? fiche : t) });
}

/**
 * Supprime une fiche restée sans virement.
 *
 * Une fiche déjà utilisée n'est jamais supprimée : les ordres de virement
 * imprimés portent son nom et son RIB, et l'historique doit rester lisible.
 * Le message le dit plutôt que de laisser l'interface proposer l'impossible.
 */
export function supprimerTiersVirement(registre: RegistreVirements, tiersId: string): RegistreVirements {
  const fiche = registre.tiers.find(t => t.id === tiersId);
  exiger(fiche, 'Client ou fournisseur introuvable.');
  exiger(!registre.ecritures.some(v => v.tiersId === tiersId),
    `« ${fiche.nom} » porte des virements : il ne peut pas être supprimé. Corrigez sa fiche plutôt.`);
  return validerRegistreVirements({ ...registre, tiers: registre.tiers.filter(t => t.id !== tiersId) });
}

/**
 * Bénéficiaire obligatoire : toute recette ou DED par virement passe par une
 * fiche client ou fournisseur enregistrée. Les virements d'avant les fiches,
 * eux, gardent leur tiers écrit à la main et restent modifiables.
 */
export function verifierTiersDuVirement(registre: RegistreVirements, virement: Pick<Virement, 'tiersId' | 'sens'>): void {
  if (virement.tiersId === undefined) return;
  const fiche = registre.tiers.find(t => t.id === virement.tiersId);
  exiger(fiche, 'Le client ou le fournisseur de ce virement est introuvable.');
  exiger(fiche.type === (virement.sens === 'RECETTE' ? 'CLIENT' : 'FOURNISSEUR'),
    virement.sens === 'RECETTE'
      ? 'Une recette par virement se reçoit d’un client : choisissez une fiche client.'
      : 'Une DED par virement se paie à un fournisseur : choisissez une fiche fournisseur.');
  if (virement.sens === 'DEPENSE' && !ribComplet(fiche)) {
    exiger(false, `Le RIB de « ${fiche.nom} » n’est pas renseigné : complétez sa fiche avant de l’utiliser.`);
  }
}

/**
 * Ajout d'exemples en une seule écriture : comptes, fiches et virements arrivent
 * ensemble ou pas du tout, pour ne jamais laisser un registre à moitié rempli.
 * Chaque élément déjà présent est ignoré, jamais dupliqué.
 */
export function ajouterExemplesVirements(
  registre: RegistreVirements,
  exemple: { comptes?: CompteVirement[]; tiers?: Tiers[]; virements?: NouvelleOperationVirement[] },
): RegistreVirements {
  const cleCompte = (c: { banque: string; numeroCompte: string }) =>
    `${c.banque.toLocaleLowerCase('fr')}\0${c.numeroCompte.toLocaleLowerCase('fr')}`;
  const cleTiers = (t: { type: string; nom: string }) => `${t.type}\0${t.nom.toLocaleLowerCase('fr')}`;
  const idsComptes = new Set(registre.comptes.map(c => c.id));
  const clesComptes = new Set(registre.comptes.map(cleCompte));
  const idsTiers = new Set(registre.tiers.map(t => t.id));
  const clesTiers = new Set(registre.tiers.map(cleTiers));

  let suivant: RegistreVirements = registre;
  const comptes = (exemple.comptes ?? []).filter(c => {
    if (idsComptes.has(c.id) || clesComptes.has(cleCompte(c))) return false;
    idsComptes.add(c.id); clesComptes.add(cleCompte(c));
    return true;
  });
  if (comptes.length) suivant = ajouterComptesVirement(suivant, comptes);

  const tiers = (exemple.tiers ?? []).filter(t => {
    if (idsTiers.has(t.id) || clesTiers.has(cleTiers(t))) return false;
    idsTiers.add(t.id); clesTiers.add(cleTiers(t));
    return true;
  });
  for (const fiche of tiers) suivant = ajouterTiers(suivant, fiche);

  // Un virement d'exemple déjà chargé n'est jamais ajouté deux fois.
  const idsVirements = new Set(suivant.ecritures.map(v => v.id));
  for (const virement of exemple.virements ?? []) {
    if (idsVirements.has(virement.id)) continue;
    suivant = ajouterVirement(suivant, virement);
    idsVirements.add(virement.id);
  }
  return suivant;
}

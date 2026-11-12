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
}

export interface RegistreVirements {
  comptes: CompteVirement[];
  ecritures: Virement[];
  /** Le compteur est conservé même si une écriture est retirée. */
  compteurs: Record<string, number>;
}

export function peutGererVirements(role: Role | string): boolean {
  return role === 'admin' || role === 'comptable';
}

export function registreVirementsVide(): RegistreVirements {
  return { comptes: [], ecritures: [], compteurs: {} };
}

/** Mention facultative de l'ordre de virement : absente plutôt que vide. */
function optionnel(valeur: unknown): string | undefined {
  if (valeur === undefined || valeur === null || valeur === '') return undefined;
  return texte(valeur, 'Mention de l’ordre de virement', 200) || undefined;
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
  const ecritures = tableau(registre.ecritures, 'Virements', MAX_ECRITURES).map(virementValide);
  const ids = new Set<string>();
  const numeros = new Set<string>();
  const minimum: Record<string, number> = {};
  for (const v of ecritures) {
    exiger(idsComptes.has(v.compteId), 'Un virement référence un compte bancaire introuvable.');
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
  return { comptes, ecritures, compteurs };
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
  return validerRegistreVirements({ ...registre, ecritures: registre.ecritures.map(v => v.id === operation.id ? operation : v) });
}

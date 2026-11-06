import type { ChargementLivre, DonneesCaisse, Ecriture, LigneDetail, MasqueSaisie, Sauvegarde, Sens } from '../types';
import { categoriesPour, masquesParDefaut } from './constants';
import { comparerEcritures, creerDonnees, identifiant } from './ledger';
import { estDateValide, exiger, montantEntier, objet, validerDonnees, validerSauvegarde } from './validation';

export { categoriesPour, masquesParDefaut } from './constants';
export const CLE_LIVRE = 'salfa_tresorerie_livre_v2';
export const CLE_ECRITURES = 'salfa_tresorerie_ecritures_v1';
export const CLE_PARAMETRES = 'salfa_tresorerie_parametres_v1';
export const CLE_MASQUES = 'salfa_tresorerie_masques_v1';
export const CLE_ANCIENNE_CAISSE = 'salfa_caisse_transactions';
const CLES_SECOURS = [CLE_LIVRE, CLE_ECRITURES, CLE_PARAMETRES, CLE_MASQUES, CLE_ANCIENNE_CAISSE];

function decoder(brut: string, champ: string): unknown {
  try { return JSON.parse(brut) as unknown; }
  catch { throw new Error(`${champ} : les données JSON sont illisibles. Le stockage d’origine n’a pas été modifié.`); }
}

function lireJson(cle: string): unknown | null {
  const brut = localStorage.getItem(cle);
  return brut === null ? null : decoder(brut, cle);
}

function texte(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }

function migrerEcriture(v: unknown, index: number, reparations: { total: number }): Ecriture {
  const e = objet(v, `Ancienne écriture ${index + 1}`);
  const type = texte(e.sens ?? e.type).toUpperCase();
  exiger(type === 'RECETTE' || type === 'DEPENSE', `Ancienne écriture ${index + 1} : type « ${type || 'absent'} » non reconnu.`);
  const sens: Sens = type;
  const bruteDate = texte(e.date);
  const date = /^(\d{4}-\d{2}-\d{2})T/.test(bruteDate) ? bruteDate.slice(0, 10) : bruteDate;
  exiger(estDateValide(date), `Ancienne écriture ${index + 1} : date invalide (${date || 'absente'}).`);
  let lignesDetail: LigneDetail[] | undefined;
  if (Array.isArray(e.lignesDetail) && e.lignesDetail.length) {
    lignesDetail = e.lignesDetail.map(v => {
      const vObj = objet(v, 'Ancien poste');
      const m = montantEntier(vObj.montant, 'Ancien montant de poste');
      return {
        id: texte(vObj.id) || identifiant('d'),
        libelle: texte(vObj.libelle) || 'Poste sans libellé',
        reference: texte(vObj.reference) || undefined,
        montant: m,
      };
    }).filter(l => l.montant > 0);
    if (!lignesDetail.length) lignesDetail = undefined;
  }
  const totalDetails = lignesDetail?.reduce((s, l) => s + l.montant, 0) ?? 0;
  const montant = lignesDetail ? totalDetails : montantEntier(e.montant, 'Ancien montant');
  exiger(montant > 0, `Ancienne écriture ${index + 1} : montant nul ou invalide.`);
  if (lignesDetail && typeof e.montant === 'number' && e.montant !== montant) reparations.total++;
  const createdAt = texte(e.createdAt);
  const reference = texte(e.reference) || undefined;
  const observation = texte(e.observation ?? e.notes) || undefined;
  return {
    id: texte(e.id) || identifiant(),
    numero: texte(e.numero ?? e.numeroPiece),
    date, sens,
    libelle: texte(e.libelle) || (sens === 'RECETTE' ? 'Recettes journalières' : 'Dépenses diverses'),
    categorie: texte(e.categorie) || categoriesPour(sens).slice(-1)[0],
    tiers: texte(e.tiers ?? e.beneficiaire) || undefined,
    montant, lignesDetail,
    mode: texte(e.mode ?? e.modePaiement) || undefined,
    reference,
    observation: observation === reference ? undefined : observation,
    createdAt: Number.isFinite(Date.parse(createdAt)) ? createdAt : new Date().toISOString(),
  };
}

function migrerMasques(brut: unknown): MasqueSaisie[] {
  if (brut === null) return masquesParDefaut();
  exiger(Array.isArray(brut), 'Anciens masques : liste attendue.');
  // Un choix explicite de supprimer tous les masques doit rester possible.
  return brut.map((v, i) => {
    const m = objet(v, `Ancien masque ${i + 1}`);
    exiger(Array.isArray(m.lignes), 'Ancien masque : postes manquants.');
    return {
      id: texte(m.id) || identifiant('masque'),
      nom: texte(m.nom), sens: m.sens,
      description: texte(m.description) || undefined,
      libelle: texte(m.libelle) || undefined,
      lignes: m.lignes.map(v => {
        const l = objet(v, 'Ancien poste de masque');
        return { description: texte(l.description), montantDefaut: l.montantDefaut == null ? undefined : l.montantDefaut };
      }),
    } as MasqueSaisie;
  });
}

function migrer(): { donnees: DonneesCaisse; avertissement: string | null } {
  const brutEcritures = lireJson(CLE_ECRITURES) ?? lireJson(CLE_ANCIENNE_CAISSE);
  const brutParametres = lireJson(CLE_PARAMETRES);
  const brutMasques = lireJson(CLE_MASQUES);
  if (brutEcritures === null && brutParametres === null && brutMasques === null) {
    return { donnees: creerDonnees(), avertissement: null };
  }
  exiger(brutEcritures === null || Array.isArray(brutEcritures), 'Ancien livre : liste d’écritures attendue.');
  const reparations = { total: 0 };
  const ecritures = (brutEcritures ?? []).map((e, i) => migrerEcriture(e, i, reparations)).sort(comparerEcritures);
  const compteurs: Record<string, number> = {};
  // Recenser les numéros existants avant d'attribuer ceux qui manquent.
  for (const e of ecritures) {
    const match = e.numero.match(/^(RC|DP)-(\d{4})-(\d+)$/);
    if (match) {
      const cle = `${match[1]}-${match[2]}`;
      compteurs[cle] = Math.max(compteurs[cle] ?? 0, Number(match[3]));
    }
  }
  for (const e of ecritures) {
    if (!e.numero) {
      const prefixe = `${e.sens === 'RECETTE' ? 'RC' : 'DP'}-${e.date.slice(0, 4)}`;
      const suivant = (compteurs[prefixe] ?? 0) + 1;
      e.numero = `${prefixe}-${String(suivant).padStart(4, '0')}`;
      compteurs[prefixe] = suivant;
    }
  }
  const p = brutParametres === null ? { soldeInitial: 0 } : objet(brutParametres, 'Anciens paramètres');
  const donnees = validerDonnees({
    ecritures,
    parametres: { soldeInitial: p.soldeInitial ?? 0 },
    masques: migrerMasques(brutMasques),
    compteurs,
  });
  return {
    donnees,
    avertissement: reparations.total
      ? `${reparations.total} ancien(s) total(s) ont été recalculés à partir des postes valides. Les données d’origine sont conservées ; vérifiez ces pièces et téléchargez une sauvegarde.`
      : 'Vos anciennes données ont été reprises. Les clés d’origine sont conservées ; téléchargez une sauvegarde SQL pour les protéger.',
  };
}

/** Lecture sans écriture implicite : un stockage corrompu n'est jamais remplacé par un livre vide. */
export function chargerLivre(): ChargementLivre {
  const vide: Sauvegarde = { format: 'CAISSE-SALFA', version: 1, revision: 0, updatedAt: new Date().toISOString(), ...creerDonnees() };
  try {
    const brut = localStorage.getItem(CLE_LIVRE);
    if (brut !== null) {
      const livre = validerSauvegarde(decoder(brut, 'Livre enregistré'));
      return { livre, erreur: null, avertissement: null, migration: false, normalisation: livre.parametres.exercice === undefined, };
    }
    const { donnees, avertissement } = migrer();
    return { livre: { ...vide, ...donnees }, erreur: null, avertissement, migration: avertissement !== null, normalisation: false, };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Le stockage local est inaccessible.';
    return {
      livre: vide, migration: false, avertissement: null, normalisation: false,
      erreur: `${message} Les modifications sont bloquées pour protéger vos données. Téléchargez les données de secours dans « Données & sauvegardes », puis rechargez ou restaurez une sauvegarde valide.`,
    };
  }
}

function erreurStockage(e: unknown): Error {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    return new Error('Le stockage du navigateur est plein. La modification n’a pas été enregistrée : exportez une sauvegarde et libérez de l’espace avant de réessayer.');
  }
  return new Error('Le navigateur a refusé la sauvegarde locale. La modification n’a pas été enregistrée. Vérifiez les autorisations de stockage, puis réessayez.');
}

/** Un seul setItem atomique pour les écritures, paramètres, masques et compteurs. */
export function sauvegarderLivre(livre: Sauvegarde, revisionAttendue: number, recuperation = false): Sauvegarde {
  const propre = validerSauvegarde(livre);
  let brut: string | null;
  try { brut = localStorage.getItem(CLE_LIVRE); }
  catch (e) { throw erreurStockage(e); }
  let revisionActuelle = 0;
  let successeur = false;
  if (brut !== null) {
    let actuel: Sauvegarde | null;
    try { actuel = validerSauvegarde(decoder(brut, 'Livre enregistré')); }
    catch (e) {
      if (!recuperation) throw e;
      // Récupération explicite d'un stockage corrompu : l'appelant a exporté les données brutes.
      revisionActuelle = Math.max(propre.revision, revisionAttendue);
      actuel = null;
    }
    if (actuel) {
      // La restauration est une action explicite et vérifiée : elle constitue la révision suivante.
      successeur = recuperation && actuel.revision === revisionAttendue - 1;
      exiger(actuel.revision === revisionAttendue || successeur,
        'Le livre a été modifié dans un autre onglet. Rechargez les données avant d’enregistrer pour éviter d’écraser une écriture.');
      revisionActuelle = actuel.revision;
    }
  } else {
    // Le chargement ne doit jamais créer de valeur vide : seule une migration ou une restauration explicite peut initialiser.
    exiger(revisionAttendue === 0 || recuperation,
      'Le stockage a été supprimé dans un autre onglet. Rechargez le livre avant de continuer.');
  }
  const suivant: Sauvegarde = {
    ...propre, revision: (successeur ? revisionActuelle : Math.max(revisionActuelle, revisionAttendue)) + 1,
    updatedAt: new Date().toISOString(), exportedAt: undefined,
  };
  try { localStorage.setItem(CLE_LIVRE, JSON.stringify(suivant)); }
  catch (e) { throw erreurStockage(e); }
  return suivant;
}

export function donneesSecours(): Record<string, string> {
  const cles: Record<string, string> = {};
  for (const cle of CLES_SECOURS) {
    try { const brut = localStorage.getItem(cle); if (brut !== null) cles[cle] = brut; }
    catch { cles[cle] = '[lecture refusée par le navigateur]'; }
  }
  return cles;
}

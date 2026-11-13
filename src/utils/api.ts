import type { CompteVirement, NouvelleOperationVirement, Tiers, Virement } from './virements';
import type { Ecriture, MasqueSaisie, Sauvegarde, Sens } from '../types';
import { normaliserEntetes, type DocumentEntete, type EnteteDocument } from './entete';
import { categoriesParDefaut } from './constants';
import { validerDonnees } from './validation';

/**
 * Client de l'API PHP/MySQL utilisée sur WAMP.
 *
 * L'application fonctionne en deux modes :
 *  - « local » (par défaut, développement et tests) : stockage du navigateur ;
 *  - « api » (build de déploiement VITE_MODE_API=api) : toutes les lectures et écritures passent
 *    par l'API PHP, qui reste la seule source de vérité.
 */
export type ModeStockage = 'local' | 'api';

const VARIABLES = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** true pour un build de déploiement (VITE_MODE_API=api) ou ?api=1 dans l'URL. */
export const MODE_STOCKAGE: ModeStockage =
  VARIABLES.VITE_MODE_API === 'api' || new URLSearchParams(window.location.search).get('api') === '1' ? 'api' : 'local';

export const MODE_API = MODE_STOCKAGE === 'api';

/** Erreur renvoyée par l'API : le message est déjà rédigé pour l'utilisateur. */
export class ErreurApi extends Error {
  readonly code: string;
  readonly statut: number;

  constructor(message: string, code: string, statut: number) {
    super(message);
    this.name = 'ErreurApi';
    this.code = code;
    this.statut = statut;
  }
}

export interface Utilisateur {
  /** Entier côté MySQL ; chaîne pour la session locale de démonstration. */
  id: number | string;
  identifiant: string;
  nomComplet: string;
  /** « comptable » remplace l'ancien « lecteur » : même lecture, nom métier. */
  role: 'comptable' | 'caissier' | 'admin';
}

export interface EtatSession {
  connecte: boolean;
  utilisateur: Utilisateur | null;
  /**
   * Inactivité tolérée annoncée par le serveur, en secondes. L'interface aligne
   * sa fenêtre de présence dessus : une durée différente d'un côté et de l'autre
   * déconnectait la caisse alors que le serveur la considérait encore ouverte.
   */
  dureeSession?: number;
}

/**
 * Racine de l'API, relative au dossier de l'application.
 * Déployée sous http://localhost/caisse-salfa/, elle vaut ./api/.
 */
function baseApi(): string {
  const forcee = (window as unknown as { SALFA_API_BASE?: string }).SALFA_API_BASE;
  if (typeof forcee === 'string' && forcee) return forcee.replace(/\/?$/, '/');
  return new URL('api/', document.baseURI).toString();
}

/**
 * Aiguillage unique : api/index.php?action=livre.
 * Chaque action est aussi appelable en direct (api/livre.php) pour le diagnostic.
 */
function urlPoint(route: string): string {
  return `${baseApi()}index.php?action=${encodeURIComponent(route)}`;
}

/** Envoie une requête à un fichier d'API et normalise les erreurs. */
async function appeler<T>(route: string, options: { methode?: 'GET' | 'POST'; corps?: unknown } = {}): Promise<T> {
  const methode = options.methode ?? 'GET';
  let reponse: Response;
  try {
    reponse = await fetch(urlPoint(route), {
      method: methode,
      credentials: 'same-origin',
      headers: methode === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: methode === 'POST' ? JSON.stringify(options.corps ?? {}) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ErreurApi(
      'Le serveur de la caisse est injoignable. Vérifiez que WAMP est démarré, puis rechargez la page.',
      'reseau',
      0,
    );
  }

  let charge: unknown = null;
  try { charge = await reponse.json(); }
  catch {
    // Page 404 d'Apache, erreur PHP en HTML, mauvais dossier… : message actionnable.
    throw new ErreurApi(
      reponse.status === 404
        ? 'L’API est introuvable : vérifiez que le dossier api a bien été copié à côté de index.html.'
        : `Le serveur a répondu de façon inattendue (HTTP ${reponse.status}). Consultez les journaux PHP de WAMP.`,
      reponse.status === 404 ? 'point_absent' : 'reponse_invalide',
      reponse.status,
    );
  }
  const donnees = charge as { ok?: boolean; erreur?: string; code?: string } & Record<string, unknown>;
  if (!reponse.ok || donnees.ok === false) {
    throw new ErreurApi(
      typeof donnees.erreur === 'string' && donnees.erreur ? donnees.erreur : `Erreur serveur (HTTP ${reponse.status}).`,
      typeof donnees.code === 'string' ? donnees.code : 'erreur',
      reponse.status,
    );
  }
  return donnees as T;
}

/** Contrôle de disponibilité utilisé au démarrage pour afficher un diagnostic clair. */
export async function sante(): Promise<{ revision: number; exercice: number | null; versionApi: string }> {
  return appeler('sante');
}

export async function session(): Promise<EtatSession> {
  const reponse = await appeler<EtatSession & { ok: boolean }>('session');
  return {
    connecte: Boolean(reponse.connecte),
    utilisateur: reponse.utilisateur ?? null,
    ...(typeof reponse.dureeSession === 'number' && reponse.dureeSession > 0 ? { dureeSession: reponse.dureeSession } : {}),
  };
}

export async function connexion(identifiant: string, motDePasse: string): Promise<EtatSession> {
  const reponse = await appeler<{ connecte: boolean; utilisateur: Utilisateur | null }>('connexion', {
    methode: 'POST',
    corps: { identifiant, motDePasse },
  });
  return { connecte: Boolean(reponse.connecte), utilisateur: reponse.utilisateur ?? null };
}

export async function deconnexion(): Promise<void> {
  await appeler('deconnexion', { methode: 'POST' });
}

/**
 * Ramène un livre reçu de MySQL à une forme toujours affichable.
 *
 * Le serveur peut répondre avec un livre partiel : premier appel sur une base
 * fraîche, table des en-têtes vide, catégories non encore semées, colonne
 * ajoutée par une version plus récente… Sans ce garde-fou, un champ absent
 * (`entetes`, `categories`) casse le rendu et l'application se ferme sur
 * l'écran « L'affichage a rencontré un problème ».
 *
 * Les valeurs manquantes reprennent celles de la caisse (en-tête livré,
 * catégories de départ) ; rien n'est inventé ni enregistré côté serveur.
 */
export function normaliserLivreServeur(brut: unknown): Sauvegarde {
  const livre = (brut ?? {}) as Partial<Sauvegarde>;
  const parametres = (livre.parametres ?? {}) as Partial<Sauvegarde['parametres']>;
  const complet: Sauvegarde = {
    format: 'CAISSE-SALFA',
    version: 1,
    revision: Number.isSafeInteger(livre.revision) ? Number(livre.revision) : 0,
    updatedAt: typeof livre.updatedAt === 'string' && livre.updatedAt ? livre.updatedAt : new Date().toISOString(),
    ecritures: Array.isArray(livre.ecritures) ? livre.ecritures : [],
    parametres: {
      soldeInitial: Number.isSafeInteger(parametres.soldeInitial) ? Number(parametres.soldeInitial) : 0,
      exercice: typeof parametres.exercice === 'number' ? parametres.exercice : undefined,
      reportPrecedent: parametres.reportPrecedent ?? null,
    },
    masques: Array.isArray(livre.masques) ? livre.masques : [],
    compteurs: livre.compteurs && typeof livre.compteurs === 'object' ? livre.compteurs : {},
    exercicesClotures: Array.isArray(livre.exercicesClotures) ? livre.exercicesClotures : [],
    ...(livre.virements === undefined ? {} : { virements: livre.virements }),
    entetes: normaliserEntetes(livre.entetes),
    categories: livre.categories && typeof livre.categories === 'object'
      ? { recette: livre.categories.recette ?? [], depense: livre.categories.depense ?? [] }
      : categoriesParDefaut(),
  };
  // Dernière barrière : les catégories vides prennent celles de la caisse. Les
  // autres contrôles (montants, numéros, révisions) ne sont pas refaits ici :
  // le serveur les applique déjà, et un livre lisible doit s'afficher.
  try {
    return { ...complet, ...validerDonnees(complet) };
  } catch {
    return { ...complet, categories: categoriesParDefaut() };
  }
}

export async function chargerLivreApi(): Promise<Sauvegarde> {
  const reponse = await appeler<{ livre: Sauvegarde }>('livre');
  return normaliserLivreServeur(reponse.livre);
}

/** Chaque mutation renvoie le livre complet : le serveur reste la référence. */
const mutation = (route: string, corps: Record<string, unknown>) =>
  appeler<{ livre: unknown }>(route, { methode: 'POST', corps })
    .then(reponse => ({ livre: normaliserLivreServeur(reponse.livre) }));

export type ActionVirement =
  | { operation: 'ajouter_compte'; compte: CompteVirement }
  | { operation: 'ajouter_comptes'; comptes: CompteVirement[] }
  | { operation: 'modifier_compte'; compte: CompteVirement }
  | { operation: 'supprimer_compte'; compteId: string }
  | { operation: 'ajouter_tiers'; tiers: Tiers }
  | { operation: 'modifier_tiers'; tiers: Tiers }
  | { operation: 'supprimer_tiers'; tiersId: string }
  | { operation: 'charger_exemples'; exemple: { comptes?: CompteVirement[]; tiers?: Tiers[]; virements?: NouvelleOperationVirement[] } }
  | { operation: 'ajouter'; virement: NouvelleOperationVirement }
  | { operation: 'modifier'; virement: Virement };

export const mutations = {
  virement: (revision: number, action: ActionVirement) => mutation('virements', { revision, ...action }),
  ecriture: (revision: number, ecriture: Ecriture) =>
    mutation('ecritures', { revision, ecriture }),
  supprimer: (revision: number, id: string) =>
    mutation('ecritures-supprimer', { revision, id }),
  restaurerEcriture: (revision: number, ecriture: Ecriture) =>
    mutation('ecritures-restaurer', { revision, ecriture }),
  masques: (revision: number, masques: MasqueSaisie[]) =>
    mutation('masques', { revision, masques }),
  entete: (revision: number, document: DocumentEntete, entete: EnteteDocument) =>
    mutation('entete', { revision, document, entete }),
  categories: (revision: number, sens: Sens, categories: string[]) =>
    mutation('categories', { revision, sens, categories }),
  soldeInitial: (revision: number, soldeInitial: number) =>
    mutation('solde-initial', { revision, soldeInitial }),
  cloture: (revision: number, archive: unknown) =>
    mutation('cloture', { revision, archive }),
  restauration: (sauvegarde: Sauvegarde, revision: number) =>
    mutation('restauration', { sauvegarde, revision }),
};

/**
 * Dump complet de la base au format .sql.
 *
 * Le point répond en fichier joint ; on lit donc le texte brut plutôt que du
 * JSON. Réservé à l'administrateur : le fichier contient les comptes et leurs
 * hachages, jamais les mots de passe en clair.
 */
export async function exporterSql(): Promise<{ contenu: string; nom: string }> {
  let reponse: Response;
  try {
    reponse = await fetch(`${urlPoint('sauvegarde')}&format=sql`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ErreurApi('Le serveur de la caisse est injoignable. Vérifiez que WAMP est démarré.', 'reseau', 0);
  }
  if (!reponse.ok) {
    // Erreur JSON renvoyée par l'API plutôt qu'un fichier.
    let message = `Export refusé (HTTP ${reponse.status}).`;
    let code = 'erreur';
    try {
      const corps = await reponse.json() as { erreur?: string; code?: string };
      if (corps.erreur) message = corps.erreur;
      if (corps.code) code = corps.code;
    } catch { /* réponse non JSON : on garde le message générique */ }
    throw new ErreurApi(message, code, reponse.status);
  }
  const contenu = await reponse.text();
  if (!contenu.includes('CAISSE SALFA')) {
    throw new ErreurApi('Le serveur n’a pas renvoyé de sauvegarde SQL. Vérifiez la configuration de l’API.', 'export_invalide', reponse.status);
  }
  const entete = /filename="([^"]+)"/.exec(reponse.headers.get('Content-Disposition') ?? '');
  const nom = entete?.[1] ?? `sauvegarde_caisse_salfa_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sql`;
  return { contenu, nom };
}

/**
 * Points d'administration : comptes utilisateurs et leurs rôles.
 * Réservés à l'administrateur, le serveur le vérifie lui-même.
 */
export async function appelerComptes<T>(
  route: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown } = {},
): Promise<T> {
  return appeler<T>(route, options);
}

/**
 * Accès MySQL saisis par l'utilisateur, quand l'accès par défaut de WampServer
 * ne fonctionne pas (mot de passe personnalisé, port 3307, base déjà nommée
 * autrement). Le serveur prépare lui-même sa base, ses tables et ses comptes :
 * il n'y a jamais d'installation à lancer, seulement des accès à préciser.
 */
export interface AccesMysql {
  hote: string;
  port: number;
  base: string;
  utilisateur: string;
  motDePasse: string;
}

export interface ResultatConfiguration {
  message: string;
  base: string;
  tables: number;
  comptes: { administrateur: string; comptable: string };
}

export async function configurerServeur(acces: AccesMysql): Promise<ResultatConfiguration> {
  return appeler<ResultatConfiguration>('configurer', { methode: 'POST', corps: acces });
}

export interface DemandePrecision {
  id: number;
  ecritureId: string;
  numero: string;
  message: string;
  auteur: string;
  creeLe: string;
  completeLe: string | null;
  completePar: string | null;
}

export async function lireDemandes(): Promise<DemandePrecision[]> {
  return (await appeler<{ demandes: DemandePrecision[] }>('precisions')).demandes;
}
export async function envoyerDemande(corps: { operation: 'creer'; ecritureId: string; message: string } | { operation: 'completer'; id: number }): Promise<DemandePrecision[]> {
  return (await appeler<{ demandes: DemandePrecision[] }>('precisions', { methode: 'POST', corps })).demandes;
}

export interface MessagePrive {
  id: number; auteurId: number | string; destinataireId: number | string;
  auteurNom: string; destinataireNom: string; contenu: string; creeLe: string; luLe: string | null;
}
export interface BoiteMessages {
  comptes: { id: number | string; nomComplet: string; identifiant: string; role?: string; enLigne?: boolean | number | string | null }[];
  messages: MessagePrive[];
}
export function lireMessages(): Promise<BoiteMessages> { return appeler('messages'); }
export function modifierMessages(corps: { operation: 'envoyer'; destinataireId: string; contenu: string } | { operation: 'lire'; id: number } | { operation: 'supprimer'; id: number } | { operation: 'supprimer_conversation'; correspondantId: string }): Promise<BoiteMessages> {
  return appeler('messages', { methode: 'POST', corps });
}

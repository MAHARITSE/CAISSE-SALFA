import type { Ecriture, MasqueSaisie, Sauvegarde } from '../types';

/**
 * Client de l'API PHP/MySQL utilisée sur WAMP.
 *
 * L'application fonctionne en deux modes :
 *  - « local » (par défaut, développement et tests) : stockage du navigateur ;
 *  - « api » (build de déploiement) : toutes les lectures et écritures passent
 *    par l'API PHP, qui reste la seule source de vérité.
 */
export type ModeStockage = 'local' | 'api';

const VARIABLES = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** true pour le build de déploiement WAMP (`npm run build:wamp`) ou ?api=1 dans l'URL. */
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
  id: number;
  identifiant: string;
  nomComplet: string;
  role: 'lecteur' | 'caissier' | 'admin';
}

export interface EtatSession {
  connecte: boolean;
  utilisateur: Utilisateur | null;
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
 * Envoie une requête à l'API.
 *
 * Si `mod_rewrite` est désactivé sur le serveur, `api/livre` renvoie la page 404
 * d'Apache : la requête est rejouée une fois sous la forme `api/index.php?r=livre`,
 * ce qui fonctionne partout.
 */
async function appeler<T>(route: string, options: { methode?: 'GET' | 'POST'; corps?: unknown } = {}, repli = true): Promise<T> {
  const methode = options.methode ?? 'GET';
  let reponse: Response;
  try {
    reponse = await fetch(baseApi() + route, {
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

  if (repli && (reponse.status === 404 || reponse.status === 405)) {
    const type = reponse.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) {
      if (methode === 'GET') return appeler<T>(`index.php?r=${encodeURIComponent(route)}`, options, false);
      // Les routes POST gardent leur route en query : index.php?r=ecritures.
      return appeler<T>(`index.php?r=${encodeURIComponent(route)}`, options, false);
    }
  }

  let charge: unknown = null;
  try { charge = await reponse.json(); }
  catch {
    throw new ErreurApi(
      `Le serveur a répondu de façon inattendue (HTTP ${reponse.status}). Consultez les journaux PHP de WAMP.`,
      'reponse_invalide',
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
  return { connecte: Boolean(reponse.connecte), utilisateur: reponse.utilisateur ?? null };
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

export async function chargerLivreApi(): Promise<Sauvegarde> {
  const reponse = await appeler<{ livre: Sauvegarde }>('livre');
  return reponse.livre;
}

/** Chaque mutation renvoie le livre complet : le serveur reste la référence. */
export const mutations = {
  ecriture: (revision: number, ecriture: Ecriture) =>
    appeler<{ livre: Sauvegarde }>('ecritures', { methode: 'POST', corps: { revision, ecriture } }),
  supprimer: (revision: number, id: string) =>
    appeler<{ livre: Sauvegarde }>('ecritures/supprimer', { methode: 'POST', corps: { revision, id } }),
  restaurerEcriture: (revision: number, ecriture: Ecriture) =>
    appeler<{ livre: Sauvegarde }>('ecritures/restaurer', { methode: 'POST', corps: { revision, ecriture } }),
  masques: (revision: number, masques: MasqueSaisie[]) =>
    appeler<{ livre: Sauvegarde }>('masques', { methode: 'POST', corps: { revision, masques } }),
  soldeInitial: (revision: number, soldeInitial: number) =>
    appeler<{ livre: Sauvegarde }>('solde-initial', { methode: 'POST', corps: { revision, soldeInitial } }),
  cloture: (revision: number, archive: unknown) =>
    appeler<{ livre: Sauvegarde }>('cloture', { methode: 'POST', corps: { revision, archive } }),
  restauration: (sauvegarde: Sauvegarde) =>
    appeler<{ livre: Sauvegarde }>('restauration', { methode: 'POST', corps: { sauvegarde } }),
};

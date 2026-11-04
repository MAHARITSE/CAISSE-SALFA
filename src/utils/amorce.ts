/**
 * Installation du jeu d'essai dans le navigateur.
 *
 * Ce module n'est utilisé qu'en développement : `demo/amorce.js` l'appelle au
 * démarrage, et `vite.config.ts` n'injecte ce script qu'en mode `serve`.
 * Les règles sont volontairement conservatrices :
 *  - jamais d'écrasement d'un livre rempli sans demande explicite ;
 *  - un livre vide (créé par l'application au premier démarrage) est remplacé ;
 *  - l'ancien livre est toujours recopié avant remplacement ;
 *  - un fichier illisible ne bloque jamais l'application.
 */
import { CLE_ECRITURES, CLE_LIVRE, CLE_MASQUES, CLE_PARAMETRES } from './storage';

export const SOURCE_ESSAI = 'demo/jeu-essai.json';
const MARQUEUR = 'salfa_amorce_demo_faite';

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Un livre vide n'est pas une donnée : l'application en crée un au premier
 * démarrage. Le remplacer par le jeu d'essai ne détruit donc rien.
 */
export function livreVide(brut: string | null): boolean {
  if (!brut) return true;
  try {
    const livre = JSON.parse(brut) as { ecritures?: unknown; exercicesClotures?: unknown; compteurs?: unknown; parametres?: { soldeInitial?: unknown } };
    const vide = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0)
      || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);
    return vide(livre.ecritures) && vide(livre.exercicesClotures) && vide(livre.compteurs)
      && (livre.parametres?.soldeInitial === undefined || livre.parametres.soldeInitial === 0);
  } catch {
    return false; // illisible : on préfère ne rien toucher
  }
}

interface OptionsAmorce {
  /** Remplace un livre existant (bouton explicite ou `?demo=1`). */
  forcer?: boolean;
  /** Valeur de `?demo=` : `0`/`off` désactivent tout chargement. */
  mode?: string;
  memoire?: Stockage;
  session?: Stockage;
  charger?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Copie l'ancien livre en session avant de le remplacer. */
function conserver(session: Stockage, cle: string, valeur: string): void {
  try {
    const nom = `essai_precedent_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}_${cle}`;
    session.setItem(nom, valeur);
  } catch {
    /* stockage de session indisponible : on continue sans copie */
  }
}

/**
 * Installe le jeu d'essai si nécessaire.
 * Renvoie `true` quand un livre vient d'être écrit et que la page doit être
 * rechargée pour que l'application le lise.
 */
export async function amorcer(options: OptionsAmorce = {}): Promise<boolean> {
  const memoire = options.memoire ?? localStorage;
  const session = options.session ?? sessionStorage;
  const charger = options.charger ?? fetch;
  const mode = options.mode ?? '';

  if (mode === '0' || mode === 'off') return false;
  const forcee = options.forcer === true || mode === '1' || mode === 'reset';

  let existant: string | null = null;
  try {
    existant = memoire.getItem(CLE_LIVRE);
  } catch {
    return false; // stockage refusé par le navigateur : inutile d'insister
  }
  // Un livre réellement rempli n'est jamais remplacé sans demande explicite.
  if (existant && !forcee && !livreVide(existant)) return false;
  if (!existant && !forcee && session.getItem(MARQUEUR)) return false;

  const reponse = await charger(SOURCE_ESSAI, { cache: 'no-store' });
  if (!reponse.ok) throw new Error(`jeu d’essai introuvable (${reponse.status})`);
  const livre = await reponse.json() as { format?: unknown; ecritures?: unknown } | null;
  if (!livre || livre.format !== 'CAISSE-SALFA' || !Array.isArray(livre.ecritures)) {
    throw new Error('jeu d’essai illisible');
  }

  if (existant && !livreVide(existant)) conserver(session, CLE_LIVRE, existant);
  memoire.setItem(CLE_LIVRE, JSON.stringify({ ...livre, revision: 0, updatedAt: new Date().toISOString() }));
  // Les anciennes clés éclatées ne doivent pas reprendre le dessus sur ce livre.
  for (const cle of [CLE_ECRITURES, CLE_PARAMETRES, CLE_MASQUES]) {
    try { memoire.removeItem(cle); } catch { /* ignoré */ }
  }
  try { session.setItem(MARQUEUR, '1'); } catch { /* ignoré */ }
  return true;
}

/** Mode demandé par l'URL, sans jamais lever d'exception. */
export function modeDemo(recherche: string): string {
  try {
    return new URLSearchParams(recherche).get('demo') ?? '';
  } catch {
    return '';
  }
}

import { Ecriture, Mode, Parametres, Sens } from '../types';

const CLE_ECRITURES = 'salfa_tresorerie_ecritures_v1';
const CLE_PARAMETRES = 'salfa_tresorerie_parametres_v1';
const CLE_ANCIENNE_CAISSE = 'salfa_caisse_transactions';

export const MODES: Mode[] = ['Espèces', 'Chèque', 'Virement', 'Mobile Money'];

export const CATEGORIES_RECETTE = [
  'Consultations',
  'Pharmacie',
  'Laboratoire',
  'Hospitalisation',
  'Maternité',
  'Imagerie',
  'Subventions & dons',
  'Remboursements',
  'Autres recettes',
];

export const CATEGORIES_DEPENSE = [
  'Achats médicaments',
  'Consommables médicaux',
  'Fournitures de bureau',
  'Carburant & transport',
  'Maintenance & équipements',
  'Salaires & primes',
  'Frais de mission',
  'Honoraires',
  'Eau & électricité',
  'Téléphone & internet',
  'Divers',
];

export const categoriesPour = (sens: Sens): string[] =>
  sens === 'RECETTE' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE;

const MODES_CONNUS = new Set<string>(MODES);
const mode = (v: unknown): Mode => (typeof v === 'string' && MODES_CONNUS.has(v) ? (v as Mode) : 'Espèces');
const texte = (v: unknown): string => (typeof v === 'string' ? v : '');
const montantPositif = (v: unknown): number =>
  typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v) : 0;

function lire(cle: string): unknown {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

const parId = (a: Ecriture, b: Ecriture) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** Lit le livre journal ; importe une fois les données de l'ancienne caisse. */
export function chargerEcritures(): Ecriture[] {
  const brut = lire(CLE_ECRITURES);
  if (Array.isArray(brut)) {
    return brut
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map(normaliser)
      .filter((e): e is Ecriture => e !== null)
      .sort(parId);
  }

  const anciennes = lire(CLE_ANCIENNE_CAISSE);
  if (Array.isArray(anciennes)) {
    const reprises = anciennes
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map(e =>
        normaliser({
          ...e,
          sens: e.sens ?? e.type,
          tiers: e.tiers ?? e.beneficiaire,
          mode: e.mode ?? e.modePaiement,
          numero: e.numero ?? e.numeroPiece,
        }),
      )
      .filter((e): e is Ecriture => e !== null)
      .sort(parId);
    if (reprises.length > 0) {
      enregistrerEcritures(reprises);
      return reprises;
    }
  }

  return [];
}

export function enregistrerEcritures(ecritures: Ecriture[]): void {
  localStorage.setItem(CLE_ECRITURES, JSON.stringify(ecritures));
}

function normaliser(e: Record<string, unknown>): Ecriture | null {
  const sens: Sens = e.sens === 'RECETTE' || e.type === 'RECETTE' ? 'RECETTE' : 'DEPENSE';
  const montant = montantPositif(e.montant);
  const date = texte(e.date);
  if (!montant || !date) return null;
  return {
    id: texte(e.id) || `e-${Math.random().toString(36).slice(2)}`,
    numero: texte(e.numero) || texte(e.numeroPiece),
    date,
    sens,
    libelle: texte(e.libelle),
    categorie: texte(e.categorie) || (sens === 'RECETTE' ? 'Autres recettes' : 'Divers'),
    tiers: texte(e.tiers) || texte(e.beneficiaire) || undefined,
    montant,
    mode: mode(e.mode ?? e.modePaiement),
    reference: texte(e.reference) || texte(e.notes) || undefined,
    createdAt: texte(e.createdAt) || new Date().toISOString(),
  };
}

export function chargerParametres(): Parametres {
  const brut = lire(CLE_PARAMETRES);
  if (brut && typeof brut === 'object') {
    const soldeInitial = (brut as Record<string, unknown>).soldeInitial;
    if (typeof soldeInitial === 'number' && isFinite(soldeInitial)) return { soldeInitial };
  }
  return { soldeInitial: 0 };
}

export function enregistrerParametres(parametres: Parametres): void {
  localStorage.setItem(CLE_PARAMETRES, JSON.stringify(parametres));
}

/** Numéro suivant pour un sens et une année donnés (ex. DP-2026-0007). */
export function prochainNumero(ecritures: Ecriture[], sens: Sens, date: string): string {
  const annee = (date || '').slice(0, 4) || String(new Date().getFullYear());
  const prefixe = `${sens === 'RECETTE' ? 'RC' : 'DP'}-${annee}-`;
  const max = ecritures
    .filter(e => e.sens === sens && e.numero.startsWith(prefixe))
    .reduce((acc, e) => Math.max(acc, Number.parseInt(e.numero.slice(prefixe.length), 10) || 0), 0);
  return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}

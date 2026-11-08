import { MONTANT_MAX } from './constants';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const nombre = (montant: number): string => nf.format(montant);
// Les compteurs restent entiers ; seuls les montants ont deux décimales à l’affichage.
const formatMonetaire = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const montantAffiche = (montant: number): string => formatMonetaire.format(montant);
export const formatAr = (montant: number): string => `${montantAffiche(montant)} Ar`;

/** Ne pas utiliser toISOString() : cela peut changer le jour près de minuit. */
export const aujourdHui = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const moisCourant = (): string => aujourdHui().slice(0, 7);
export const anneeCourante = (): number => Number(aujourdHui().slice(0, 4));
export const libelleExercice = (annee: number): string => `Exercice ${annee}`;

export const dateFr = (iso: string): string => {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const libelleMois = (mois: string): string => {
  const [annee, m] = mois.split('-');
  const index = Number(m) - 1;
  return MOIS[index] ? `${MOIS[index]} ${annee}` : mois;
};

export function decalerMois(mois: string, decalage: number): string {
  const [a, m] = mois.split('-').map(Number);
  const date = new Date(Date.UTC(a, m - 1 + decalage, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function horodatageFr(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/** Refuse les décimales, exponent notation and silent coercion of empty input to zero. */
export function parserMontant(saisie: string, autoriserNegatif = false): number | null {
  const propre = saisie.replace(/[\s\u202f\u00a0]/g, '');
  if (!propre || !(autoriserNegatif ? /^-?\d+$/ : /^\d+$/).test(propre)) return null;
  const montant = Number(propre);
  if (!Number.isSafeInteger(montant) || Math.abs(montant) > MONTANT_MAX) return null;
  return montant;
}

/**
 * Normalisation des libellés à l'ajout ou à l'enregistrement.
 * Ne pas l'appliquer à chaque frappe : réécrire la valeur native perturbe
 * les suggestions Windows, les remplacements et les compositions IME.
 */
export function masqueMajuscules(texte: string): string {
  return texte.toUpperCase();
}

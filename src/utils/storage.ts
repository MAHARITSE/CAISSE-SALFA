import { Ecriture, LigneDetail, MasqueSaisie, Parametres, Sens } from '../types';

const CLE_ECRITURES = 'salfa_tresorerie_ecritures_v1';
const CLE_PARAMETRES = 'salfa_tresorerie_parametres_v1';
const CLE_ANCIENNE_CAISSE = 'salfa_caisse_transactions';

/** Postes types de recettes journalières hospitalières (selon bordereau SALFA) */
export const SERVICES_RECETTES_JOUR = [
  'CONSULTATION',
  'ECHOGRAPHIE',
  'CHAMBRE',
  'LABORATOIRE',
  'MATERNITE',
  'MEDICAMENT',
  'SOINS',
  'HOSPITALISATION',
  'DENTISTERIE',
  'BLOC',
  'DIVERS',
  'VACCIN',
];

/** Postes types de dépenses fréquentes */
export const SERVICES_DEPENSES_TYPES = [
  'ACHATS MEDICAMENTS',
  'FOURNITURES ET CONSOMMABLES',
  'CARBURANT & TRANSPORT',
  'MAINTENANCE ET REPARATION',
  'SALAIRES ET PRIMES',
  'HONORAIRES MEDICAUX',
  'EAU ET ELECTRICITE',
  'TELEPHONE ET INTERNET',
  'FRAIS DE MISSION',
  'DIVERS DEPENSES',
];

export const CATEGORIES_RECETTE = [
  'Recettes journalières',
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
  const date = texte(e.date);

  let lignesDetail: LigneDetail[] | undefined = undefined;
  if (Array.isArray(e.lignesDetail)) {
    const parsed = e.lignesDetail
      .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
      .map((l, idx) => ({
        id: texte(l.id) || `d-${idx}-${Math.random().toString(36).slice(2)}`,
        libelle: texte(l.libelle),
        reference: texte(l.reference) || undefined,
        montant: montantPositif(l.montant),
      }))
      .filter(l => Boolean(l.libelle) || l.montant > 0);
    if (parsed.length > 0) {
      lignesDetail = parsed;
    }
  }

  const totalDetails = lignesDetail ? lignesDetail.reduce((s, d) => s + d.montant, 0) : 0;
  const montant = montantPositif(e.montant) || totalDetails;

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
    lignesDetail,
    reference: texte(e.reference) || undefined,
    observation: texte(e.observation) || texte(e.notes) || undefined,
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

const CLE_MASQUES = 'salfa_tresorerie_masques_v1';

export const MASQUES_DEFAUT: MasqueSaisie[] = [
  {
    id: 'masque-recettes-hopital',
    nom: 'Bordereau recettes hôpital (12 postes)',
    sens: 'RECETTE',
    description: 'Postes types du carnet de caisse hospitalier',
    lignes: [
      { description: 'CONSULTATION' },
      { description: 'ECHOGRAPHIE' },
      { description: 'CHAMBRE' },
      { description: 'LABORATOIRE' },
      { description: 'MATERNITE' },
      { description: 'MEDICAMENT' },
      { description: 'SOINS' },
      { description: 'HOSPITALISATION' },
      { description: 'DENTISTERIE' },
      { description: 'BLOC' },
      { description: 'DIVERS' },
      { description: 'VACCIN' },
    ],
  },
  {
    id: 'masque-depenses-courantes',
    nom: 'Charges courantes & fonctionnement',
    sens: 'DEPENSE',
    description: 'Dépenses périodiques d exploitation',
    lignes: [
      { description: 'ACHATS MEDICAMENTS' },
      { description: 'FOURNITURES MEDICALES' },
      { description: 'CARBURANT' },
      { description: 'EAU & ELECTRICITE' },
      { description: 'MAINTENANCE' },
      { description: 'DIVERS' },
    ],
  },
];

export function chargerMasques(): MasqueSaisie[] {
  const brut = lire(CLE_MASQUES);
  if (Array.isArray(brut) && brut.length > 0) {
    return brut as MasqueSaisie[];
  }
  enregistrerMasques(MASQUES_DEFAUT);
  return MASQUES_DEFAUT;
}

export function enregistrerMasques(masques: MasqueSaisie[]): void {
  localStorage.setItem(CLE_MASQUES, JSON.stringify(masques));
}

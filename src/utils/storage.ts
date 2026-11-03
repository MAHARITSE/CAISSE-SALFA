import { Depense, MasqueDepense, ModePaiement } from '../types';

const CLE_DEPENSES = 'salfa_caisse_transactions';
const CLE_MASQUES = 'salfa_caisse_masques_depenses';

export const CATEGORIES = [
  'Consommables médicaux',
  'Pharmacie & Médicaments',
  'Fournitures de bureau',
  'Carburant & Transport',
  'Maintenance & Équipements',
  'Frais de mission',
  'Eau & Électricité',
  'Divers',
];

export const MODES: ModePaiement[] = ['Espèces', 'Chèque', 'Virement', 'Mobile Money'];

const MODES_CONNUS = new Set<string>(MODES);

const mode = (v: unknown): ModePaiement =>
  typeof v === 'string' && MODES_CONNUS.has(v) ? (v as ModePaiement) : 'Espèces';

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

const nombre = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

function lire(cle: string): unknown {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

/** Lit les dépenses enregistrées (y compris l'ancien format de l'application). */
export function chargerDepenses(): Depense[] {
  const brut = lire(CLE_DEPENSES);
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .filter(d => d.type === undefined || d.type === 'DEPENSE')
    .map(d => ({
      id: texte(d.id) || `tx-${Math.random().toString(36).slice(2)}`,
      numero: texte(d.numero) || texte(d.numeroPiece),
      date: texte(d.date),
      libelle: texte(d.libelle),
      montant: nombre(d.montant),
      categorie: texte(d.categorie) || 'Divers',
      beneficiaire: texte(d.beneficiaire),
      modePaiement: mode(d.modePaiement),
      notes: texte(d.notes) || undefined,
      createdAt: texte(d.createdAt) || new Date().toISOString(),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function enregistrerDepenses(depenses: Depense[]): void {
  localStorage.setItem(CLE_DEPENSES, JSON.stringify(depenses));
}

/** Lit le masque ; à défaut, propose quelques dépenses types. */
export function chargerMasques(): MasqueDepense[] {
  const brut = lire(CLE_MASQUES);
  if (!Array.isArray(brut)) return masqueParDefaut();
  const masques = brut
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map(m => ({
      id: texte(m.id) || `m-${Math.random().toString(36).slice(2)}`,
      designation: texte(m.designation) || texte(m.libelle),
      libelle: texte(m.libelle),
      montant: nombre(m.montant) || nombre(m.montantDefaut),
      categorie: texte(m.categorie) || 'Divers',
      beneficiaire: texte(m.beneficiaire),
      modePaiement: mode(m.modePaiement),
    }))
    .filter(m => m.designation && m.libelle);
  return masques.length > 0 ? masques : masqueParDefaut();
}

export function enregistrerMasques(masques: MasqueDepense[]): void {
  localStorage.setItem(CLE_MASQUES, JSON.stringify(masques));
}

function masqueParDefaut(): MasqueDepense[] {
  const base = [
    ['Consommables médicaux', 'Consommables médicaux', 820000],
    ['Carburant ambulance', 'Carburant ambulance et groupe électrogène', 650000],
    ['Fournitures de bureau', 'Fournitures de bureau', 180000],
    ['Frais de mission', 'Frais de mission du personnel', 350000],
  ] as const;
  return base.map(([designation, libelle, montant], i) => ({
    id: `m-${i + 1}`,
    designation,
    libelle,
    montant,
    categorie: 'Divers',
    beneficiaire: '',
    modePaiement: 'Espèces',
  }));
}

export function prochainNumero(depenses: Depense[]): string {
  const annee = new Date().getFullYear();
  const prefixe = `DEP-${annee}-`;
  const max = depenses
    .filter(d => d.numero.startsWith(prefixe))
    .reduce((acc, d) => Math.max(acc, Number.parseInt(d.numero.slice(prefixe.length), 10) || 0), 0);
  return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}

/**
 * Masque de saisie des dépenses — configuration de l'entête et utilitaires.
 *
 * Le modèle d'entête est repris de l'application SALAIRE SALFA
 * (`src/bulletin/header.ts` + `src/components/BulletinHeaderModal.tsx`) :
 *  - deux modes : « image complète » ou « textes et logos personnalisés » ;
 *  - sept lignes de texte éditables ;
 *  - logos gauche / droit facultatifs ;
 *  - restauration de l'entête fourni ;
 *  - conservation dans le navigateur (localStorage).
 *
 * Contrairement à SALAIRE SALFA, l'entête n'est pas gravé dans un canevas :
 * l'impression de CAISSE SALFA se fait en HTML (#printable-section), donc
 * l'aperçu et le document imprimé utilisent exactement le même rendu.
 */
import { MasqueEnteteConfig, MasqueDepense, PaymentMode } from '../types';

export const ENTETE_MASQUE_STORAGE_KEY = 'salfa_caisse_masque_entete_v1';
export const MASQUES_DEPENSES_STORAGE_KEY = 'salfa_caisse_masques_depenses_v1';

/** Libellés des sept lignes de l'entête (identiques au modèle SALAIRE SALFA). */
export const ENTETE_LABELS = [
  'Nom principal',
  'Traduction / sous-titre',
  'Service de santé',
  'Traduction du service',
  'Établissement et coordonnées',
  'NIF et STAT',
  'E-mail',
];

export const DEFAULT_ENTETE_LIGNES = [
  'FIANGONANA LOTERANA MALAGASY',
  '(EGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)',
  "SAMPAN'ASA LOTERANA MOMBA NY FAHASALAMANA",
  'DEPARTEMENT DE SANTE - HEALTH DEPARTMENT',
  'SALFA DIRECTION GENERALE - BP 1168 ANTANANARIVO 101 - Tél: +261 20 22 234 56',
  'NIF: 5000767080    STAT: 851 125 120 120 001 36',
  'E-mail: salfa@salfa.mg',
];

export const DEFAULT_TITRE_DOCUMENT = 'MASQUE DE SAISIE DES DEPENSES';
export const DEFAULT_MENTION_PIED =
  "Document interne CAISSE SALFA — à conserver avec les pièces justificatives.";

export function defaultEnteteMasque(): MasqueEnteteConfig {
  return {
    mode: 'personnalise',
    image: '',
    lignes: [...DEFAULT_ENTETE_LIGNES],
    logoGauche: '',
    logoDroit: '',
    titreDocument: DEFAULT_TITRE_DOCUMENT,
    mentionPied: DEFAULT_MENTION_PIED,
    nbLignesVierges: 12,
  };
}

const isStoredImage = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpeg);base64,/i.test(value);

/** Valide et complète une configuration lue (tolère les configurations partielles). */
function normalizeEntete(raw: unknown): MasqueEnteteConfig {
  const base = defaultEnteteMasque();
  if (!raw || typeof raw !== 'object') return base;
  const cfg = raw as Partial<MasqueEnteteConfig>;

  const mode = cfg.mode === 'image' || cfg.mode === 'personnalise' ? cfg.mode : base.mode;
  const lignes = Array.isArray(cfg.lignes)
    ? base.lignes.map((fallback, i) => (typeof cfg.lignes?.[i] === 'string' ? String(cfg.lignes[i]) : fallback))
    : base.lignes;

  return {
    mode,
    image: isStoredImage(cfg.image) ? cfg.image : '',
    lignes,
    logoGauche: isStoredImage(cfg.logoGauche) ? cfg.logoGauche : '',
    logoDroit: isStoredImage(cfg.logoDroit) ? cfg.logoDroit : '',
    titreDocument:
      typeof cfg.titreDocument === 'string' && cfg.titreDocument.trim()
        ? cfg.titreDocument
        : base.titreDocument,
    mentionPied: typeof cfg.mentionPied === 'string' ? cfg.mentionPied : base.mentionPied,
    nbLignesVierges:
      typeof cfg.nbLignesVierges === 'number' && cfg.nbLignesVierges >= 1 && cfg.nbLignesVierges <= 30
        ? Math.round(cfg.nbLignesVierges)
        : base.nbLignesVierges,
  };
}

export function loadEnteteMasque(): MasqueEnteteConfig {
  try {
    const raw = localStorage.getItem(ENTETE_MASQUE_STORAGE_KEY);
    return raw ? normalizeEntete(JSON.parse(raw)) : defaultEnteteMasque();
  } catch {
    return defaultEnteteMasque();
  }
}

export function saveEnteteMasque(config: MasqueEnteteConfig): void {
  // En cas de quota dépassé, l'appelant affiche l'erreur sans modifier l'aperçu.
  localStorage.setItem(ENTETE_MASQUE_STORAGE_KEY, JSON.stringify(config));
}

/** Vérifie le type, le poids et le décodage d'une image d'entête. */
export async function readEnteteImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    throw new Error('Choisissez une image PNG ou JPEG.');
  }
  if (file.size > 1024 * 1024) {
    throw new Error("L'image ne doit pas dépasser 1 Mo.");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image illisible.'));
    reader.onerror = () => reject(new Error('Image illisible.'));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(data);
  if (image.naturalWidth > 12000 || image.naturalHeight > 12000) {
    throw new Error('Image trop grande.');
  }
  return data;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image invalide ou illisible.'));
    image.src = src;
  });
}

/* ------------------------------------------------------------------ */
/* Masques (dépenses types)                                            */
/* ------------------------------------------------------------------ */

export const PAYMENT_MODES: PaymentMode[] = ['Espèces', 'Virement', 'Chèque', 'Mobile Money'];

export const CATEGORIES_DEPENSE_MASQUE = [
  'Pharmacie & Médicaments',
  'Fournitures de bureau',
  'Carburant & Transport',
  'Maintenance & Équipements',
  'Salaires & Primes',
  'Frais de mission',
  'Honoraires Médecins',
  'Consommables Médicaux',
  'Eau & Électricité',
  'Divers Décaissements',
];

/** Code séquentiel MDEP-0001, MDEP-0002, … */
export function prochainCodeMasque(masques: MasqueDepense[]): string {
  const max = masques.reduce((acc, m) => {
    const n = Number.parseInt((m.code || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `MDEP-${String(max + 1).padStart(4, '0')}`;
}

export function masqueVide(masques: MasqueDepense[]): MasqueDepense {
  const now = new Date().toISOString();
  return {
    id: `mdep-${Date.now()}`,
    code: prochainCodeMasque(masques),
    designation: '',
    libelle: '',
    categorie: CATEGORIES_DEPENSE_MASQUE[0],
    beneficiaire: '',
    modePaiement: 'Espèces',
    montantDefaut: 0,
    notes: '',
    actif: true,
    ordre: masques.length,
    createdAt: now,
    updatedAt: now,
  };
}

/** Tri stable : ordre croissant puis désignation. */
export function trierMasques(masques: MasqueDepense[]): MasqueDepense[] {
  return [...masques].sort(
    (a, b) => a.ordre - b.ordre || a.designation.localeCompare(b.designation, 'fr'),
  );
}

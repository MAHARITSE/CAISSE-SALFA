/**
 * Modèle d'en-tête des documents SALFA.
 *
 * Chaque document imprimable (engagement de dépense, autorisation de recette)
 * possède son propre en-tête, modifiable depuis l'onglet « En-têtes ».
 * Le même principe que les bulletins de SALAIRE SALFA est repris :
 *  - « Image complète » : une seule image scannée ou préparée ailleurs ;
 *  - « Textes et logos » : titres, coordonnées, numéros fiscaux et deux logos,
 *    mis en page en HTML — net à l'écran comme à l'impression.
 */

export type DocumentEntete = 'depense' | 'recette';

export interface LigneEntete {
  texte: string;
  /** Texte principal mis en gras. */
  gras: boolean;
  /** Taille en points, appliquée à l'impression. */
  taille: number;
}

export interface EnteteDocument {
  mode: 'image' | 'textes';
  /** Image complète utilisée quand mode === 'image' (data URL PNG ou JPEG). */
  image: string;
  lignes: LigneEntete[];
  logoGauche: string;
  logoDroit: string;
}

export interface EntetesDocuments {
  depense: EnteteDocument;
  recette: EnteteDocument;
}

export const MAX_IMAGE_OCTETS = 1024 * 1024;
/** Les logos voyagent dans la sauvegarde : limite plus basse que l'image complète. */
export const MAX_LOGO_OCTETS = 300 * 1024;
export const MAX_LIGNES_ENTETE = 8;

/** Repères affichés dans l'éditeur, dans l'ordre des lignes livrées. */
export const LIBELLES_LIGNES: string[] = [
  'Nom principal de l’établissement',
  'Église / tutelle',
  'Synode / paritany',
  'Œuvre et département',
  'Département de santé (langue 2)',
  'Établissement et BP',
  'E-mail',
  'Ligne libre',
];

/**
 * Titre imprimé du document, fixe : il désigne la nature de la pièce.
 * Une dépense est couverte par une demande d'engagement de dépense,
 * une recette par une autorisation de recette.
 */
export const TITRE_DOCUMENT: Record<DocumentEntete, string> = {
  depense: 'DEMANDE D’ENGAGEMENT DE DÉPENSE',
  recette: 'AUTORISATION DE RECETTE',
};

/** Préfixe de numérotation : AED pour un engagement, ARC pour une autorisation. */
export const PREFIXE_DOCUMENT: Record<DocumentEntete, string> = {
  depense: 'AED',
  recette: 'ARC',
};

/**
 * Numéro du document d'une pièce : reprend l'année et le rang de la pièce.
 * AED-2026-0007 accompagne la dépense DP-2026-0007 : les deux se répondent
 * toujours, même après une réimpression ou un tri du journal.
 */
export function numeroDocument(numeroPiece: string): string | null {
  const correspondance = /^(RC|DP)-(\d{4})-(\d+)$/.exec(numeroPiece.trim());
  if (!correspondance) return null;
  const [, prefixe, annee, rang] = correspondance;
  return `${PREFIXE_DOCUMENT[prefixe === 'RC' ? 'recette' : 'depense']}-${annee}-${rang}`;
}

function lignesParDefaut(prefixe: string[]): LigneEntete[] {
  return prefixe.map((texte, index) => ({ texte, gras: index === 0, taille: index === 0 ? 16 : 9 }));
}

export function enteteParDefaut(_document: DocumentEntete): EnteteDocument {
  // Reprend l'en-tête des documents officiels de l'hôpital, tel qu'imprimé.
  const commun = [
    'FIANGONANA LOTERANA MALAGASY',
    'ÉGLISE LUTHÉRIENNE MALAGACHE · MALAGASY LUTHERAN CHURCH',
    'SYNODAM-PARITANY FIHAVANANA LOTERANA',
    'SAMPAN’ASA LOTERANA MOMBA NY FAHASALAMANA (SALFA)',
    'DÉPARTEMENT DE SANTÉ · HEALTH DEPARTMENT',
    'HOPITALY LOTERANA TOJARY TANAMBAO · BP 99',
    'E-mail : salfa.tukas@gmail.com',
  ];
  return {
    mode: 'textes',
    image: '',
    lignes: lignesParDefaut(commun),
    logoGauche: '',
    logoDroit: '',
  };
}

export function entetesParDefaut(): EntetesDocuments {
  return { depense: enteteParDefaut('depense'), recette: enteteParDefaut('recette') };
}

const estImage = (valeur: unknown): valeur is string =>
  typeof valeur === 'string' && (valeur === '' || /^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(valeur));

/** Lecture tolérante : toute anomalie retombe sur l'en-tête livré, jamais sur une page cassée. */
export function normaliserEntete(valeur: unknown, document: DocumentEntete): EnteteDocument {
  const defaut = enteteParDefaut(document);
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return defaut;
  const brut = valeur as Record<string, unknown>;
  const mode = brut.mode === 'image' ? 'image' : 'textes';
  const lignes: LigneEntete[] = Array.isArray(brut.lignes)
    ? brut.lignes.slice(0, MAX_LIGNES_ENTETE).map((ligne, index) => {
      const item = ligne !== null && typeof ligne === 'object' ? ligne as Record<string, unknown> : {};
      const texte = typeof item.texte === 'string' ? item.texte.slice(0, 200) : (defaut.lignes[index]?.texte ?? '');
      const taille = typeof item.taille === 'number' && item.taille >= 6 && item.taille <= 40 ? Math.round(item.taille) : 9;
      return { texte, taille, gras: item.gras === true };
    })
    : defaut.lignes;
  return {
    mode,
    image: estImage(brut.image) ? brut.image : '',
    lignes: lignes.length ? lignes : defaut.lignes,
    logoGauche: estImage(brut.logoGauche) ? brut.logoGauche : '',
    logoDroit: estImage(brut.logoDroit) ? brut.logoDroit : '',
  };
}

export function normaliserEntetes(valeur: unknown): EntetesDocuments {
  const defaut = entetesParDefaut();
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return defaut;
  const brut = valeur as Record<string, unknown>;
  return {
    depense: normaliserEntete(brut.depense, 'depense'),
    recette: normaliserEntete(brut.recette, 'recette'),
  };
}

/** Vrai si deux jeux d'en-têtes sont identiques (aucune modification à enregistrer). */
export function entetesIdentiques(a: EntetesDocuments, b: EntetesDocuments): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Poids total des images, pour prévenir avant d'envoyer une sauvegarde trop lourde. */
export function poidsImages(entetes: EntetesDocuments): number {
  let total = 0;
  for (const entete of Object.values(entetes)) {
    total += entete.image.length + entete.logoGauche.length + entete.logoDroit.length;
  }
  return total;
}

/** Lit un fichier image local, en vérifiant type, poids et décodage. */
export async function lireImageEntete(fichier: File, limite = MAX_IMAGE_OCTETS): Promise<string> {
  if (!['image/png', 'image/jpeg'].includes(fichier.type)) {
    throw new Error('Choisissez une image PNG ou JPEG.');
  }
  if (fichier.size > limite) {
    throw new Error(`L’image ne doit pas dépasser ${Math.round(limite / 1024)} Ko. Compressez-la ou réduisez sa définition.`);
  }
  const data = await new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => typeof lecteur.result === 'string' ? resolve(lecteur.result) : reject(new Error('Image illisible.'));
    lecteur.onerror = () => reject(new Error('Image illisible.'));
    lecteur.readAsDataURL(fichier);
  });
  const image = await chargerImage(data);
  if (image.naturalWidth > 12000 || image.naturalHeight > 12000) throw new Error('Image trop grande (12000 px maximum).');
  return data;
}

function chargerImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image invalide ou illisible.'));
    image.src = source;
  });
}

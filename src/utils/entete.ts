// `?inline` : le logo est incorporé en data URL. Le livre enregistré garde ainsi
// une adresse stable, même après une mise à jour qui renomme les fichiers.
import logoGauche from '../assets/logo-salfa-gauche.png?inline';
import logoDroit from '../assets/logo-salfa-droit.png?inline';

/**
 * Modèle d'en-tête des documents SALFA.
 *
 * Un seul en-tête pour les deux imprimés : la demande d'engagement de dépense
 * et l'autorisation de recette portent le même papier à en-tête. Chaque ligne
 * se règle comme dans un traitement de texte (police, taille, gras, italique,
 * souligné, alignement) et les images se placent librement sur la feuille,
 * en millimètres, comme on glisserait un logo dans Word.
 */

export type DocumentEntete = 'depense' | 'recette';
export type Alignement = 'gauche' | 'centre' | 'droite';

/** Polices proposées : celles dont l'ordinateur de bureau dispose à coup sûr. */
export const POLICES: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'Arial', libelle: 'Arial' },
  { valeur: 'Times New Roman', libelle: 'Times New Roman' },
  { valeur: 'Courier New', libelle: 'Courier New' },
  { valeur: 'Georgia', libelle: 'Georgia' },
  { valeur: 'Verdana', libelle: 'Verdana' },
  { valeur: 'Trebuchet MS', libelle: 'Trebuchet MS' },
];

export interface LigneEntete {
  texte: string;
  /** Mise en valeur : gras du modèle. */
  gras: boolean;
  /** Taille en points, appliquée à l'écran comme à l'impression. */
  taille: number;
  police: string;
  italique: boolean;
  souligne: boolean;
  alignement: Alignement;
  /** Alignement d'origine du modèle, nommé ainsi dans la sauvegarde. */
  caps?: boolean;
}

/** Image placée librement : position du coin haut-gauche et largeur, en mm. */
export interface ImageEntete {
  id: string;
  /** Data URL PNG ou JPEG. */
  source: string;
  /** Bord gauche, depuis le bord gauche de la feuille. */
  x: number;
  /** Bord supérieur, depuis le haut de la feuille. */
  y: number;
  /** Largeur imprimée ; la hauteur suit les proportions de l'image. */
  largeur: number;
  alt: string;
}

export interface EnteteDocument {
  mode: 'image' | 'textes';
  /** Image complète utilisée quand mode === 'image' (data URL PNG ou JPEG). */
  image: string;
  lignes: LigneEntete[];
  images: ImageEntete[];
}

/** L'en-tête est commun : une seule valeur pour les deux documents. */
export type EntetesDocuments = EnteteDocument;

export const MAX_IMAGE_OCTETS = 1024 * 1024;
/** Les logos voyagent dans la sauvegarde : limite plus basse que l'image complète. */
export const MAX_LOGO_OCTETS = 300 * 1024;
export const MAX_LIGNES_ENTETE = 24;
/** Une feuille A4 tient largement vingt images d'en-tête. */
export const MAX_IMAGES_ENTETE = 20;

/** Repères proposés dans l'éditeur, dans l'ordre des lignes livrées. */
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
  // Le même intitulé que l'autorisation de recettes, suivi de son sigle.
  depense: 'DEMANDE D’ENGAGEMENT DE DÉPENSES (DED)',
  recette: 'AUTORISATION DE RECETTES',
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

/**
 * En-tête des imprimés officiels de l'hôpital, relevé sur les modèles fournis.
 * Les lignes 1, 4 et 6 sont en gras. La casse de chaque texte est conservée.
 */
const ENTETE_LIVRE = [
  'FIANGONANA LOTERANA MALAGASY',
  '(ÉGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)',
  'SYNODAM-PARITANY FIHERENANA TOLIARA',
  'SAMPAN’ASA LOTERANA MOMBA NY FAHASALAMANA (SALFA)',
  'DEPARTEMENT DE SANTE - HEALTH DEPARTMENT',
  'HOPITALY LOTERANA TOLIARY TANAMBAO - BP : 99',
  'E-mail: salfa.tulear@gmail.com',
];

/** Tailles du modèle, en points. */
const TAILLES_LIVREES = [11, 9, 9, 9.5, 9, 9.5, 8.5];

/**
 * Positions des deux logos sur la feuille A4, en millimètres, mesurées sur les
 * modèles : la croix SALFA à gauche, l'emblème du synode à droite.
 */
const IMAGES_LIVREES: Array<Omit<ImageEntete, 'source'>> = [
  { id: 'logo-gauche', x: 7.6, y: 13, largeur: 15, alt: 'Logo SALFA' },
  { id: 'logo-droit', x: 181, y: 13, largeur: 18, alt: 'Emblème du synode' },
];
const SOURCES_LIVREES: Record<string, string> = {
  'logo-gauche': logoGauche,
  'logo-droit': logoDroit,
};

function ligneLivree(texte: string, index: number): LigneEntete {
  return {
    texte,
    gras: index === 0 || index === 3 || index === 5,
    taille: TAILLES_LIVREES[index] ?? 9,
    police: 'Arial',
    italique: false,
    souligne: false,
    alignement: 'centre',
  };
}

/**
 * L'en-tête livré. `_document` est conservé pour que l'appelant n'ait pas à
 * savoir qu'il n'existe qu'un seul en-tête : les deux imprimés partagent le même.
 */
export function enteteParDefaut(_document?: DocumentEntete): EnteteDocument {
  return {
    mode: 'textes',
    image: '',
    lignes: ENTETE_LIVRE.map(ligneLivree),
    images: IMAGES_LIVREES.map(image => ({ ...image, source: SOURCES_LIVREES[image.id] ?? '' })),
  };
}

/** Un seul en-tête, commun aux deux documents. */
export function entetesParDefaut(): EntetesDocuments {
  return enteteParDefaut('depense');
}

const estImage = (valeur: unknown): valeur is string =>
  typeof valeur === 'string' && (valeur === '' || /^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(valeur));

const nombreBorne = (valeur: unknown, defaut: number, min: number, max: number): number =>
  typeof valeur === 'number' && Number.isFinite(valeur) ? Math.min(max, Math.max(min, valeur)) : defaut;

const estAlignement = (valeur: unknown): valeur is Alignement =>
  valeur === 'gauche' || valeur === 'centre' || valeur === 'droite';

function ligneNormalisee(valeur: unknown, index: number, defaut: EnteteDocument): LigneEntete | null {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return null;
  const item = valeur as Record<string, unknown>;
  const texte = typeof item.texte === 'string' ? item.texte.slice(0, 200) : (defaut.lignes[index]?.texte ?? '');
  // Demi-points conservés : les tailles du modèle (9,5 · 10,5) ne doivent pas dériver.
  // Hors bornes, la valeur est ramenée dans l'intervalle plutôt que perdue.
  const taille = typeof item.taille === 'number' && Number.isFinite(item.taille)
    ? Math.round(Math.min(40, Math.max(6, item.taille)) * 2) / 2
    : 9;
  const police = POLICES.some(p => p.valeur === item.police) ? String(item.police) : 'Arial';
  return {
    texte,
    taille,
    police,
    gras: item.gras === true,
    italique: item.italique === true,
    souligne: item.souligne === true,
    alignement: estAlignement(item.alignement) ? item.alignement : 'centre',
  };
}

function imageNormalisee(valeur: unknown, index: number): ImageEntete | null {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return null;
  const item = valeur as Record<string, unknown>;
  if (!estImage(item.source) || item.source === '') return null;
  const id = typeof item.id === 'string' && item.id !== '' ? item.id.slice(0, 60) : `image-${index + 1}`;
  return {
    id,
    source: item.source,
    // La feuille mesure 210 × 297 mm : une image ne peut pas en sortir complètement.
    x: Math.round(nombreBorne(item.x, 7.6, -20, 210) * 10) / 10,
    y: Math.round(nombreBorne(item.y, 13, -20, 297) * 10) / 10,
    largeur: Math.round(nombreBorne(item.largeur, 16, 3, 120) * 10) / 10,
    alt: typeof item.alt === 'string' ? item.alt.slice(0, 120) : 'Image de l’en-tête',
  };
}

/**
 * Lecture tolérante : toute anomalie retombe sur l'en-tête livré, jamais sur une
 * page cassée. Les livres enregistrés avec les deux anciens logos
 * (`logoGauche` / `logoDroit`) reprennent leurs images à la même place.
 */
export function normaliserEntete(valeur: unknown, document: DocumentEntete = 'depense'): EnteteDocument {
  const defaut = enteteParDefaut(document);
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return defaut;
  const brut = valeur as Record<string, unknown>;
  const mode = brut.mode === 'image' ? 'image' : 'textes';

  const lignes = Array.isArray(brut.lignes)
    ? brut.lignes.slice(0, MAX_LIGNES_ENTETE).map((ligne, i) => ligneNormalisee(ligne, i, defaut)).filter((l): l is LigneEntete => l !== null)
    : defaut.lignes;

  let images = Array.isArray(brut.images)
    ? brut.images.slice(0, MAX_IMAGES_ENTETE).map(imageNormalisee).filter((i): i is ImageEntete => i !== null)
    : [];

  // Reprise des livres antérieurs : les deux logos deviennent deux images placées.
  if (!Array.isArray(brut.images)) {
    const anciens: Array<[string, unknown]> = [['logo-gauche', brut.logoGauche], ['logo-droit', brut.logoDroit]];
    for (const [id, source] of anciens) {
      if (!estImage(source) || source === '') continue;
      const modele = IMAGES_LIVREES.find(i => i.id === id);
      images.push({ ...(modele ?? { x: 7.6, y: 13, largeur: 16, alt: 'Image de l’en-tête' }), id, source });
    }
  }

  return {
    mode,
    image: estImage(brut.image) ? brut.image : '',
    lignes: lignes.length ? lignes : defaut.lignes,
    images,
  };
}

/** Un seul en-tête : la valeur lue est celle des deux documents. */
/**
 * L'en-tête stocké est-il encore celui livré avec la caisse ? On compare les
 * identifiants des images posées : dès qu'elles diffèrent, l'en-tête a été
 * personnalisé et l'écran doit le savoir.
 */
export function enteteModifie(entete: EnteteDocument | null | undefined): boolean {
  const defaut = enteteParDefaut();
  // Un en-tête absent ou incomplet (livre reçu partiel, base fraîchement créée)
  // ne doit jamais interrompre l'affichage : il est simplement « non modifié ».
  const lignes = Array.isArray(entete?.lignes) ? entete.lignes : null;
  const images = Array.isArray(entete?.images) ? entete.images : null;
  if (!lignes || !images) return false;
  if (lignes.length !== defaut.lignes.length) return true;
  if (lignes.some((ligne, i) => ligne.texte !== defaut.lignes[i].texte)) return true;
  if (images.length !== defaut.images.length) return true;
  return images.some((image, i) => image.id !== defaut.images[i].id);
}

export function normaliserEntetes(valeur: unknown): EntetesDocuments {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return entetesParDefaut();
  const brut = valeur as Record<string, unknown>;
  // Format antérieur : un en-tête par document. Le document de la dépense fait foi.
  const source = 'depense' in brut || 'recette' in brut ? brut.depense : brut;
  return normaliserEntete(source, 'depense');
}

/** Vrai si deux jeux d'en-têtes sont identiques (aucune modification à enregistrer). */
export function entetesIdentiques(a: EntetesDocuments, b: EntetesDocuments): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Poids total des images, pour prévenir avant d'envoyer une sauvegarde trop lourde. */
export function poidsImages(entete: EntetesDocuments): number {
  return entete.image.length + entete.images.reduce((total, image) => total + image.source.length, 0);
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

/**
 * Montant écrit en toutes lettres, pour la mention « Arrêtée à la somme de… »
 * des bordereaux officiels. Orthographe traditionnelle : les traits d'union
 * relient les dizaines aux unités, les centaines restent séparées par une espace.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '', 'quatre-vingt', ''];

/** 0 à 99. */
function sousCent(n: number): string {
  if (n < 20) return UNITES[n];
  const dizaine = Math.floor(n / 10);
  const unite = n % 10;
  if (dizaine === 7) return unite === 1 ? 'soixante et onze' : `soixante-${UNITES[10 + unite]}`;
  if (dizaine === 9) return `quatre-vingt-${UNITES[10 + unite]}`;
  if (dizaine === 8) return unite === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITES[unite]}`;
  if (unite === 0) return DIZAINES[dizaine];
  if (unite === 1) return `${DIZAINES[dizaine]} et un`;
  return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
}

/** 0 à 999. */
function sousMille(n: number): string {
  const centaines = Math.floor(n / 100);
  const reste = n % 100;
  if (centaines === 0) return sousCent(n);
  if (centaines === 1) return reste === 0 ? 'cent' : `cent ${sousCent(reste)}`;
  return reste === 0 ? `${UNITES[centaines]} cents` : `${UNITES[centaines]} cent ${sousCent(reste)}`;
}

const GROUPES = [
  { valeur: 1_000_000_000, singulier: 'milliard', pluriel: 'milliards' },
  { valeur: 1_000_000, singulier: 'million', pluriel: 'millions' },
];

/**
 * Écrit un entier positif en toutes lettres.
 * `nombreEnLettres(2657400)` → « deux millions six cent cinquante-sept mille
 * quatre cents ».
 */
export function nombreEnLettres(valeur: number): string {
  if (!Number.isSafeInteger(valeur) || valeur < 0) throw new Error('Montant en lettres : entier positif attendu.');
  if (valeur === 0) return UNITES[0];

  const morceaux: string[] = [];
  let reste = valeur;

  for (const groupe of GROUPES) {
    const nombre = Math.floor(reste / groupe.valeur);
    if (nombre > 0) {
      const mot = nombre === 1 ? groupe.singulier : groupe.pluriel;
      morceaux.push(nombre === 1 ? `un ${mot}` : `${sousMille(nombre)} ${mot}`);
      reste %= groupe.valeur;
    }
  }

  const milliers = Math.floor(reste / 1000);
  if (milliers > 0) {
    // « mille » est invariable, ne prend pas « un », et fait tomber le « s » de
    // « quatre-vingts » : on écrit « quatre-vingt mille ».
    const mot = milliers === 1 ? '' : sousMille(milliers).replace(/quatre-vingts$/, 'quatre-vingt');
    morceaux.push(milliers === 1 ? 'mille' : `${mot} mille`);
    reste %= 1000;
  }

  if (reste > 0) morceaux.push(sousMille(reste));
  return morceaux.join(' ');
}

/** Phrase du bordereau : « Arrêtée à la somme de … ariary ». */
export function montantEnLettres(montant: number): string {
  return `Arrêtée à la somme de ${nombreEnLettres(montant)} ariary`;
}

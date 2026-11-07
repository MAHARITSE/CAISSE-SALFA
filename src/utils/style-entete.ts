import type { CSSProperties } from 'react';
import type { LigneEntete } from './entete';

const ALIGNEMENT_CSS = { gauche: 'left', centre: 'center', droite: 'right' } as const;

/** Même typographie dans l'éditeur et sur les deux bordereaux, sans modifier la casse. */
export function styleLigneEntete(ligne: LigneEntete): CSSProperties {
  return {
    fontFamily: `'${ligne.police}', sans-serif`,
    fontSize: `${ligne.taille}pt`,
    fontWeight: ligne.gras ? 700 : 400,
    fontStyle: ligne.italique ? 'italic' : 'normal',
    textDecoration: ligne.souligne ? 'underline' : 'none',
    textAlign: ALIGNEMENT_CSS[ligne.alignement],
    fontVariant: 'normal',
    textTransform: 'none',
    lineHeight: 1.3,
  };
}

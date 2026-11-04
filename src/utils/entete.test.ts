import { describe, expect, it } from 'vitest';
import {
  MAX_LIGNES_ENTETE, TITRE_DOCUMENT, enteteParDefaut, entetesIdentiques, entetesParDefaut,
  normaliserEntete, normaliserEntetes, numeroDocument, poidsImages, type EnteteDocument,
} from './entete';
import { enregistrerEntete } from './ledger';
import { livreTest } from '../test/fixtures';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const enteteFixe = (modifications: Partial<EnteteDocument> = {}): EnteteDocument => ({
  ...enteteParDefaut('depense'), ...modifications,
});

describe('en-tête des bordereaux', () => {
  it('livre un en-tête complet par défaut, distinct pour chaque document', () => {
    const entetes = entetesParDefaut();
    expect(entetes.depense.lignes[0].texte).toContain('SALFA');
    expect(entetes.depense.lignes.filter(l => l.texte.trim())).toHaveLength(7);
    expect(entetes.depense).toEqual(entetes.recette);
    expect(TITRE_DOCUMENT.depense).toBe('DEMANDE D’ENGAGEMENT DE DÉPENSE');
    expect(TITRE_DOCUMENT.recette).toBe('AUTORISATION DE RECETTE');
  });

  it('donne à chaque pièce son document : AED pour une dépense, ARC pour une recette', () => {
    expect(numeroDocument('DP-2026-0007')).toBe('AED-2026-0007');
    expect(numeroDocument('RC-2026-0042')).toBe('ARC-2026-0042');
    expect(numeroDocument('DP-2027-0001')).toBe('AED-2027-0001');
    // Une pièce hors format (ancienne numérotation) n'invente pas de document.
    expect(numeroDocument('PIECE-1')).toBeNull();
    expect(numeroDocument('')).toBeNull();
  });

  it('retombe sur l’en-tête livré quand la donnée est absente ou corrompue', () => {
    expect(normaliserEntete(undefined, 'recette')).toEqual(enteteParDefaut('recette'));
    expect(normaliserEntete('texte libre', 'depense')).toEqual(enteteParDefaut('depense'));
    expect(normaliserEntetes({ depense: { mode: 'image', image: 'javascript:alert(1)' } }).depense.image).toBe('');
    expect(normaliserEntetes({ depense: { image: 'https://exemple.mg/logo.png' } }).depense.mode).toBe('textes');
  });

  it('borne le nombre de lignes et la taille des textes', () => {
    const lignes = Array.from({ length: 20 }, (_, i) => ({ texte: `Ligne ${i}`, gras: i === 0, taille: 900 }));
    const resultat = normaliserEntete({ lignes }, 'depense');
    expect(resultat.lignes).toHaveLength(MAX_LIGNES_ENTETE);
    expect(resultat.lignes.every(l => l.taille === 9)).toBe(true);
    expect(normaliserEntete({ lignes: [{ texte: 'x'.repeat(500), gras: true, taille: 12 }] }, 'depense').lignes[0].texte).toHaveLength(200);
  });

  it('n’accepte que de vraies data URL PNG ou JPEG pour les images', () => {
    expect(normaliserEntete({ logoGauche: PNG }, 'depense').logoGauche).toBe(PNG);
    expect(normaliserEntete({ logoGauche: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'depense').logoGauche).toBe('');
    expect(normaliserEntete({ logoGauche: 'data:image/png;base64,<script>' }, 'depense').logoGauche).toBe('');
  });

  it('compare les jeux d’en-têtes et évalue le poids des images', () => {
    const a = entetesParDefaut();
    const b = entetesParDefaut();
    expect(entetesIdentiques(a, b)).toBe(true);
    b.recette = enteteFixe({ mode: 'image', image: PNG });
    expect(entetesIdentiques(a, b)).toBe(false);
    expect(poidsImages(b)).toBe(PNG.length);
  });

  it('enregistre un seul document sans toucher à l’autre', () => {
    const depart = livreTest();
    const personnalise = enteteFixe({ lignes: enteteParDefaut('depense').lignes.map((l, i) => i === 0 ? { ...l, texte: 'CAISSE CENTRALE' } : l) });
    const apres = enregistrerEntete(depart, 'depense', personnalise);
    expect(apres.entetes.depense.lignes[0].texte).toBe('CAISSE CENTRALE');
    expect(apres.entetes.recette).toEqual(depart.entetes.recette);
    expect(depart.entetes.depense.lignes[0].texte).not.toBe('CAISSE CENTRALE');
  });

  it('refuse un en-tête vide, dans les deux modes', () => {
    const vide = enteteFixe({ mode: 'textes', lignes: enteteParDefaut('depense').lignes.map(l => ({ ...l, texte: '' })) });
    expect(() => enregistrerEntete(livreTest(), 'depense', vide)).toThrow('au moins une ligne');
    expect(() => enregistrerEntete(livreTest(), 'recette', enteteFixe({ mode: 'image', image: '' }))).toThrow('image');
    expect(() => enregistrerEntete(livreTest(), 'recette', enteteFixe({ mode: 'image', image: PNG }))).not.toThrow();
  });
});

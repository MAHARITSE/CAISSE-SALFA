import { describe, expect, it } from 'vitest';
import {
  MAX_LIGNES_ENTETE, TITRE_DOCUMENT, enteteParDefaut, entetesIdentiques, entetesParDefaut,
  normaliserEntete, normaliserEntetes, numeroDocument, poidsImages, type EnteteDocument,
} from './entete';
import { enregistrerEntete } from './ledger';
import { livreTest } from '../test/fixtures';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const enteteFixe = (modifications: Partial<EnteteDocument> = {}): EnteteDocument => ({
  ...enteteParDefaut(), ...modifications,
});

describe('en-tête des bordereaux', () => {
  it('livre un seul en-tête complet, commun aux deux imprimés', () => {
    const entete = entetesParDefaut();
    expect(entete.lignes[0].texte).toBe('FIANGONANA LOTERANA MALAGASY');
    expect(entete.lignes.map(l => l.texte).join(' ')).toContain('SALFA');
    expect(entete.lignes.filter(l => l.texte.trim())).toHaveLength(7);
    // Les deux documents partagent le même papier à en-tête.
    expect(enteteParDefaut('recette')).toEqual(enteteParDefaut('depense'));
    // Les deux logos du modèle sont des images placées, en millimètres.
    expect(entete.images).toHaveLength(2);
    expect(entete.images.map(i => i.source)).toEqual([expect.stringContaining('data:image/png'), expect.stringContaining('data:image/png')]);
    expect(entete.images[0]).toMatchObject({ x: 7.6, largeur: 15 });
    expect(TITRE_DOCUMENT.depense).toBe('DEMANDE D’ENGAGEMENT DE DÉPENSES (DED)');
    expect(TITRE_DOCUMENT.recette).toBe('AUTORISATION DE RECETTES');
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
    expect(normaliserEntete(undefined)).toEqual(enteteParDefaut());
    expect(normaliserEntete('texte libre')).toEqual(enteteParDefaut());
    expect(normaliserEntetes({ mode: 'image', image: 'javascript:alert(1)' }).image).toBe('');
    expect(normaliserEntetes({ image: 'https://exemple.mg/logo.png' }).mode).toBe('textes');
  });

  it('reprend un livre antérieur : les deux logos deviennent deux images placées', () => {
    const ancien = { mode: 'textes', image: '', logoGauche: PNG, logoDroit: PNG, lignes: enteteParDefaut().lignes };
    const lu = normaliserEntete(ancien);
    expect(lu.images).toHaveLength(2);
    expect(lu.images[0]).toMatchObject({ id: 'logo-gauche', x: 7.6, y: 13, largeur: 15 });
    expect(lu.images[1]).toMatchObject({ id: 'logo-droit', x: 181, largeur: 18 });
    // Un livre à deux en-têtes garde celui de la dépense.
    const deux = normaliserEntetes({ depense: { lignes: [{ texte: 'DEPENSE' }] }, recette: { lignes: [{ texte: 'RECETTE' }] } });
    expect(deux.lignes[0].texte).toBe('DEPENSE');
  });

  it('borne le nombre de lignes, la taille et la position des images', () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ({ texte: `Ligne ${i}`, gras: i === 0, taille: 900 }));
    const resultat = normaliserEntete({ lignes });
    expect(resultat.lignes).toHaveLength(MAX_LIGNES_ENTETE);
    expect(resultat.lignes.every(l => l.taille === 40)).toBe(true);
    expect(normaliserEntete({ lignes: [{ texte: 'x'.repeat(500), gras: true, taille: 12 }] }).lignes[0].texte).toHaveLength(200);

    // Une image ne peut pas sortir complètement de la feuille A4.
    const image = normaliserEntete({ images: [{ source: PNG, x: 9999, y: -9999, largeur: 9999 }] }).images[0];
    expect(image.x).toBe(210);
    expect(image.y).toBe(-20);
    expect(image.largeur).toBe(120);
  });

  it('garde la mise en forme propre à chaque ligne', () => {
    const lu = normaliserEntete({ lignes: [{
      texte: 'TITRE', gras: true, taille: 12.5, police: 'Georgia',
      italique: true, souligne: true, alignement: 'droite',
    }] });
    expect(lu.lignes[0]).toEqual({
      texte: 'TITRE', gras: true, taille: 12.5, police: 'Georgia',
      italique: true, souligne: true, alignement: 'droite',
    });
    // Une police inconnue retombe sur Arial, un alignement inconnu sur le centre.
    const inconnu = normaliserEntete({ lignes: [{ texte: 'X', police: 'Comic Sans MS', alignement: 'justifie' }] }).lignes[0];
    expect(inconnu.police).toBe('Arial');
    expect(inconnu.alignement).toBe('centre');
  });

  it('n’accepte que de vraies data URL PNG ou JPEG pour les images', () => {
    expect(normaliserEntete({ images: [{ source: PNG }] }).images).toHaveLength(1);
    expect(normaliserEntete({ images: [{ source: 'data:image/svg+xml;base64,PHN2Zz4=' }] }).images).toHaveLength(0);
    expect(normaliserEntete({ images: [{ source: 'data:image/png;base64,<script>' }] }).images).toHaveLength(0);
    expect(normaliserEntete({ images: [{ source: 'https://exemple.mg/logo.png' }] }).images).toHaveLength(0);
  });

  it('compare les en-têtes et évalue le poids des images', () => {
    const a = entetesParDefaut();
    const b = entetesParDefaut();
    expect(entetesIdentiques(a, b)).toBe(true);
    const avecImage = { ...b, image: PNG };
    expect(entetesIdentiques(a, avecImage)).toBe(false);
    // Le poids compte l'image complète et toutes les images placées.
    expect(poidsImages(avecImage)).toBe(PNG.length + a.images.reduce((n, i) => n + i.source.length, 0));
  });

  it('enregistre l’en-tête commun et refuse un en-tête vide', () => {
    const depart = livreTest();
    const personnalise = enteteFixe({ lignes: enteteParDefaut().lignes.map((l, i) => i === 0 ? { ...l, texte: 'CAISSE CENTRALE' } : l) });
    const apres = enregistrerEntete(depart, 'depense', personnalise);
    expect(apres.entetes.lignes[0].texte).toBe('CAISSE CENTRALE');
    // Le même enregistrement vaut pour l'autre document : un seul en-tête.
    expect(apres.entetes).toEqual(normaliserEntetes(personnalise));
    expect(depart.entetes.lignes[0].texte).not.toBe('CAISSE CENTRALE');

    const vide = enteteFixe({ mode: 'textes', lignes: enteteParDefaut().lignes.map(l => ({ ...l, texte: '' })) });
    expect(() => enregistrerEntete(livreTest(), 'depense', vide)).toThrow('au moins une ligne');
    expect(() => enregistrerEntete(livreTest(), 'recette', enteteFixe({ mode: 'image', image: '' }))).toThrow('image');
    expect(() => enregistrerEntete(livreTest(), 'recette', enteteFixe({ mode: 'image', image: PNG }))).not.toThrow();
  });
});

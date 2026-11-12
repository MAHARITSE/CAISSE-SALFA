import { describe, expect, it, vi } from 'vitest';
import { genererPdfEcritures, ouvrirEtatPourImpression } from './export-pdf';
import { enteteParDefaut } from './entete';
import { ecritureTest } from '../test/fixtures';
import type { LigneJournal } from '../types';

const ligne = (over: Partial<LigneJournal> = {}): LigneJournal => ({ ...ecritureTest(), solde: 10000, ...over });

async function textePdf(buffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const contenu = await page.getTextContent();
    pages.push(contenu.items.map(item => 'str' in item ? item.str : '').join(' '));
  }
  return pages;
}

describe('export PDF des écritures', () => {
  it('exporte les deux groupes avec en-tête, catégories, détails et totaux non doublés', async () => {
    const entete = enteteParDefaut();
    entete.lignes[0].texte = 'Hôpital personnalisé';
    const pdf = genererPdfEcritures([
      ligne({ id: 'r', categorie: 'Consultations', libelle: 'Recette café', montant: 10000, lignesDetail: [{ id: 'd', libelle: 'Acte médical', montant: 10000 }] }),
      ligne({ id: 'r2', numero: 'RC-2026-0002', categorie: 'Médicaments', libelle: 'Pharmacie', montant: 2000 }),
      ligne({ id: 'd', numero: 'DP-2026-0001', sens: 'DEPENSE', categorie: 'Carburant', libelle: 'Ambulance', montant: 5000 }),
    ], entete, 'novembre 2026');
    expect(pdf.getNumberOfPages()).toBe(2);
    const pages = await textePdf(pdf.output('arraybuffer'));
    expect(pages[0]).toContain('Hôpital personnalisé');
    expect(pages[0]).toContain('ÉTAT DES RECETTES');
    expect(pages[0]).toContain('Consultations, Médicaments');
    expect(pages[0]).toContain('Acte médical');
    expect(pages[0]).toContain('12 000,00');
    expect(pages[0]).not.toContain('Ambulance');
    expect(pages[0]).not.toContain('Le Gestionnaire');
    expect(pages[1]).toContain('Hôpital personnalisé');
    expect(pages[1]).toContain('ÉTAT DES DÉPENSES');
    expect(pages[1]).toContain('Carburant');
    expect(pages[1]).toContain('Ambulance');
    expect(pages[1]).toContain('5 000,00');
    expect(pages[1]).toContain('Le Gestionnaire');
  });

  it('accepte un en-tête en image et conserve toutes les catégories quand leur liste dépasse une page', async () => {
    const entete = enteteParDefaut();
    entete.mode = 'image';
    entete.image = entete.images[0].source;
    const lignes = Array.from({ length: 120 }, (_, i) => ligne({ id: `${i}`, numero: `RC-${i}`, categorie: `Categorie_${String(i).padStart(3, '0')}_${'X'.repeat(45)}` }));
    const pdf = genererPdfEcritures(lignes, entete, '2026');
    const texte = (await textePdf(pdf.output('arraybuffer'))).join(' ');
    expect(texte).toContain('Categorie_000_');
    expect(texte).toContain('Categorie_119_');
    expect(texte).toContain('RC-119');
    expect(texte).toContain('1 200 000,00');
  });

  it('ouvre l’état à imprimer sans téléchargement puis libère le fichier à la fermeture', () => {
    vi.useFakeTimers();
    try {
      const creer = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:etat');
      const liberer = vi.spyOn(URL, 'revokeObjectURL');
      const remplacer = vi.fn();
      const fenetre = { location: { replace: remplacer }, closed: false };
      ouvrirEtatPourImpression([ligne()], enteteParDefaut(), '2026', fenetre as unknown as Window);
      expect(creer).toHaveBeenCalledOnce();
      expect(remplacer).toHaveBeenCalledWith('blob:etat');
      expect(liberer).not.toHaveBeenCalled();
      fenetre.closed = true;
      vi.advanceTimersByTime(30000);
      expect(liberer).toHaveBeenCalledWith('blob:etat');
    } finally { vi.useRealTimers(); }
  });

  it('pagine les sélections longues sans perdre les écritures et refuse une sélection vide', async () => {
    expect(() => genererPdfEcritures([], enteteParDefaut(), '2026')).toThrow('Aucune écriture');
    const lignes = Array.from({ length: 100 }, (_, i) => ligne({ id: `${i}`, numero: `RC-${i}`, libelle: `Pièce ${i}`, categorie: 'Recette' }));
    const pdf = genererPdfEcritures(lignes, enteteParDefaut(), '2026');
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    const pages = await textePdf(pdf.output('arraybuffer'));
    expect(pages.slice(0, -1).join(' ')).not.toContain('Le Gestionnaire');
    expect(pages[pages.length - 1]).toContain('Le Gestionnaire');
    const texte = pages.join(' ');
    expect(texte).toContain('Pièce 0');
    expect(texte).toContain('Pièce 99');
    expect(texte).toContain('1 000 000,00');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BordereauDocument, ModaleBordereau } from './Bordereau';
import { EnteteBordereauModal } from './EnteteBordereauModal';
import { enteteParDefaut } from '../utils/entete';
import type { LigneJournal } from '../types';

const ligne = (sens: 'RECETTE' | 'DEPENSE', over: Partial<LigneJournal> = {}): LigneJournal => ({
  id: 'e1', numero: sens === 'RECETTE' ? 'RC-2026-0012' : 'DP-2026-0003',
  date: '2026-11-03', sens, libelle: sens === 'RECETTE' ? 'RECETTE CAISSE LYDIA' : 'VERSEMENT ESPECE BNI C',
  categorie: 'Divers', montant: sens === 'RECETTE' ? 2_657_400 : 4_042_000, solde: 0,
  lignesDetail: [
    { id: 'd1', libelle: 'CONSULTATION', montant: 238_000 },
    { id: 'd2', libelle: 'ECHOGRAPHIE', montant: 255_000 },
  ],
  createdAt: '2026-11-03T08:00:00.000Z', ...over,
});

describe('bordereau imprimable conforme aux modèles', () => {
  it('affiche le titre, la date, l’objet et les cinq colonnes du modèle', () => {
    render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    expect(screen.getByRole('heading', { name: 'AUTORISATION DE RECETTES' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^DATE : 03\/11\/2026$/.test(el.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('Objet : RECETTE CAISSE LYDIA'))).toBeInTheDocument();
    expect(screen.getByText(/Pièce n°/)).toBeInTheDocument();
    const entetes = screen.getAllByRole('columnheader').map(c => c.textContent);
    expect(entetes).toEqual(['N°', 'Libellé', 'N° Compte', 'Montant', 'Observation']);
  });

  it('totalise, écrit la somme en lettres et signe à trois', () => {
    render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    expect(screen.getByText('TOTAL DES RECETTES')).toBeInTheDocument();
    // Montant du modèle : séparateur insécable et deux décimales.
    expect(screen.getByText('2 657 400,00')).toBeInTheDocument();
    // Chaque poste porte aussi son montant à deux décimales.
    expect(screen.getByText('238 000,00')).toBeInTheDocument();
    expect(screen.getByText('deux millions six cent cinquante-sept mille quatre cents Ariary').closest('p')).toHaveTextContent('Arrêté à la somme de deux millions six cent cinquante-sept mille quatre cents Ariary');
    for (const titre of ['Caissier(e)', 'Gestionnaire', 'Médecin Chef']) expect(screen.getByText(titre)).toBeInTheDocument();
    expect(screen.queryByText('Demandeur')).not.toBeInTheDocument();
  });

  it('ajoute « Demandeur » sur la dépense et son titre propre', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={enteteParDefaut('depense')} />);
    // La dépense porte son titre complet, sigle compris, comme la recette.
    expect(screen.getByRole('heading', { name: 'DEMANDE D’ENGAGEMENT DE DÉPENSES (DED)' })).toBeInTheDocument();
    expect(screen.getByText('TOTAL DES DEPENSES')).toBeInTheDocument();
    const montantLettres = screen.getByText('quatre millions quarante-deux mille Ariary');
    expect(montantLettres.tagName).toBe('STRONG');
    expect(montantLettres.closest('p')).toHaveTextContent('Arrêté à la somme de quatre millions quarante-deux mille Ariary');
    expect(screen.getByText('Arrêté à la somme de')).not.toHaveClass('bordereau-lettres__montant');
    for (const titre of ['Demandeur', 'Caissier(e)', 'Gestionnaire', 'Médecin Chef']) expect(screen.getByText(titre)).toBeInTheDocument();
    // Quatre signataires : quatre colonnes.
    expect(container.querySelectorAll('.bordereau-signatures > div')).toHaveLength(4);
  });

  it('récapitule une pièce sans postes et laisse un seul bloc vide', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE', { lignesDetail: undefined, montant: 50_000, reference: 'Q-1' })} entete={enteteParDefaut('depense')} />);
    const corps = container.querySelectorAll('tbody tr');
    // Une ligne remplie, puis le bloc vide du modèle : les lignes laissées
    // vides ne sont pas découpées, elles forment un seul cadre.
    expect(corps).toHaveLength(2);
    expect(within(corps[0] as HTMLElement).getByText('VERSEMENT ESPECE BNI C')).toBeInTheDocument();
    expect(within(corps[0] as HTMLElement).getByText('Q-1')).toBeInTheDocument();
    expect(container.querySelectorAll('.bordereau-ligne-vide')).toHaveLength(1);
    // Le bloc vide s'ajuste pour que le tableau garde toujours la même hauteur.
    const bloc = container.querySelector('.bordereau-ligne-vide') as HTMLElement;
    // Une ligne à 11,1 mm + 118,9 mm de vide : corps de tableau de 130 mm.
    expect(parseFloat(bloc.style.height)).toBeCloseTo(118.9);
  });

  it('réduit seulement le bloc vide quand le tableau contient beaucoup de postes', () => {
    const lignesDetail = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, libelle: `POSTE ${i + 1}`, montant: 1000 }));
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE', { lignesDetail, montant: 12000 })} entete={enteteParDefaut()} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(13);
    expect((container.querySelector('.bordereau-ligne-vide') as HTMLElement).style.height).toBe('0mm');
    expect(screen.getByText('POSTE 12')).toBeInTheDocument();
    expect(screen.getByText('Médecin Chef')).toBeInTheDocument();
  });

  it('reprend l’en-tête de l’hôpital et ses deux logos', () => {
    const { container } = render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    for (const texte of [
      'FIANGONANA LOTERANA MALAGASY',
      'SYNODAM-PARITANY FIHERENANA TOLIARA',
      'HOPITALY LOTERANA TOLIARY TANAMBAO - BP : 99',
      'E-mail: salfa.tulear@gmail.com',
    ]) expect(screen.getByText(texte)).toBeInTheDocument();
    // Les deux logos du modèle sont des images placées librement sur la feuille.
    const logos = container.querySelectorAll('.bordereau-entete__image-libre');
    expect(logos).toHaveLength(2);
    for (const logo of logos) expect(logo.getAttribute('src')).toBeTruthy();
    // Le premier est calé à gauche, le second à droite, comme sur les imprimés.
    expect((logos[0] as HTMLElement).style.left).toBe('7.6mm');
    expect((logos[1] as HTMLElement).style.left).toBe('181mm');
  });

  it('imprime chaque ligne avec sa police, sa taille et son alignement', () => {
    const entete = enteteParDefaut();
    entete.lignes[1] = { ...entete.lignes[1], police: 'Georgia', taille: 12.5, italique: true, souligne: true, alignement: 'droite' };
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={entete} />);
    const paragraphe = container.querySelectorAll('.bordereau-ligne-entete')[1] as HTMLElement;
    expect(paragraphe.style.fontFamily).toContain('Georgia');
    expect(paragraphe.style.fontSize).toBe('12.5pt');
    expect(paragraphe.style.fontStyle).toBe('italic');
    expect(paragraphe.style.textDecoration).toBe('underline');
    expect(paragraphe.style.textAlign).toBe('right');
  });

  it.each(['DEPENSE', 'RECETTE'] as const)('reproduit la casse et la typographie configurées dans l’éditeur sur l’aperçu et l’impression (%s)', sens => {
    const entete = enteteParDefaut();
    entete.lignes[6] = { ...entete.lignes[6], texte: 'E-mail : Contact.Salfa@example.org', police: 'Georgia', taille: 12.5, gras: true, italique: true, souligne: true, alignement: 'droite' };
    render(<>
      <EnteteBordereauModal entetes={entete} onEnregistrer={vi.fn()} onFermer={vi.fn()} />
      <ModaleBordereau ligne={ligne(sens)} entete={entete} onFermer={vi.fn()} />
    </>);
    const editeur = screen.getByLabelText(/^Ligne 7/);
    const sortie = document.querySelectorAll('.print-bordereau .bordereau-ligne-entete');
    expect(sortie).toHaveLength(entete.lignes.length);
    const element = sortie[6];
    expect(element).toHaveTextContent('E-mail : Contact.Salfa@example.org');
    for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textAlign', 'fontVariant', 'textTransform', 'lineHeight'] as const) {
      expect((element as HTMLElement).style[prop]).toBe((editeur as HTMLElement).style[prop]);
    }
    expect(element).toHaveStyle({ textTransform: 'none', fontVariant: 'normal', fontSize: '12.5pt', textAlign: 'right' });
  });

  it('préserve l’en-tête image complet sans transformation', () => {
    const entete = { ...enteteParDefaut(), mode: 'image' as const, image: 'data:image/png;base64,AAAA' };
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={entete} />);
    expect(screen.getByAltText('En-tête fourni')).toHaveAttribute('src', entete.image);
    expect(container.querySelector('.bordereau-entete__textes')).not.toBeInTheDocument();
  });

  it('impose le portrait seulement pendant l’impression du bordereau', () => {
    const { unmount } = render(<ModaleBordereau ligne={ligne('DEPENSE')} entete={enteteParDefaut()} onFermer={vi.fn()} />);
    expect(document.body).toHaveClass('has-print-bordereau');
    expect(document.querySelector('.print-bordereau style')?.textContent).toBe('@media print { @page { size: A4 portrait; margin: 0; } }');
    unmount();
    expect(document.body).not.toHaveClass('has-print-bordereau');
    expect(document.querySelector('.print-bordereau style')).toBeNull();
  });

  it('présente le document comme une feuille A4 portrait', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={enteteParDefaut('depense')} />);
    // Cotes portées par la feuille : A4 (210 × 297 mm), marges du modèle.
    const feuille = container.querySelector('.bordereau-document');
    expect(feuille).not.toBeNull();
    expect(feuille?.querySelector('.bordereau-apercu, .bordereau-document')).toBeFalsy();
    // Le tableau du modèle a exactement cinq colonnes, dans cet ordre.
    const premieres = [...container.querySelectorAll('tbody tr:first-child td')];
    expect(premieres).toHaveLength(5);
  });
});

describe('bénéficiaire enregistré', () => {
  it('affiche la casse enregistrée dans l’objet du bordereau', () => {
    render(<BordereauDocument ligne={ligne('DEPENSE', { tiers: 'Marovavy Lucia' })} entete={enteteParDefaut('depense')} />);
    expect(screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(' — Marovavy Lucia'))).toBeInTheDocument();
  });
});

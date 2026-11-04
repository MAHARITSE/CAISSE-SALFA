import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BordereauDocument } from './Bordereau';
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
    expect(screen.getByText('Arrêtez à la somme de deux millions six cent cinquante-sept mille quatre cents Ariary')).toBeInTheDocument();
    for (const titre of ['Caissier(e)', 'Gestionnaire', 'Médecin Chef']) expect(screen.getByText(titre)).toBeInTheDocument();
    expect(screen.queryByText('Demandeur')).not.toBeInTheDocument();
  });

  it('ajoute « Demandeur » sur la dépense et son titre propre', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={enteteParDefaut('depense')} />);
    expect(screen.getByRole('heading', { name: 'DEMANDE D’ENGAGEMENT DE DÉPENSE' })).toBeInTheDocument();
    expect(screen.getByText('TOTAL DES DEPENSES')).toBeInTheDocument();
    expect(screen.getByText(/Arrêtez à la somme de quatre millions quarante-deux mille Ariary/)).toBeInTheDocument();
    for (const titre of ['Demandeur', 'Caissier(e)', 'Gestionnaire', 'Médecin Chef']) expect(screen.getByText(titre)).toBeInTheDocument();
    // Quatre signataires : quatre colonnes.
    expect(container.querySelectorAll('.bordereau-signatures > div')).toHaveLength(4);
  });

  it('remplit le tableau à huit lignes et récapitule une pièce sans postes', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE', { lignesDetail: undefined, montant: 50_000, reference: 'Q-1' })} entete={enteteParDefaut('depense')} />);
    const corps = container.querySelectorAll('tbody tr');
    expect(corps).toHaveLength(8);
    expect(within(corps[0] as HTMLElement).getByText('VERSEMENT ESPECE BNI C')).toBeInTheDocument();
    expect(within(corps[0] as HTMLElement).getByText('Q-1')).toBeInTheDocument();
    expect(container.querySelectorAll('.bordereau-ligne-vide')).toHaveLength(7);
  });

  it('reprend l’en-tête de l’hôpital et ses deux logos', () => {
    const { container } = render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    for (const texte of [
      'FIANGONANA LOTERANA MALAGASY',
      'SYNODAM-PARITANY FIHERENANA TOLIARA',
      'HOPITALY LOTERANA TOLIARY TANAMBAO - BP : 99',
      'E-mail: salfa.tulear@gmail.com',
    ]) expect(screen.getByText(texte)).toBeInTheDocument();
    // Les deux logos du modèle encadrent l'en-tête.
    const logos = container.querySelectorAll('.bordereau-entete__logo img');
    expect(logos).toHaveLength(2);
    for (const logo of logos) expect(logo.getAttribute('src')).toBeTruthy();
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

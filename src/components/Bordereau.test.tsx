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
    expect(screen.getByRole('heading', { name: 'AUTORISATION DE RECETTE' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^DATE : 03\/11\/2026$/.test(el.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('Objet : RECETTE CAISSE LYDIA'))).toBeInTheDocument();
    expect(screen.getByText(/Pièce n°/)).toBeInTheDocument();
    const entetes = screen.getAllByRole('columnheader').map(c => c.textContent);
    expect(entetes).toEqual(['N°', 'Libellé', 'N° Compte', 'Montant', 'Observation']);
  });

  it('totalise, écrit la somme en lettres et signe à trois', () => {
    render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    expect(screen.getByText('Total des recettes')).toBeInTheDocument();
    expect(screen.getByText('2 657 400 Ar')).toBeInTheDocument();
    expect(screen.getByText(/Arrêtée à la somme de deux millions six cent cinquante-sept mille quatre cents ariary/)).toBeInTheDocument();
    for (const titre of ['Caissier(e)', 'Gestionnaire', 'Médecin Chef']) expect(screen.getByText(titre)).toBeInTheDocument();
    expect(screen.queryByText('Demandeur')).not.toBeInTheDocument();
  });

  it('ajoute « Demandeur » sur la dépense et son titre propre', () => {
    const { container } = render(<BordereauDocument ligne={ligne('DEPENSE')} entete={enteteParDefaut('depense')} />);
    expect(screen.getByRole('heading', { name: 'DEMANDE D’ENGAGEMENT DE DÉPENSE' })).toBeInTheDocument();
    expect(screen.getByText('Total des dépenses')).toBeInTheDocument();
    expect(screen.getByText(/quatre millions quarante-deux mille ariary/)).toBeInTheDocument();
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

  it('reprend l’en-tête de l’hôpital par défaut', () => {
    render(<BordereauDocument ligne={ligne('RECETTE')} entete={enteteParDefaut('recette')} />);
    expect(screen.getByText('FIANGONANA LOTERANA MALAGASY')).toBeInTheDocument();
    expect(screen.getByText('HOPITALY LOTERANA TOJARY TANAMBAO · BP 99')).toBeInTheDocument();
    expect(screen.getByText('E-mail : salfa.tukas@gmail.com')).toBeInTheDocument();
  });
});

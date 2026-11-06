import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Analyse } from './Analyse';
import type { Ecriture } from '../types';

const ecrituresTest: Ecriture[] = [
  {
    id: '101',
    numero: 'RC-2026-0001',
    date: '2026-05-10',
    sens: 'RECETTE',
    libelle: 'RECETTE DU JOURS',
    categorie: 'Recettes journalières',
    montant: 350_000,
    lignesDetail: [
      { id: 'd1', libelle: 'CONSULTATION', montant: 150_000 },
      { id: 'd2', libelle: 'VENTE MEDICAMENTS', montant: 200_000 },
    ],
    createdAt: '2026-05-10T08:00:00.000Z',
  },
  {
    id: '102',
    numero: 'DP-2026-0001',
    date: '2026-05-11',
    sens: 'DEPENSE',
    libelle: 'ACHAT MEDICAMENTS CDM',
    categorie: 'Achats médicaments',
    montant: 120_000,
    lignesDetail: [
      { id: 'd3', libelle: 'PARACETAMOL ET AMOXICILLINE', montant: 120_000 },
    ],
    createdAt: '2026-05-11T08:00:00.000Z',
  },
];

describe('Analyse approfondie et aperçu des pièces', () => {
  it('ouvre l’analyse approfondie des recettes au clic sur une catégorie et affiche la ventilation des sous-lignes', async () => {
    const user = userEvent.setup();
    render(<Analyse lignes={ecrituresTest} periode="mai 2026" />);

    // Clic sur la catégorie "Recettes journalières"
    await user.click(screen.getByText('Recettes journalières'));

    const modale = await screen.findByRole('dialog', { name: /Analyse approfondie des recettes/i });
    expect(modale).toBeInTheDocument();
    expect(within(modale).getByText(/Pharmacie & Médicaments/)).toBeInTheDocument();
    expect(within(modale).getByText(/Consultations médicales/)).toBeInTheDocument();
    expect(within(modale).getByText('RC-2026-0001')).toBeInTheDocument();

    // Déplier la pièce dans l'aperçu pour voir les sous-lignes (en plus du Top des postes)
    expect(within(modale).getAllByText('VENTE MEDICAMENTS')).toHaveLength(1);
    await user.click(within(modale).getByText('RECETTE DU JOURS'));
    expect(within(modale).getAllByText('VENTE MEDICAMENTS')).toHaveLength(2);
    expect(within(modale).getAllByText('CONSULTATION')).toHaveLength(2);
    const tableau = within(modale).getByRole('table');
    expect(tableau).toHaveTextContent('200 000,00');
    expect(tableau).not.toHaveTextContent(/\bAr\b/);
  });

  it('permet de basculer vers l’analyse approfondie des dépenses', async () => {
    const user = userEvent.setup();
    render(<Analyse lignes={ecrituresTest} periode="mai 2026" />);

    await user.click(screen.getByRole('button', { name: 'Analyse approfondie : Répartition des dépenses' }));
    const modale = await screen.findByRole('dialog', { name: /Analyse approfondie des dépenses/i });
    expect(within(modale).getByText('DP-2026-0001')).toBeInTheDocument();
    expect(within(modale).getByText('ACHAT MEDICAMENTS CDM')).toBeInTheDocument();
  });
});

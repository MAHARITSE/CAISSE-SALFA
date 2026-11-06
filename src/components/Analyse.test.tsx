import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
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

    await user.click(screen.getByRole('button', { name: 'Aperçu : Répartition des dépenses' }));
    const modale = await screen.findByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    expect(within(modale).getByText('DP-2026-0001')).toBeInTheDocument();
    expect(within(modale).getByText('ACHAT MEDICAMENTS CDM')).toBeInTheDocument();
  });
  it('corrige une catégorie depuis l’aperçu, actualise le filtre et conserve les détails', async () => {
    const user = userEvent.setup();
    const enregistrer = vi.fn(async (_id: string, _categorie: string) => true);
    function Page() {
      const [lignes, setLignes] = useState(ecrituresTest);
      return <Analyse lignes={lignes} periode="mai 2026" categoriesDepense={['Achats médicaments', 'Divers']} onModifierCategorieDepense={async (id, categorie) => {
        const reussi = await enregistrer(id, categorie);
        if (reussi) setLignes(avant => avant.map(e => e.id === id ? { ...e, categorie } : e));
        return reussi;
      }} />;
    }
    render(<Page />);
    await user.click(screen.getByText('Achats médicaments'));
    let dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    expect(within(dialogue).queryByText(/Principaux postes détaillés/)).not.toBeInTheDocument();
    await user.click(within(dialogue).getByText('ACHAT MEDICAMENTS CDM'));
    const tableau = within(dialogue).getByRole('table');
    expect(tableau).toHaveTextContent('PARACETAMOL ET AMOXICILLINE');
    expect(tableau).toHaveTextContent('120 000,00');
    expect(tableau).not.toHaveTextContent(/\bAr\b/);
    await user.selectOptions(within(dialogue).getByLabelText('Catégorie de DP-2026-0001'), 'Divers');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer la catégorie de DP-2026-0001' }));
    expect(enregistrer).toHaveBeenCalledWith('102', 'Divers');
    dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (0 pièce(s))' });
    expect(within(dialogue).getByRole('status')).toHaveTextContent('ne correspond plus');
    await user.click(within(dialogue).getByRole('button', { name: 'Toutes les catégories' }));
    dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    expect(within(dialogue).getByLabelText('Catégorie de DP-2026-0001')).toHaveValue('Divers');
  });

  it('compte les pièces affichées et recherche aussi dans les sous-lignes', async () => {
    const user = userEvent.setup();
    const autre = { ...ecrituresTest[1], id: '103', numero: 'DP-2026-0002', libelle: 'CARBURANT', categorie: 'Divers', montant: 90000,
      lignesDetail: [{ id: 'd4', libelle: 'GAZOLE', montant: 90000 }] };
    render(<Analyse lignes={[...ecrituresTest, autre]} periode="mai 2026" />);
    await user.click(screen.getByRole('button', { name: 'Aperçu : Répartition des dépenses' }));
    const dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (2 pièce(s))' });
    await user.type(within(dialogue).getByLabelText('Rechercher dans l’aperçu des dépenses'), 'gazole');
    expect(screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' })).toBe(dialogue);
    expect(within(dialogue).getByText('DP-2026-0002')).toBeInTheDocument();
    expect(within(dialogue).queryByText('DP-2026-0001')).not.toBeInTheDocument();
  });

  it('ne présente pas la correction en lecture seule et signale les échecs sans afficher un faux succès', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Analyse lignes={ecrituresTest} periode="mai 2026" raisonLectureSeule="Exercice clôturé : les catégories sont en lecture seule." />);
    await user.click(screen.getByRole('button', { name: 'Aperçu : Répartition des dépenses' }));
    let dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    expect(within(dialogue).getByText(/Exercice clôturé/)).toBeInTheDocument();
    expect(within(dialogue).queryByLabelText('Catégorie de DP-2026-0001')).not.toBeInTheDocument();
    unmount();
    render(<Analyse lignes={ecrituresTest} periode="mai 2026" categoriesDepense={['Achats médicaments', 'Divers']} onModifierCategorieDepense={async () => false} />);
    await user.click(screen.getByRole('button', { name: 'Aperçu : Répartition des dépenses' }));
    dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    await user.selectOptions(within(dialogue).getByLabelText('Catégorie de DP-2026-0001'), 'Divers');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer la catégorie de DP-2026-0001' }));
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('n’a pas été enregistrée');
    expect(within(dialogue).queryByRole('status')).not.toBeInTheDocument();
    expect(within(dialogue).getByRole('button', { name: 'Enregistrer la catégorie de DP-2026-0001' })).toBeEnabled();
  });

});

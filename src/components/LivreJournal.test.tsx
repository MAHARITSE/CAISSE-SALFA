import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LivreJournal } from './LivreJournal';
import { ecritureTest } from '../test/fixtures';

const lignes = Array.from({ length: 120 }, (_, index) => ({
  ...ecritureTest({ id: `ligne-${index}`, numero: `RC-2026-${String(index + 1).padStart(4, '0')}` }),
  solde: (index + 1) * 10000,
}));

const props = {
  lignes, soldeOuverture: 0, periode: '2026', recettes: 510000, depenses: 0,
  soldeFin: 510000, filtreActif: false, enEditionId: null,
  onEditer: vi.fn(), onSupprimer: vi.fn(), onReinitialiser: vi.fn(),
};

describe('pied du journal', () => {
  it('affiche toutes les écritures sans pagination et conserve les actions de chaque ligne', async () => {
    const user = userEvent.setup();
    const editer = vi.fn();
    render(<LivreJournal {...props} onEditer={editer} />);
    const footer = screen.getByLabelText('Pied du journal');
    expect(footer).toHaveTextContent('Le solde de clôture tient compte de toute la période');
    expect(screen.queryByRole('navigation', { name: 'Pagination du journal' })).not.toBeInTheDocument();
    const tableau = screen.getByRole('table', { name: /Écritures de la caisse/ });
    expect(within(tableau).getByText('RC-2026-0001')).toBeVisible();
    expect(within(tableau).getByText('RC-2026-0060')).toBeVisible();
    expect(within(tableau).getByText('RC-2026-0120')).toBeVisible();
    await user.click(within(tableau).getByRole('button', { name: 'Modifier RC-2026-0120' }));
    expect(editer).toHaveBeenCalledWith(expect.objectContaining({ id: 'ligne-119' }));
  });

  it('conserve les raccourcis de saisie proposés quand le journal est vide', async () => {
    const user = userEvent.setup();
    const ouvrir = vi.fn();
    render(<LivreJournal {...props} lignes={[]} onNouvelleEcriture={ouvrir} />);
    await user.click(screen.getByRole('button', { name: 'Saisir une recette' }));
    await user.click(screen.getByRole('button', { name: 'Saisir une dépense' }));
    expect(ouvrir.mock.calls).toEqual([['RECETTE'], ['DEPENSE']]);
  });

  it('ne montre pas les actions de saisie en lecture seule', () => {
    render(<LivreJournal {...props} peutModifier={false} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination du journal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bas du tableau/ })).not.toBeInTheDocument();
  });
});

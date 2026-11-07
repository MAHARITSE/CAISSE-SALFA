import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LivreJournal } from './LivreJournal';
import { ecritureTest } from '../test/fixtures';

const lignes = Array.from({ length: 51 }, (_, index) => ({
  ...ecritureTest({ id: `ligne-${index}`, numero: `RC-2026-${String(index + 1).padStart(4, '0')}` }),
  solde: (index + 1) * 10000,
}));

const props = {
  lignes, soldeOuverture: 0, periode: '2026', recettes: 510000, depenses: 0,
  soldeFin: 510000, filtreActif: false, enEditionId: null,
  onEditer: vi.fn(), onSupprimer: vi.fn(), onReinitialiser: vi.fn(),
};

describe('pied du journal', () => {
  it('conserve la note et la pagination sans actions de saisie au pied du tableau', async () => {
    const user = userEvent.setup();
    const ouvrir = vi.fn();
    render(<LivreJournal {...props} onNouvelleEcriture={ouvrir} />);
    const pagination = screen.getByRole('navigation', { name: 'Pagination du journal' });
    const footer = pagination.closest<HTMLElement>('[aria-label="Pied du journal"]')!;
    expect(footer).toHaveTextContent('Le solde de clôture tient compte de toute la période');
    expect(within(footer).queryByRole('button', { name: /Nouvelle recette|Nouvelle dépense/ })).not.toBeInTheDocument();
    await user.click(within(pagination).getByRole('button', { name: 'Page précédente' }));
    expect(pagination).toHaveTextContent('Page 1 sur 2');
    expect(ouvrir).not.toHaveBeenCalled();
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
    expect(screen.getByRole('navigation', { name: 'Pagination du journal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bas du tableau/ })).not.toBeInTheDocument();
  });
});

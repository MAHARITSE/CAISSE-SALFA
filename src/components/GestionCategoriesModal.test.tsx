import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GestionCategoriesModal } from './GestionCategoriesModal';

describe('casse des catégories', () => {
  it.each(['RECETTE', 'DEPENSE'] as const)('préserve la casse à l’ajout et au renommage (%s)', async sens => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn().mockResolvedValue(true);
    render(<GestionCategoriesModal
      categories={{ recette: ['Consultations'], depense: ['Carburant'] }}
      onEnregistrer={onEnregistrer}
      onFermer={vi.fn()}
    />);
    if (sens === 'DEPENSE') await user.click(screen.getByRole('tab', { name: /Dépenses/ }));

    const nouvelle = screen.getByLabelText('Nouvelle catégorie');
    await user.type(nouvelle, 'Imagerie médicale SALFA');
    expect(nouvelle).toHaveValue('Imagerie médicale SALFA');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByLabelText('Catégorie 2')).toHaveValue('Imagerie médicale SALFA');

    const existante = screen.getByLabelText('Catégorie 1');
    await user.clear(existante);
    await user.type(existante, 'entretien du Groupe');
    expect(existante).toHaveValue('entretien du Groupe');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledWith(sens, ['entretien du Groupe', 'Imagerie médicale SALFA']);
  });

  it('continue à refuser les doublons sans tenir compte de la casse', async () => {
    const user = userEvent.setup();
    render(<GestionCategoriesModal
      categories={{ recette: ['Consultations'], depense: ['Carburant'] }}
      onEnregistrer={vi.fn()}
      onFermer={vi.fn()}
    />);
    await user.type(screen.getByLabelText('Nouvelle catégorie'), 'consultations');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cette catégorie figure déjà dans la liste.');
    expect(screen.queryByLabelText('Catégorie 2')).not.toBeInTheDocument();
  });
});

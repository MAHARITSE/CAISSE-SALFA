import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GestionMasquesModal } from './GestionMasquesModal';

describe('suggestions dans les modèles de saisie', () => {
  it('préserve le texte natif pendant la correction, sans ajout pendant la composition', async () => {
    const user = userEvent.setup();
    const sauvegarder = vi.fn().mockResolvedValue(true);
    render(<GestionMasquesModal masques={[]} onSauvegarderMasques={sauvegarder} onFermer={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Nouveau modèle' }));
    await user.type(screen.getByLabelText('Nom du modèle *'), 'Recettes du jour');
    expect(screen.queryByLabelText('Libellé associé de l’écriture')).not.toBeInTheDocument();
    const poste = screen.getByLabelText('Libellé', { exact: true });
    fireEvent.compositionStart(poste);
    fireEvent.input(poste, { target: { value: 'consultation' }, inputType: 'insertCompositionText', isComposing: true });
    fireEvent.keyDown(poste, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(poste, { key: 'Enter' });
    fireEvent.submit(poste.closest('form')!);
    expect(sauvegarder).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Libellé du poste 1')).not.toBeInTheDocument();
    fireEvent.compositionEnd(poste, { data: 'consultation' });
    fireEvent.keyDown(poste, { key: 'Enter', keyCode: 229 });
    expect(screen.queryByLabelText('Libellé du poste 1')).not.toBeInTheDocument();
    fireEvent.keyDown(poste, { key: 'Enter' });
    const ajoute = screen.getByLabelText('Libellé du poste 1');
    expect(ajoute).toHaveValue('CONSULTATION');
    fireEvent.input(ajoute, { target: { value: 'consultation externe' }, inputType: 'insertReplacementText' });
    expect(ajoute).toHaveValue('consultation externe');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le modèle' }));
    expect(sauvegarder).toHaveBeenCalledOnce();
    expect(sauvegarder.mock.calls[0][0]).toMatchObject([{
      nom: 'Recettes du jour', libelle: 'RECETTES DU JOUR',
      lignes: [{ description: 'CONSULTATION EXTERNE' }],
    }]);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Sens } from '../types';
import { categoriesParDefaut } from '../utils/constants';
import { SaisieEcriture } from './SaisieEcriture';

function ouvrir(sens: Sens) {
  const onEnregistrer = vi.fn().mockResolvedValue(true);
  render(<SaisieEcriture
    ecritureEnEdition={null}
    sensInitial={sens}
    exercice={new Date().getFullYear()}
    numeroSuivant={() => `${sens === 'RECETTE' ? 'RC' : 'DP'}-${new Date().getFullYear()}-0001`}
    suggestionsTiers={['SERVICE TEST']}
    masques={[]}
    categories={categoriesParDefaut()}
    onOuvrirGestionCategories={vi.fn()}
    onOuvrirGestionMasques={vi.fn()}
    onEnregistrer={onEnregistrer}
    onFermer={vi.fn()}
  />);
  return { onEnregistrer, dialogue: screen.getByRole('dialog', { name: sens === 'RECETTE' ? 'Nouvelle recette' : 'Nouvelle dépense' }) };
}

describe('saisie des postes et du libellé', () => {
  it.each(['RECETTE', 'DEPENSE'] as const)('Entrée dans le montant ou le poste ajoute une ligne sans enregistrer la pièce (%s)', async sens => {
    const user = userEvent.setup();
    const { dialogue, onEnregistrer } = ouvrir(sens);
    await user.type(within(dialogue).getByLabelText(/Libellé de l’écriture/), 'Écriture test');
    await user.click(within(dialogue).getByRole('button', { name: 'Détail par postes' }));
    const poste = within(dialogue).getByLabelText('Poste', { exact: true });
    const montant = within(dialogue).getByLabelText('Montant (Ar)', { exact: true });
    await user.type(poste, 'consultation');
    await user.type(montant, '4000{Enter}');
    expect(onEnregistrer).not.toHaveBeenCalled();
    expect(within(dialogue).getByLabelText('Libellé du poste 1')).toHaveValue('CONSULTATION');
    expect(within(dialogue).getByLabelText('Montant du poste 1')).toHaveValue('4000');
    expect(poste).toHaveValue('');
    expect(montant).toHaveValue('');
    expect(poste).toHaveFocus();

    // Entrée dans l'autre champ utilise la même action, sans doubler la ligne.
    await user.type(poste, 'pharmacie');
    await user.type(montant, '6000');
    await user.click(poste);
    await user.keyboard('{Enter}');
    expect(within(dialogue).getByLabelText('Libellé du poste 2')).toHaveValue('PHARMACIE');
    expect(within(dialogue).queryByLabelText('Libellé du poste 3')).not.toBeInTheDocument();
    expect(onEnregistrer).not.toHaveBeenCalled();
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledOnce();
    expect(onEnregistrer.mock.calls[0][0]).toMatchObject({ sens, montant: 10000, lignesDetail: [
      { libelle: 'CONSULTATION', montant: 4000 }, { libelle: 'PHARMACIE', montant: 6000 },
    ] });
  });

  it('ne soumet pas la pièce si le poste à ajouter est incomplet et conserve la saisie en cours', async () => {
    const user = userEvent.setup();
    const { dialogue, onEnregistrer } = ouvrir('RECETTE');
    await user.type(within(dialogue).getByLabelText(/Libellé de l’écriture/), 'Test');
    await user.click(within(dialogue).getByRole('button', { name: 'Détail par postes' }));
    const poste = within(dialogue).getByLabelText('Poste', { exact: true });
    const montant = within(dialogue).getByLabelText('Montant (Ar)', { exact: true });
    await user.type(poste, 'premier');
    await user.type(montant, '1000{Enter}');
    await user.type(poste, 'second');
    await user.click(montant);
    await user.keyboard('{Enter}');
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('montant du poste');
    expect(onEnregistrer).not.toHaveBeenCalled();
    expect(poste).toHaveValue('SECOND');
    await user.type(montant, '2000');
    // Une saisie non ajoutée ne doit pas disparaître lors de l'enregistrement.
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('Ajoutez le poste en cours');
    expect(onEnregistrer).not.toHaveBeenCalled();
    expect(poste).toHaveValue('SECOND');
    expect(montant).toHaveValue('2\u202f000');
    await user.type(montant, '{Enter}');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledOnce();
    expect(onEnregistrer.mock.calls[0][0]).toMatchObject({ montant: 3000, lignesDetail: [{ libelle: 'PREMIER' }, { libelle: 'SECOND' }] });
  });

  it('permet aussi d’activer le bouton Ajouter au clavier sans dupliquer le poste', async () => {
    const user = userEvent.setup();
    const { dialogue, onEnregistrer } = ouvrir('RECETTE');
    await user.click(within(dialogue).getByRole('button', { name: 'Détail par postes' }));
    await user.type(within(dialogue).getByLabelText('Poste', { exact: true }), 'consultation');
    await user.type(within(dialogue).getByLabelText('Montant (Ar)', { exact: true }), '1000');
    const bouton = within(dialogue).getByRole('button', { name: 'Ajouter' });
    bouton.focus();
    await user.keyboard('{Enter}');
    expect(within(dialogue).getByLabelText('Libellé du poste 1')).toHaveValue('CONSULTATION');
    expect(within(dialogue).queryByLabelText('Libellé du poste 2')).not.toBeInTheDocument();
    expect(onEnregistrer).not.toHaveBeenCalled();
  });

  it('laisse le libellé libre sans liste déroulante et conserve les suggestions du tiers', async () => {
    const user = userEvent.setup();
    const { dialogue } = ouvrir('DEPENSE');
    const libelle = within(dialogue).getByRole('textbox', { name: /Libellé de l’écriture/ });
    expect(libelle).not.toHaveAttribute('list');
    expect(libelle).toHaveAttribute('autocomplete', 'off');
    await user.type(libelle, 'frais de mission');
    expect(libelle).toHaveValue('FRAIS DE MISSION');
    expect(within(dialogue).getByLabelText('Bénéficiaire / fournisseur')).toHaveAttribute('list');
    expect(within(dialogue).getByRole('combobox', { name: 'Catégorie *' })).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaisieEcriture } from './SaisieEcriture';
import type { Categories, MasqueSaisie } from '../types';

const categoriesTest: Categories = {
  recette: ['Consultation', 'Pharmacie'],
  depense: ['Carburant', 'Fournitures'],
};

const masquesTest: MasqueSaisie[] = [
  {
    id: 'modele-hopital',
    nom: 'Recettes hôpital',
    sens: 'RECETTE',
    description: 'Postes médicaux standards',
    libelle: 'ANCIEN LIBELLÉ DIFFÉRENT',
    lignes: [
      { description: 'Consultation', montantDefaut: 5000 },
      { description: 'PHARMACIE', montantDefaut: 12000 },
    ],
  },
  {
    id: 'modele-sans-libelle',
    nom: 'Recettes simples',
    sens: 'RECETTE',
    lignes: [
      { description: 'DIVERS' },
    ],
  },
];

describe('SaisieEcriture avec modèle et libellé associé', () => {
  it('affiche le sélecteur de modèle en haut du formulaire', () => {
    render(
      <SaisieEcriture
        ecritureEnEdition={null}
        sensInitial="RECETTE"
        exercice={2026}
        numeroSuivant={() => 'RC-2026-0001'}
        suggestionsTiers={[]}
        masques={masquesTest}
        categories={categoriesTest}
        onOuvrirGestionCategories={vi.fn()}
        onOuvrirGestionMasques={vi.fn()}
        onEnregistrer={vi.fn()}
        onFermer={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: /choisir un modèle de saisie/i })).toBeInTheDocument();
  });

  it('applique le nom du modèle comme libellé et place le curseur à la fin du champ', async () => {
    const user = userEvent.setup();
    render(
      <SaisieEcriture
        ecritureEnEdition={null}
        sensInitial="RECETTE"
        exercice={2026}
        numeroSuivant={() => 'RC-2026-0001'}
        suggestionsTiers={[]}
        masques={masquesTest}
        categories={categoriesTest}
        onOuvrirGestionCategories={vi.fn()}
        onOuvrirGestionMasques={vi.fn()}
        onEnregistrer={vi.fn()}
        onFermer={vi.fn()}
      />
    );

    const selectHaut = screen.getByRole('combobox', { name: /choisir un modèle de saisie/i });
    const champLibelle = screen.getByLabelText(/Libellé de l’écriture/i) as HTMLInputElement;

    // Sélection du modèle avec libellé associé
    await user.selectOptions(selectHaut, 'modele-hopital');

    // Le libellé associé est prérempli
    expect(champLibelle.value).toBe('RECETTES HÔPITAL');

    // Vérifie que le focus et le curseur sont placés à la fin du champ
    await waitFor(() => {
      expect(document.activeElement).toBe(champLibelle);
      expect(champLibelle.selectionStart).toBe('RECETTES HÔPITAL'.length);
      expect(champLibelle.selectionEnd).toBe('RECETTES HÔPITAL'.length);
    });

    // L'utilisateur peut immédiatement continuer sa saisie à la fin du champ
    await user.type(champLibelle, ' - MATIN');
    expect(champLibelle.value).toBe('RECETTES HÔPITAL - MATIN');

    // Les anciens modèles mixtes sont aussi convertis dans les champs de saisie.
    expect(screen.getByLabelText('Libellé du poste 1')).toHaveValue('CONSULTATION');
    // Les postes du modèle sont également appliqués
    expect(screen.getByLabelText('Montant du poste 1')).toHaveValue('5000');
    expect(screen.getByLabelText('Montant du poste 2')).toHaveValue('12000');
  });

  it('utilise le nom du modèle si aucun libellé spécifique n’est rattaché et que le libellé était vide', async () => {
    const user = userEvent.setup();
    render(
      <SaisieEcriture
        ecritureEnEdition={null}
        sensInitial="RECETTE"
        exercice={2026}
        numeroSuivant={() => 'RC-2026-0001'}
        suggestionsTiers={[]}
        masques={masquesTest}
        categories={categoriesTest}
        onOuvrirGestionCategories={vi.fn()}
        onOuvrirGestionMasques={vi.fn()}
        onEnregistrer={vi.fn()}
        onFermer={vi.fn()}
      />
    );

    const selectHaut = screen.getByRole('combobox', { name: /choisir un modèle de saisie/i });
    const champLibelle = screen.getByLabelText(/Libellé de l’écriture/i) as HTMLInputElement;

    await user.selectOptions(selectHaut, 'modele-sans-libelle');

    expect(champLibelle.value).toBe('RECETTES SIMPLES');
    await waitFor(() => {
      expect(champLibelle.selectionStart).toBe('RECETTES SIMPLES'.length);
    });
  });

  it('exclut les boutons supprimer de la navigation par tabulation (tabIndex = -1)', async () => {
    const user = userEvent.setup();
    render(
      <SaisieEcriture
        ecritureEnEdition={null}
        sensInitial="RECETTE"
        exercice={2026}
        numeroSuivant={() => 'RC-2026-0001'}
        suggestionsTiers={[]}
        masques={masquesTest}
        categories={categoriesTest}
        onOuvrirGestionCategories={vi.fn()}
        onOuvrirGestionMasques={vi.fn()}
        onEnregistrer={vi.fn()}
        onFermer={vi.fn()}
      />
    );

    const selectHaut = screen.getByRole('combobox', { name: /choisir un modèle de saisie/i });
    const champLibelle = screen.getByLabelText(/Libellé de l’écriture/i);
    await user.selectOptions(selectHaut, 'modele-hopital');

    // Attendre que le focus automatique initial sur le libellé soit stabilisé
    await waitFor(() => {
      expect(document.activeElement).toBe(champLibelle);
    });

    const boutonSuppr1 = screen.getByRole('button', { name: 'Supprimer le poste 1' });
    const boutonSuppr2 = screen.getByRole('button', { name: 'Supprimer le poste 2' });

    // Les boutons de suppression ne doivent pas être accessibles en tabulation
    expect(boutonSuppr1).toHaveAttribute('tabindex', '-1');
    expect(boutonSuppr2).toHaveAttribute('tabindex', '-1');

    // Navigation par tabulation depuis le montant du poste 1 vers le poste suivant
    const montantPoste1 = screen.getByLabelText('Montant du poste 1');
    const libellePoste2 = screen.getByLabelText('Libellé du poste 2');

    montantPoste1.focus();
    expect(document.activeElement).toBe(montantPoste1);

    await user.tab();

    // La tabulation saute le bouton supprimer (tabindex="-1") et arrive directement au libellé du poste 2
    expect(document.activeElement).toBe(libellePoste2);
  });
});


it('demande confirmation avant de remplacer un libellé déjà saisi', async () => {
  const user = userEvent.setup();
  render(<SaisieEcriture ecritureEnEdition={null} sensInitial="RECETTE" exercice={2026} numeroSuivant={() => 'RC-2026-0001'} suggestionsTiers={[]} masques={masquesTest} categories={categoriesTest} onOuvrirGestionCategories={vi.fn()} onOuvrirGestionMasques={vi.fn()} onEnregistrer={vi.fn()} onFermer={vi.fn()} />);
  const champ = screen.getByLabelText(/Libellé de l’écriture/i);
  await user.type(champ, 'Autre libellé');
  await user.selectOptions(screen.getByRole('combobox', { name: /choisir un modèle de saisie/i }), 'modele-hopital');
  expect(screen.getByRole('dialog', { name: 'Appliquer ce modèle ?' })).toBeInTheDocument();
  expect(champ).toHaveValue('Autre libellé');
  await user.click(screen.getByRole('button', { name: 'Appliquer le modèle' }));
  expect(champ).toHaveValue('RECETTES HÔPITAL');
});

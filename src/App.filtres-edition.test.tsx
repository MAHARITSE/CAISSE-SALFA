import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ecritureTest, livreTest, parametresTest } from './test/fixtures';
import { enregistrerEcriture } from './utils/ledger';
import { sauvegarderLivre, CLE_LIVRE } from './utils/storage';

async function ouvrirJournal() {
  const annee = new Date().getFullYear();
  let livre = enregistrerEcriture(livreTest({ parametres: parametresTest({ exercice: annee }) }), ecritureTest({ id: 'janvier', numero: `RC-${annee}-0001`, date: `${annee}-01-15`, libelle: 'RECETTE JANVIER' }));
  livre = enregistrerEcriture(livre, ecritureTest({ id: 'fevrier', numero: `RC-${annee}-0002`, date: `${annee}-02-15`, libelle: 'RECETTE FEVRIER' }));
  sauvegarderLivre(livreTest(livre), 0);
  const user = userEvent.setup();
  const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à la caisse/ });
  await user.type(screen.getByLabelText('Identifiant'), 'admin');
  await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  await screen.findByRole('heading', { name: 'Livre de caisse' });
  return { annee, user, imprimer };
}

async function filtrer(user: ReturnType<typeof userEvent.setup>, annee: number) {
  fireEvent.change(screen.getByLabelText('Mois affiché'), { target: { value: `${annee}-01` } });
  await user.click(screen.getByRole('button', { name: 'Recettes' }));
  await user.selectOptions(screen.getByLabelText('Filtrer par catégorie'), 'Recettes journalières');
  await user.type(screen.getByLabelText('Rechercher dans le journal'), 'JANVIER');
}

function verifierFiltres(annee: number) {
  expect(screen.getByLabelText('Mois affiché')).toHaveValue(`${annee}-01`);
  expect(screen.getByRole('button', { name: 'Tout afficher' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: 'Recettes' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Filtrer par catégorie')).toHaveValue('Recettes journalières');
  expect(screen.getByLabelText('Rechercher dans le journal')).toHaveValue('JANVIER');
}

describe('filtres du journal après modification', () => {
  it('conserve tous les filtres et affiche la modification si elle correspond encore', async () => {
    const { annee, user, imprimer } = await ouvrirJournal();
    await filtrer(user, annee);
    await user.click(screen.getByRole('button', { name: `Modifier RC-${annee}-0001` }));
    const edition = screen.getByRole('dialog', { name: `Modifier RC-${annee}-0001` });
    await user.clear(within(edition).getByLabelText(/Montant total/));
    await user.type(within(edition).getByLabelText(/Montant total/), '20000');
    await user.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledOnce());
    fireEvent(window, new Event('afterprint'));
    verifierFiltres(annee);
    const journal = screen.getByRole('table', { name: /Écritures de la caisse/ });
    expect(within(journal).getByText('RECETTE JANVIER')).toBeVisible();
    expect(journal).toHaveTextContent('20 000,00');
    expect(within(journal).queryByText('RECETTE FEVRIER')).not.toBeInTheDocument();
  });

  it('garde la période et les filtres si la modification ne correspond plus à la sélection', async () => {
    const { annee, user, imprimer } = await ouvrirJournal();
    await filtrer(user, annee);
    await user.click(screen.getByRole('button', { name: `Modifier RC-${annee}-0001` }));
    const edition = screen.getByRole('dialog', { name: `Modifier RC-${annee}-0001` });
    fireEvent.change(within(edition).getByLabelText(/Date de l’opération/), { target: { value: `${annee}-02-15` } });
    await user.clear(within(edition).getByLabelText(/Libellé de l’écriture/));
    await user.type(within(edition).getByLabelText(/Libellé de l’écriture/), 'Autre libellé');
    await user.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledOnce());
    fireEvent(window, new Event('afterprint'));
    verifierFiltres(annee);
    expect(screen.getByText('Aucune écriture ne correspond aux filtres')).toBeVisible();
    const sauvegarde = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
    expect(sauvegarde.ecritures.find((e: { id: string }) => e.id === 'janvier')).toMatchObject({ date: `${annee}-02-15`, libelle: 'AUTRE LIBELLÉ' });
    await user.click(screen.getAllByRole('button', { name: 'Réinitialiser les filtres' })[0]);
    expect(screen.getByLabelText('Rechercher dans le journal')).toHaveValue('');
  });
});

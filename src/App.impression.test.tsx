import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CLE_LIVRE } from './utils/storage';

describe('enregistrement et impression directe', () => {
  it.each(['recette', 'dépense'] as const)('imprime une %s sans écran d’aperçu et permet de réimprimer', async sens => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
    await user.type(screen.getByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    await user.click(await screen.findByRole('button', { name: `Nouvelle ${sens}` }));
    const saisie = screen.getByRole('dialog', { name: `Nouvelle ${sens}` });
    await user.type(within(saisie).getByLabelText(/Libellé de l’écriture/), 'Test impression');
    await user.type(within(saisie).getByLabelText(/Montant total/), '5000');
    await user.click(within(saisie).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Bordereau imprimable' })).not.toBeInTheDocument();
    expect(document.querySelector('.print-bordereau')).toHaveTextContent('TEST IMPRESSION');
    expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).ecritures).toHaveLength(1);
    fireEvent(window, new Event('afterprint'));
    expect(document.body).not.toHaveClass('has-print-bordereau');
    expect(document.querySelector('.print-bordereau')).toBeNull();
    const numero = JSON.parse(localStorage.getItem(CLE_LIVRE)!).ecritures[0].numero as string;
    await user.click(screen.getByRole('button', { name: `Modifier ${numero}` }));
    const edition = screen.getByRole('dialog', { name: `Modifier ${numero}` });
    await user.clear(within(edition).getByLabelText(/Montant total/));
    await user.type(within(edition).getByLabelText(/Montant total/), '8000');
    await user.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(2));
    expect(document.querySelector('.print-bordereau')).toHaveTextContent('8 000,00');
    fireEvent(window, new Event('afterprint'));
    await user.click(screen.getByRole('button', { name: `Imprimer le bordereau ${numero}` }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(3));
    expect(document.querySelector('.print-bordereau')).toHaveTextContent('8 000,00');
    fireEvent(window, new Event('afterprint'));
  });
});


describe('ordre de virement : réimpression depuis le registre', () => {
  it('réimprime une DED par virement sans repasser par le formulaire', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
    await user.type(screen.getByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    // Le compte et son RIB se règlent dans Administration, hors du livre des virements.
    await user.click(screen.getByRole('button', { name: 'Administration' }));
    const section = screen.getByRole('region', { name: 'Comptes bancaires et RIB' });
    await user.click(within(section).getByRole('button', { name: 'Ajouter un compte' }));
    const compte = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
    await user.type(within(compte).getByLabelText('Banque'), 'BNI/C');
    await user.type(within(compte).getByLabelText('Numéro de compte / RIB'), '00005 111');
    await user.click(within(compte).getByRole('button', { name: 'Ajouter le compte' }));
    await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
    await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
    const saisie = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
    await user.type(within(saisie).getByLabelText('Libellé'), 'OXYGENE');
    await user.type(within(saisie).getByLabelText('Tiers / bénéficiaire'), 'OXYGENE MADA');
    await user.type(within(saisie).getByLabelText('Montant (Ar)'), '7000');
    await user.click(within(saisie).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    fireEvent(window, new Event('afterprint'));
    // La feuille disparaît ; le registre reste maître, l'ordre est réimprimable.
    expect(document.querySelector('.print-ordre-virement')).toBeNull();
    const numero = JSON.parse(localStorage.getItem(CLE_LIVRE)!).virements.ecritures[0].numero as string;
    await user.click(screen.getByRole('button', { name: `Imprimer l’ordre de virement ${numero}` }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(2));
    expect(document.querySelector('.print-ordre-virement')).toHaveTextContent('OXYGENE MADA');
    expect(document.querySelector('.print-ordre-virement')).toHaveTextContent(numero);
  });
});

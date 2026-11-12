import { it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CLE_LIVRE } from './utils/storage';

it('le comptable saisit un virement sans modifier les espèces', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à la caisse/ });
  await user.type(screen.getByLabelText('Identifiant'), 'comptable');
  await user.type(screen.getByLabelText('Mot de passe'), 'compta1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  await screen.findByRole('heading', { name: 'Livre de caisse' });
  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
  await user.click(screen.getByRole('button', { name: /Ajouter un compte bancaire/ }));
  let dialog = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
  await user.type(within(dialog).getByLabelText('Banque'), 'BNI');
  await user.type(within(dialog).getByLabelText('Numéro de compte'), '00123');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte' }));
  await user.click(screen.getByRole('button', { name: /Nouvelle recette par virement/ }));
  dialog = screen.getByRole('dialog', { name: 'Nouvelle recette par virement' });
  await user.type(within(dialog).getByLabelText('Libellé'), 'Virement reçu');
  await user.type(within(dialog).getByLabelText('Montant (Ar)'), '1000');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
  const livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.ecritures).toHaveLength(0);
  expect(livre.virements.ecritures[0]).toMatchObject({ numero: `VR-${new Date().getFullYear()}-0001`, montant: 1000, libelle: 'Virement reçu' });
  await user.click(screen.getByRole('button', { name: /Modifier VR-/ }));
  dialog = screen.getByRole('dialog', { name: /Modifier VR-/ });
  await user.clear(within(dialog).getByLabelText('Libellé'));
  await user.type(within(dialog).getByLabelText('Libellé'), 'Virement corrigé');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
  expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).virements.ecritures[0].libelle).toBe('Virement corrigé');
});


it('prépare BNI/C et BNI/D séparément et complète le numéro plus tard', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à la caisse/ });
  await user.type(screen.getByLabelText('Identifiant'), 'comptable');
  await user.type(screen.getByLabelText('Mot de passe'), 'compta1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  await screen.findByRole('heading', { name: 'Livre de caisse' });
  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
  await user.click(screen.getByRole('button', { name: 'Préparer BNI/C et BNI/D' }));
  let livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.comptes.map((c: { banque: string }) => c.banque)).toEqual(['BNI/C', 'BNI/D']);
  expect(livre.virements.comptes.map((c: { numeroCompte: string }) => c.numeroCompte)).toEqual(['', '']);
  expect(screen.queryByRole('button', { name: 'Préparer BNI/C et BNI/D' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Nouvelle recette par virement' }));
  let dialog = screen.getByRole('dialog', { name: 'Nouvelle recette par virement' });
  await user.selectOptions(within(dialog).getByLabelText('Compte bancaire'), livre.virements.comptes[0].id);
  await user.type(within(dialog).getByLabelText('Libellé'), 'Recette sous-compte');
  await user.type(within(dialog).getByLabelText('Montant (Ar)'), '1000');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
  await user.click(screen.getByRole('button', { name: 'Modifier le compte BNI/C' }));
  dialog = screen.getByRole('dialog', { name: 'Modifier un compte bancaire' });
  await user.type(within(dialog).getByLabelText('Numéro de compte'), 'TEST-123');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte' }));
  livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.comptes[0].numeroCompte).toBe('TEST-123');
  expect(livre.virements.ecritures[0].compteId).toBe(livre.virements.comptes[0].id);
  expect(livre.virements.comptes[1].numeroCompte).toBe('');
  expect(livre.ecritures).toEqual([]);
});


it('imprime l’ordre de virement sur demi-A4 après toute autorisation de dépense par virement', async () => {
  const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à la caisse/ });
  await user.type(screen.getByLabelText('Identifiant'), 'comptable');
  await user.type(screen.getByLabelText('Mot de passe'), 'compta1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  await screen.findByRole('heading', { name: 'Livre de caisse' });
  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));

  // Compte bancaire de l'hôpital : titulaire, adresse et code banque du RIB.
  await user.click(screen.getByRole('button', { name: /Ajouter un compte bancaire/ }));
  let dialogue = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
  await user.type(within(dialogue).getByLabelText('Banque'), 'BNI/C');
  await user.type(within(dialogue).getByLabelText('Numéro de compte'), '00005 12345678901');
  await user.type(within(dialogue).getByLabelText(/Titulaire du compte/), 'SALFA TOLIARA');
  await user.type(within(dialogue).getByLabelText(/Adresse du titulaire/), 'BP 99 Toliara');
  await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer le compte' }));

  await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
  dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
  await user.type(within(dialogue).getByLabelText('Libellé'), 'OXYGENE');
  await user.type(within(dialogue).getByLabelText('Tiers / bénéficiaire'), 'OXYGENE MADA');
  await user.type(within(dialogue).getByLabelText(/Établissement bancaire du bénéficiaire/), 'BOA');
  await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '5000');
  await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));

  // L'impression part seule : rien à cliquer dans le registre.
  await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
  const feuille = document.querySelector('.print-ordre-virement')!;
  expect(feuille).toHaveTextContent('ORDRE DE VIREMENT');
  expect(feuille).toHaveTextContent('EXEMPLAIRE BANQUE');
  expect(feuille).toHaveTextContent('SOUCHE — à conserver');
  expect(feuille).toHaveTextContent('OXYGENE MADA');
  expect(feuille).toHaveTextContent('BOA');
  // Le donneur d'ordre et le RIB viennent du compte bancaire enregistré.
  expect(feuille).toHaveTextContent('SALFA TOLIARA');
  expect(feuille).toHaveTextContent('00005 12345678901');
  expect(feuille).toHaveTextContent('5 000,00');
  expect(feuille).toHaveTextContent('cinq mille Ariary');
  expect(feuille).toHaveTextContent(/Pièce VD-\d{4}-0001/);
  fireEvent(window, new Event('afterprint'));
  expect(document.querySelector('.print-ordre-virement')).toBeNull();
  expect(document.body).not.toHaveClass('has-print-ordre-virement');

  // Le virement est enregistré tel quel : aucune écriture de caisse en espèces.
  const livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.ecritures).toEqual([]);
  expect(livre.virements.ecritures[0]).toMatchObject({
    sens: 'DEPENSE', montant: 5000, tiers: 'OXYGENE MADA', beneficiaireBanque: 'BOA',
  });
  expect(livre.virements.comptes[0]).toMatchObject({ titulaire: 'SALFA TOLIARA', adresse: 'BP 99 Toliara' });
});

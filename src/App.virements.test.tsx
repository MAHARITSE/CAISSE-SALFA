import { it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CLE_LIVRE } from './utils/storage';

/**
 * Crée une fiche fournisseur (ou client) depuis le livre des virements : son
 * nom, son adresse et son RIB alimentent ensuite l'ordre de virement.
 */
async function creerFiche(
  user: ReturnType<typeof userEvent.setup>,
  options: { type: 'FOURNISSEUR' | 'CLIENT'; nom: string; banque?: string; compte?: string; adresse?: string },
) {
  const section = screen.getByRole('region', { name: 'Clients et fournisseurs' });
  const bouton = options.type === 'FOURNISSEUR' ? 'Ajouter un fournisseur' : 'Ajouter un client';
  await user.click(within(section).getAllByRole('button', { name: bouton })[0]);
  const dialogue = screen.getByRole('dialog', { name: options.type === 'FOURNISSEUR' ? 'Ajouter un fournisseur' : 'Ajouter un client' });
  await user.type(within(dialogue).getByLabelText('Nom'), options.nom);
  if (options.adresse) await user.type(within(dialogue).getByLabelText('Adresse'), options.adresse);
  if (options.banque) await user.type(within(dialogue).getByLabelText('Établissement bancaire'), options.banque);
  if (options.compte) await user.type(within(dialogue).getByLabelText('Compte ou RIB'), options.compte);
  await user.click(within(dialogue).getByRole('button', { name: 'Ajouter la fiche' }));
}

it('le comptable saisit un virement sans modifier les espèces', async () => {
  const user = userEvent.setup();
  render(<App />);
  // Le compte et son RIB sont réglés une fois pour toutes dans Administration.
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'admin');
  await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Administration' }));
  await user.click(within(screen.getByRole('region', { name: 'Comptes bancaires et RIB' })).getByRole('button', { name: 'Préparer BNI/C et BNI/D' }));
  // Le compte reste enregistré ; le comptable arrive dans une session neuve.
  await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
  cleanup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'comptable');
  await user.type(screen.getByLabelText('Mot de passe'), 'compta1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
  // Le bénéficiaire vient d'une fiche : le comptable enregistre celle du client.
  await creerFiche(user, { type: 'CLIENT', nom: 'ASSOCIATION FANILO', adresse: 'Toliara' });
  await user.click(screen.getByRole('button', { name: /Nouvelle recette par virement/ }));
  let dialog = screen.getByRole('dialog', { name: 'Nouvelle recette par virement' });
  await user.selectOptions(within(dialog).getByLabelText('Client qui règle la recette'),
    within(dialog).getByRole('option', { name: 'ASSOCIATION FANILO' }));
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


it('l’administrateur prépare BNI/C et BNI/D dans Administration et complète le numéro plus tard', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'admin');
  await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Administration' }));
  const section = screen.getByRole('region', { name: 'Comptes bancaires et RIB' });
  await user.click(within(section).getByRole('button', { name: 'Préparer BNI/C et BNI/D' }));
  let livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.comptes.map((c: { banque: string }) => c.banque)).toEqual(['BNI/C', 'BNI/D']);
  expect(livre.virements.comptes.map((c: { numeroCompte: string }) => c.numeroCompte)).toEqual(['', '']);
  // Les deux comptes sont annoncés « RIB à compléter » et le raccourci disparaît.
  expect(within(section).getAllByText('RIB à compléter')).toHaveLength(2);
  expect(within(section).queryByRole('button', { name: 'Préparer BNI/C et BNI/D' })).toBeNull();

  // Le numéro du RIB et son titulaire se complètent ensuite, par modification.
  await user.click(within(section).getByRole('button', { name: 'Modifier le compte BNI/C' }));
  let dialog = screen.getByRole('dialog', { name: 'Modifier le compte BNI/C' });
  await user.type(within(dialog).getByLabelText('Numéro de compte / RIB'), 'TEST-123');
  await user.type(within(dialog).getByLabelText(/Titulaire du compte/), 'SALFA TOLIARA');
  await user.type(within(dialog).getByLabelText(/Code banque du RIB/), '00005');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer les modifications' }));
  livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.comptes[0]).toMatchObject({ numeroCompte: 'TEST-123', titulaire: 'SALFA TOLIARA', codeBanque: '00005' });
  expect(livre.virements.comptes[1].numeroCompte).toBe('');
  expect(within(section).getAllByText('RIB à compléter')).toHaveLength(1);

  // Le comptable saisit ensuite sur ces comptes, sans les régler lui-même.
  await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
  cleanup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'comptable');
  await user.type(screen.getByLabelText('Mot de passe'), 'compta1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
  expect(screen.queryByRole('button', { name: /Ajouter un compte bancaire/ })).toBeNull();
  // Une recette par virement se reçoit d'un client enregistré : le comptable
  // crée sa fiche, puis le choisit dans la fenêtre de saisie.
  await creerFiche(user, { type: 'CLIENT', nom: 'ASSOCIATION FANILO', adresse: 'Toliara' });
  await user.click(screen.getByRole('button', { name: 'Nouvelle recette par virement' }));
  dialog = screen.getByRole('dialog', { name: 'Nouvelle recette par virement' });
  await user.selectOptions(within(dialog).getByLabelText('Compte bancaire'), livre.virements.comptes[0].id);
  await user.selectOptions(within(dialog).getByLabelText('Client qui règle la recette'),
    within(dialog).getByRole('option', { name: 'ASSOCIATION FANILO' }));
  await user.type(within(dialog).getByLabelText('Libellé'), 'Recette sous-compte');
  await user.type(within(dialog).getByLabelText('Montant (Ar)'), '1000');
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
  livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.ecritures[0]).toMatchObject({ compteId: livre.virements.comptes[0].id, tiers: 'ASSOCIATION FANILO' });
  expect(livre.ecritures).toEqual([]);
});

it('refuse de supprimer un compte qui porte des virements', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'admin');
  await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Administration' }));
  const section = screen.getByRole('region', { name: 'Comptes bancaires et RIB' });
  await user.click(within(section).getByRole('button', { name: 'Préparer BNI/C et BNI/D' }));
  await user.click(within(section).getByRole('button', { name: 'Modifier le compte BNI/D' }));
  const dialogModif = screen.getByRole('dialog', { name: 'Modifier le compte BNI/D' });
  await user.type(within(dialogModif).getByLabelText('Numéro de compte / RIB'), '00005 99999999999');
  await user.click(within(dialogModif).getByRole('button', { name: 'Enregistrer les modifications' }));
  const livre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
  expect(livre.virements.comptes).toHaveLength(2);

  // Un compte sans virement se supprime.
  await user.click(within(section).getByRole('button', { name: 'Supprimer le compte BNI/D' }));
  let dialog = screen.getByRole('dialog', { name: 'Supprimer le compte BNI/D ?' });
  await user.click(within(dialog).getByRole('button', { name: 'Supprimer le compte' }));
  expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).virements.comptes.map((c: { banque: string }) => c.banque)).toEqual(['BNI/C']);
});

it('imprime l’ordre de virement sur demi-A4 après toute autorisation de dépense par virement', async () => {
  const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Connexion à Caisse et Trésorerie/ });
  await user.type(screen.getByLabelText('Identifiant'), 'admin');
  await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
  // Compte bancaire de l'hôpital : titulaire, adresse et code banque du RIB,
  // réglés dans Administration avant toute saisie.
  await user.click(screen.getByRole('button', { name: 'Administration' }));
  const section = screen.getByRole('region', { name: 'Comptes bancaires et RIB' });
  await user.click(within(section).getByRole('button', { name: 'Ajouter un compte' }));
  let dialogue = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
  await user.type(within(dialogue).getByLabelText('Banque'), 'BNI/C');
  await user.type(within(dialogue).getByLabelText('Numéro de compte / RIB'), '00005 12345678901');
  await user.type(within(dialogue).getByLabelText(/Titulaire du compte/), 'SALFA TOLIARA');
  await user.type(within(dialogue).getByLabelText(/Adresse du titulaire/), 'BP 99 Toliara');
  await user.type(within(dialogue).getByLabelText(/Code banque du RIB/), '00005');
  await user.click(within(dialogue).getByRole('button', { name: 'Ajouter le compte' }));

  await user.click(screen.getByRole('button', { name: 'Livre des virements' }));
  // Le fournisseur et son RIB vivent dans une fiche, pas dans un champ libre.
  await creerFiche(user, { type: 'FOURNISSEUR', nom: 'OXYGENE MADA', banque: 'BOA', compte: '00004 111', adresse: 'Lot II Antananarivo' });
  await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
  dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
  await user.type(within(dialogue).getByLabelText('Libellé'), 'OXYGENE');
  await user.selectOptions(within(dialogue).getByLabelText('Fournisseur à payer'),
    within(dialogue).getByRole('option', { name: 'OXYGENE MADA' }));
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

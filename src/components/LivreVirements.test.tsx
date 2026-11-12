import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LivreVirements } from './LivreVirements';
import { categoriesParDefaut } from '../utils/constants';
import { entetesParDefaut } from '../utils/entete';
import { ajouterCompteVirement, ajouterVirement, registreVirementsVide } from '../utils/virements';
import { preparerSauvegarde, lireSauvegarde, preparerSqlLivre, lireSauvegardeSql } from '../utils/backup';
import { livreTest } from '../test/fixtures';
import { validerDonnees } from '../utils/validation';
import { ongletsAutorises } from '../utils/roles';

const impression = vi.hoisted(() => vi.fn());
vi.mock('../utils/export-pdf', () => ({ ouvrirEtatPourImpression: impression }));
const compte = { id: 'banque', banque: 'BNI', numeroCompte: '001234' };
const registre = ajouterVirement(ajouterCompteVirement(registreVirementsVide(), compte), {
  id: 'v1', compteId: compte.id, date: '2026-05-12', sens: 'RECETTE', libelle: 'Cotisation', categorie: 'Dons', tiers: 'Test', reference: 'REF', observation: '', montant: 1000, createdAt: '2026-05-12T12:00:00Z',
});

describe('livre des virements', () => {
  it('saisit un virement avec la bonne opération, sur un compte réglé dans Administration', async () => {
    const onMutation = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const props = { categories: categoriesParDefaut(), entete: entetesParDefaut(), onMutation, erreurExterne: null };
    render(<LivreVirements {...props} registre={registre} />);
    await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
    const dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
    await user.type(within(dialogue).getByLabelText('Libellé'), 'Facture');
    await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '5000');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onMutation).toHaveBeenLastCalledWith({ operation: 'ajouter', virement: expect.objectContaining({ sens: 'DEPENSE', montant: 5000, compteId: 'banque', libelle: 'Facture' }) });
  });
  it('ne règle plus les comptes : la saisie attend ceux créés dans Administration', async () => {
    const onMutation = vi.fn().mockResolvedValue(true);
    const props = { categories: categoriesParDefaut(), entete: entetesParDefaut(), onMutation, erreurExterne: null };
    render(<LivreVirements {...props} registre={registreVirementsVide()} />);
    // Aucun bouton de compte ni de préparation BNI dans le livre des virements.
    expect(screen.queryByRole('button', { name: /compte bancaire/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Préparer BNI/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Modifier le compte/ })).toBeNull();
    // La saisie reste fermée tant qu'aucun compte n'existe, et l'écran dit où le créer.
    expect(screen.getByRole('button', { name: /Nouvelle recette/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Nouvelle DED/ })).toBeDisabled();
    expect(screen.getByText(/un administrateur doit d’abord le créer dans/)).toBeInTheDocument();
  });
  it('imprime l’ordre de virement dès qu’une DED par virement est enregistrée, jamais pour une recette', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const onMutation = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const props = { categories: categoriesParDefaut(), entete: entetesParDefaut(), onMutation, erreurExterne: null };
    const { rerender } = render(<LivreVirements {...props} registre={registre} />);

    // Une recette ne produit pas d'ordre de virement : rien à envoyer à la banque.
    await user.click(screen.getByRole('button', { name: /Nouvelle recette/ }));
    let dialogue = screen.getByRole('dialog', { name: 'Nouvelle recette par virement' });
    await user.type(within(dialogue).getByLabelText('Libellé'), 'Cotisation reçue');
    await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '1000');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onMutation).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouvelle recette par virement' })).not.toBeInTheDocument());
    expect(document.querySelector('.print-ordre-virement')).toBeNull();

    // Une DED par virement imprime aussitôt son ordre de virement sur demi-A4.
    await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
    dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
    await user.type(within(dialogue).getByLabelText('Libellé'), 'OXYGENE');
    await user.type(within(dialogue).getByLabelText('Tiers / bénéficiaire'), 'SOCIETE OXYGENE');
    await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '5000');
    await user.type(within(dialogue).getByLabelText('Compte ou RIB du bénéficiaire'), '00004 123');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    const feuille = document.querySelector('.print-ordre-virement');
    expect(feuille).not.toBeNull();
    expect(feuille).toHaveTextContent('ORDRE DE VIREMENT');
    expect(feuille).toHaveTextContent('SOCIETE OXYGENE');
    // Le numéro définitif du serveur figure sur l'ordre : VD-2026-0001.
    expect(feuille).toHaveTextContent(`Pièce VD-${new Date().getFullYear()}-0001`);
    expect(feuille).toHaveTextContent('00004 123');
    expect(feuille?.querySelectorAll('.ordre-virement')).toHaveLength(2);
    expect(onMutation).toHaveBeenLastCalledWith({ operation: 'ajouter', virement: expect.objectContaining({
      sens: 'DEPENSE', montant: 5000, beneficiaireCompte: '00004 123', tiers: 'SOCIETE OXYGENE',
    }) });
    // La fin de l'impression rend le registre.
    fireEvent(window, new Event('afterprint'));
    expect(document.querySelector('.print-ordre-virement')).toBeNull();
    rerender(<LivreVirements {...props} registre={registre} />);
  });

  it('réimprime l’ordre de virement d’une DED depuis le registre', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    const avecDepense = ajouterVirement(registre, {
      id: 'v2', compteId: compte.id, date: '2026-05-12', sens: 'DEPENSE', libelle: 'Oxygène',
      categorie: 'Divers', tiers: 'OXYGENE MADA', reference: '', observation: '', montant: 5000,
      createdAt: '2026-05-12T12:00:00Z', beneficiaireBanque: 'BOA',
    });
    render(<LivreVirements registre={avecDepense} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);
    await user.click(screen.getByRole('button', { name: `Imprimer l’ordre de virement ${avecDepense.ecritures[1].numero}` }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.print-ordre-virement')).toHaveTextContent('OXYGENE MADA');
    expect(document.querySelector('.print-ordre-virement')).toHaveTextContent('BOA');
    fireEvent(window, new Event('afterprint'));
    // Les boutons de réimpression n'existent que pour les dépenses.
    expect(screen.queryByRole('button', { name: 'Imprimer l’ordre de virement VR-2026-0001' })).not.toBeInTheDocument();
  });

  it('filtre et imprime la sélection avec le compte, sans solde bancaire', async () => {
    const user = userEvent.setup();
    render(<LivreVirements registre={registre} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);
    expect(screen.getByText('VR-2026-0001')).toBeInTheDocument();
    const fenetre = { close: vi.fn() } as unknown as Window;
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue(fenetre);
    await user.click(screen.getByRole('button', { name: /Imprimer l’état/ }));
    await waitFor(() => expect(impression).toHaveBeenCalled());
    expect(impression.mock.calls.at(-1)?.[0][0].libelle).toContain('BNI · Compte : 001234');
    expect(impression.mock.calls.at(-1)?.[4]).toBe(true);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'DEPENSE' } });
    expect(screen.getByText(/Aucun virement pour cette sélection/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimer l’état/ })).toBeDisabled();
    ouvrir.mockRestore();
  });
  it('réserve l’onglet aux rôles autorisés et inclut le registre aux sauvegardes', () => {
    expect(ongletsAutorises('admin')).toContain('virements');
    expect(ongletsAutorises('comptable')).toContain('virements');
    expect(ongletsAutorises('caissier')).not.toContain('virements');
    expect(ongletsAutorises('lecteur')).not.toContain('virements');
    const livre = livreTest({ virements: registre });
    expect(validerDonnees(livre).virements).toEqual(registre);
    expect(lireSauvegarde(preparerSauvegarde(livre)).virements).toEqual(registre);
    expect(lireSauvegardeSql(preparerSqlLivre(livre)).virements).toEqual(registre);
  });
});

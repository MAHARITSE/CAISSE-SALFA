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
  it('saisit un compte et un virement avec la bonne opération', async () => {
    const onMutation = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const props = { categories: categoriesParDefaut(), entete: entetesParDefaut(), onMutation, erreurExterne: null };
    const { rerender } = render(<LivreVirements {...props} registre={registreVirementsVide()} />);
    expect(screen.getByRole('button', { name: /Nouvelle recette/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Ajouter un compte/ }));
    const dialogueCompte = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
    await user.type(within(dialogueCompte).getByLabelText('Banque'), 'BNI');
    await user.type(within(dialogueCompte).getByLabelText('Numéro de compte'), '001234');
    await user.click(within(dialogueCompte).getByRole('button', { name: 'Enregistrer le compte' }));
    expect(onMutation).toHaveBeenCalledWith({ operation: 'ajouter_compte', compte: expect.objectContaining({ banque: 'BNI', numeroCompte: '001234' }) });
    rerender(<LivreVirements {...props} registre={registre} />);
    await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
    const dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
    await user.type(within(dialogue).getByLabelText('Libellé'), 'Facture');
    await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '5000');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onMutation).toHaveBeenLastCalledWith({ operation: 'ajouter', virement: expect.objectContaining({ sens: 'DEPENSE', montant: 5000, compteId: 'banque', libelle: 'Facture' }) });
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

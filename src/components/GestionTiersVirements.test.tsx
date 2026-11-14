import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GestionTiersVirements } from './GestionTiersVirements';
import { ajouterCompteVirement, ajouterTiers, ajouterVirement, registreVirementsVide, type Tiers } from '../utils/virements';

const compte = { id: 'b1', banque: 'BNI/C', numeroCompte: '00005 00041 43200100200 85' };
const client: Tiers = { id: 't-c', type: 'CLIENT', nom: 'ASSOCIATION FANILO', telephone: '034 00 000 00', adresse: 'Toliara', banque: '', numeroCompte: '' };
const fournisseur: Tiers = { id: 't-f', type: 'FOURNISSEUR', nom: 'SOCIETE OXYGENE', telephone: '020 11 111 11', adresse: 'Lot II Antananarivo', banque: 'BOA', numeroCompte: '00004 00010 98765432101 42' };

const registre = () => ajouterVirement(
  ajouterTiers(ajouterTiers(ajouterCompteVirement(registreVirementsVide(), compte), client), fournisseur),
  {
    id: 'v1', compteId: compte.id, date: '2026-11-12', sens: 'DEPENSE', libelle: 'OXYGENE', categorie: 'Médical',
    tiers: fournisseur.nom, tiersId: fournisseur.id, reference: '', observation: '', montant: 5000,
    createdAt: '2026-11-12T08:00:00.000Z',
    beneficiaireBanque: fournisseur.banque, beneficiaireCompte: fournisseur.numeroCompte,
  },
);

function rendre(onMutation = vi.fn().mockResolvedValue(true), erreurExterne: string | null = null) {
  render(<GestionTiersVirements registre={registre()} onMutation={onMutation} erreurExterne={erreurExterne} />);
  return onMutation;
}

describe('clients et fournisseurs du livre des virements', () => {
  it('liste les fournisseurs et les clients avec leur RIB et leurs virements', () => {
    rendre();
    expect(screen.getByText('SOCIETE OXYGENE')).toBeInTheDocument();
    expect(screen.getByText('ASSOCIATION FANILO')).toBeInTheDocument();
    expect(screen.getByText('RIB : BOA — 00004 00010 98765432101 42 · 1 virement(s)')).toBeInTheDocument();
    expect(screen.getByText('Client : aucune coordonnée bancaire nécessaire · 0 virement(s)')).toBeInTheDocument();
    expect(screen.getByText('020 11 111 11 · Lot II Antananarivo')).toBeInTheDocument();
  });

  it('ajoute un fournisseur avec son RIB formaté selon le masque', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter un fournisseur' }));
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un fournisseur' });
    await user.type(within(dialogue).getByLabelText('Nom'), 'PHARMACIE SALFA');
    await user.type(within(dialogue).getByLabelText('Téléphone'), '020 22 222 22');
    await user.type(within(dialogue).getByLabelText('Adresse'), 'BP 12 Toliara');
    await user.type(within(dialogue).getByLabelText('Établissement bancaire'), 'BNI');
    await user.type(within(dialogue).getByLabelText('Compte ou RIB'), '00005000414320010020085');
    await user.click(within(dialogue).getByRole('button', { name: 'Ajouter la fiche' }));
    expect(onMutation).toHaveBeenCalledWith({
      operation: 'ajouter_tiers',
      tiers: expect.objectContaining({
        type: 'FOURNISSEUR', nom: 'PHARMACIE SALFA', telephone: '020 22 222 22', adresse: 'BP 12 Toliara',
        banque: 'BNI', numeroCompte: '00005 00041 43200100200 85',
      }),
    });
    expect(await screen.findByText('Fiche « PHARMACIE SALFA » ajoutée.')).toBeInTheDocument();
  });

  it('refuse un fournisseur sans RIB, sans rien enregistrer', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter un fournisseur' }));
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un fournisseur' });
    await user.type(within(dialogue).getByLabelText('Nom'), 'SANS RIB');
    await user.click(within(dialogue).getByRole('button', { name: 'Ajouter la fiche' }));
    expect(onMutation).not.toHaveBeenCalled();
    expect(within(dialogue).getByRole('alert')).toHaveTextContent(/RIB du fournisseur/);
  });

  it('accepte un client sans coordonnée bancaire, et modifie une fiche existante', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter un client' }));
    let dialogue = screen.getByRole('dialog', { name: 'Ajouter un client' });
    await user.type(within(dialogue).getByLabelText('Nom'), 'DONATEUR INDIVIDUEL');
    await user.click(within(dialogue).getByRole('button', { name: 'Ajouter la fiche' }));
    expect(onMutation).toHaveBeenCalledWith({ operation: 'ajouter_tiers', tiers: expect.objectContaining({ type: 'CLIENT', nom: 'DONATEUR INDIVIDUEL', banque: '', numeroCompte: '' }) });

    await user.click(screen.getByRole('button', { name: 'Modifier ASSOCIATION FANILO' }));
    dialogue = screen.getByRole('dialog', { name: 'Modifier la fiche ASSOCIATION FANILO' });
    expect(within(dialogue).getByLabelText('Nom')).toHaveValue('ASSOCIATION FANILO');
    await user.clear(within(dialogue).getByLabelText('Téléphone'));
    await user.type(within(dialogue).getByLabelText('Téléphone'), '034 99 999 99');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(onMutation).toHaveBeenLastCalledWith({
      operation: 'modifier_tiers',
      tiers: expect.objectContaining({ id: client.id, nom: 'ASSOCIATION FANILO', telephone: '034 99 999 99' }),
    });
  });

  it('ne propose pas de supprimer une fiche qui porte un virement', () => {
    rendre();
    expect(screen.getByRole('button', { name: 'Supprimer SOCIETE OXYGENE' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer ASSOCIATION FANILO' })).toBeEnabled();
  });

  it('supprime une fiche sans virement après confirmation', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Supprimer ASSOCIATION FANILO' }));
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer la fiche ASSOCIATION FANILO ?' });
    await user.click(within(dialogue).getByRole('button', { name: 'Supprimer la fiche' }));
    expect(onMutation).toHaveBeenCalledWith({ operation: 'supprimer_tiers', tiersId: client.id });
    expect(await screen.findByText('Fiche « ASSOCIATION FANILO » supprimée.')).toBeInTheDocument();
  });

  it('affiche l’erreur du serveur sans la masquer', () => {
    rendre(vi.fn(), 'Cette fiche porte des virements : suppression impossible.');
    expect(screen.getByRole('alert')).toHaveTextContent('suppression impossible');
  });
});

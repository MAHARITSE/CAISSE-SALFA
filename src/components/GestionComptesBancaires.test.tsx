import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GestionComptesBancaires } from './GestionComptesBancaires';
import { ajouterCompteVirement, ajouterTiers, ajouterVirement, registreVirementsVide } from '../utils/virements';

const bniC = { id: 'b-c', banque: 'BNI/C', numeroCompte: '', titulaire: 'SALFA TOLIARA', codeBanque: '00005' };
const bniD = { id: 'b-d', banque: 'BNI/D', numeroCompte: '00005 00041 43200100200 85' };
const fournisseur = {
  id: 't-four', type: 'FOURNISSEUR' as const, nom: 'OXYGENE MADA', telephone: '',
  adresse: 'Antananarivo', banque: 'BOA', numeroCompte: '00004 00010 98765432101 42',
};

const registre = ajouterVirement(
  ajouterTiers(ajouterCompteVirement(ajouterCompteVirement(registreVirementsVide(), bniC), bniD), fournisseur),
  {
    id: 'v1', compteId: bniD.id, date: '2026-11-12', sens: 'DEPENSE', libelle: 'OXYGENE',
    categorie: 'Médical', tiers: 'OXYGENE MADA', tiersId: fournisseur.id, reference: '', observation: '',
    montant: 5000, createdAt: '2026-11-12T08:00:00.000Z',
  },
);

function rendre(onMutation = vi.fn().mockResolvedValue(true), erreurExterne: string | null = null) {
  render(<GestionComptesBancaires registre={registre} onMutation={onMutation} erreurExterne={erreurExterne} />);
  return onMutation;
}

describe('comptes bancaires et RIB réglés dans Administration', () => {
  it('liste les comptes, signale le RIB à compléter et le nombre de virements rattachés', () => {
    rendre();
    expect(screen.getByText('BNI/C — numéro non renseigné')).toBeInTheDocument();
    expect(screen.getByText('BNI/D — 00005 00041 43200100200 85')).toBeInTheDocument();
    expect(screen.getAllByText('RIB à compléter')).toHaveLength(1);
    expect(screen.getByText('Code banque 00005 · SALFA TOLIARA')).toBeInTheDocument();
    expect(screen.getByText('1 virement(s) rattaché(s)')).toBeInTheDocument();
  });

  it('ajoute un compte avec son RIB complet formaté selon le masque', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter un compte' }));
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
    await user.type(within(dialogue).getByLabelText('Banque'), 'BOA');
    await user.type(within(dialogue).getByLabelText('Numéro de compte / RIB'), '00004000109876543210142');
    await user.type(within(dialogue).getByLabelText(/Titulaire du compte/), 'SALFA TOLIARA');
    await user.type(within(dialogue).getByLabelText(/Adresse du titulaire/), 'BP 99 Toliara');
    await user.type(within(dialogue).getByLabelText(/Code banque du RIB/), '00004');
    await user.click(within(dialogue).getByRole('button', { name: 'Ajouter le compte' }));
    expect(onMutation).toHaveBeenCalledWith({
      operation: 'ajouter_compte',
      compte: expect.objectContaining({
        banque: 'BOA', numeroCompte: '00004 00010 98765432101 42', titulaire: 'SALFA TOLIARA',
        adresse: 'BP 99 Toliara', codeBanque: '00004',
      }),
    });
    expect(await screen.findByText('Compte BOA ajouté.')).toBeInTheDocument();
  });

  it('modifie le RIB d’un compte existant sans changer son identifiant', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Modifier le compte BNI/C' }));
    const dialogue = screen.getByRole('dialog', { name: 'Modifier le compte BNI/C' });
    expect(within(dialogue).getByLabelText('Banque')).toHaveValue('BNI/C');
    expect(within(dialogue).getByLabelText(/Code banque du RIB/)).toHaveValue('00005');
    await user.type(within(dialogue).getByLabelText('Numéro de compte / RIB'), '00005 00041 43200100200 85');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(onMutation).toHaveBeenCalledWith({
      operation: 'modifier_compte',
      compte: expect.objectContaining({ id: 'b-c', banque: 'BNI/C', numeroCompte: '00005 00041 43200100200 85' }),
    });
  });

  it('refuse un code banque qui n’a pas cinq chiffres, sans rien enregistrer', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter un compte' }));
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
    await user.type(within(dialogue).getByLabelText('Banque'), 'BOA');
    // Le champ ne garde que les chiffres : trois ne suffisent pas pour un RIB.
    await user.type(within(dialogue).getByLabelText(/Code banque du RIB/), '123');
    await user.click(within(dialogue).getByRole('button', { name: 'Ajouter le compte' }));
    expect(onMutation).not.toHaveBeenCalled();
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('cinq chiffres');
  });

  it('ne propose pas de supprimer un compte qui porte un virement', () => {
    rendre();
    expect(screen.getByRole('button', { name: 'Supprimer le compte BNI/D' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer le compte BNI/C' })).toBeEnabled();
  });

  it('supprime un compte sans virement après confirmation', async () => {
    const onMutation = rendre();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Supprimer le compte BNI/C' }));
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer le compte BNI/C ?' });
    await user.click(within(dialogue).getByRole('button', { name: 'Supprimer le compte' }));
    expect(onMutation).toHaveBeenCalledWith({ operation: 'supprimer_compte', compteId: 'b-c' });
    expect(await screen.findByText('Compte BNI/C supprimé.')).toBeInTheDocument();
  });

  it('prépare les deux comptes BNI manquants en une fois', async () => {
    const onMutation = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(<GestionComptesBancaires registre={registreVirementsVide()} onMutation={onMutation} erreurExterne={null} />);
    await user.click(screen.getByRole('button', { name: 'Préparer BNI/C et BNI/D' }));
    expect(onMutation).toHaveBeenCalledWith({
      operation: 'ajouter_comptes',
      comptes: [
        expect.objectContaining({ banque: 'BNI/C', numeroCompte: '' }),
        expect.objectContaining({ banque: 'BNI/D', numeroCompte: '' }),
      ],
    });
  });

  it('affiche l’erreur du serveur sans la masquer', () => {
    rendre(vi.fn(), 'Le compte porte des virements : suppression impossible.');
    expect(screen.getByRole('alert')).toHaveTextContent('suppression impossible');
  });
});

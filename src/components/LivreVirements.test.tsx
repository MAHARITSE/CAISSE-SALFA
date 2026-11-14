import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LivreVirements } from './LivreVirements';
import { categoriesParDefaut } from '../utils/constants';
import { entetesParDefaut } from '../utils/entete';
import { ajouterCompteVirement, ajouterTiers, ajouterVirement, registreVirementsVide } from '../utils/virements';
import { preparerSauvegarde, lireSauvegarde, preparerSqlLivre, lireSauvegardeSql } from '../utils/backup';
import { livreTest } from '../test/fixtures';
import { validerDonnees } from '../utils/validation';
import { ongletsAutorises } from '../utils/roles';

const impression = vi.hoisted(() => vi.fn());
vi.mock('../utils/export-pdf', () => ({ ouvrirEtatPourImpression: impression }));
const compte = { id: 'banque', banque: 'BNI', numeroCompte: '00005 00041 43200100200 85' };
const client = { id: 't-client', type: 'CLIENT' as const, nom: 'Association FANILO', telephone: '034 00 000 00', adresse: 'Toliara', banque: '', numeroCompte: '' };
const fournisseur = { id: 't-four', type: 'FOURNISSEUR' as const, nom: 'SOCIETE OXYGENE', telephone: '', adresse: 'Lot II Antananarivo', banque: 'BOA', numeroCompte: '00004 123' };

/** Registre de départ : un compte bancaire, un client, un fournisseur. */
const avecFiches = () => ajouterTiers(ajouterTiers(ajouterCompteVirement(registreVirementsVide(), compte), client), fournisseur);
const registre = ajouterVirement(avecFiches(), {
  id: 'v1', compteId: compte.id, date: '2026-05-12', sens: 'RECETTE', libelle: 'Cotisation', categorie: 'Dons',
  tiers: client.nom, tiersId: client.id, reference: 'REF', observation: '', montant: 1000, createdAt: '2026-05-12T12:00:00Z',
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
    const champMontant = within(dialogue).getByLabelText('Montant (Ar)');
    await user.type(champMontant, '1250000');
    expect(champMontant).toHaveValue('1\u202f250\u202f000');
    // Le fournisseur se choisit dans les fiches : son RIB part avec le virement.
    await user.selectOptions(within(dialogue).getByLabelText('Fournisseur à payer'), fournisseur.id);
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onMutation).toHaveBeenLastCalledWith({ operation: 'ajouter', virement: expect.objectContaining({
      sens: 'DEPENSE', montant: 1250000, compteId: 'banque', libelle: 'FACTURE',
      tiers: 'SOCIETE OXYGENE', tiersId: fournisseur.id,
      beneficiaireBanque: 'BOA', beneficiaireCompte: '00004 123', beneficiaireAdresse: 'Lot II Antananarivo',
    }) });
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
    expect(screen.queryByRole('button', { name: /Nouvelle recette/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Nouvelle DED/ })).toBeNull();
    expect(screen.getByText(/un administrateur doit d’abord en créer un dans Administration/)).toBeInTheDocument();
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
    await user.selectOptions(within(dialogue).getByLabelText('Client qui règle la recette'), client.id);
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    expect(onMutation).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouvelle recette par virement' })).not.toBeInTheDocument());
    expect(document.querySelector('.print-ordre-virement')).toBeNull();

    // Une DED par virement imprime aussitôt l'état DED et l'ordre de virement sur demi-A4.
    await user.click(screen.getByRole('button', { name: /Nouvelle DED/ }));
    dialogue = screen.getByRole('dialog', { name: 'Nouvelle DED par virement' });
    await user.type(within(dialogue).getByLabelText('Libellé'), 'oxygene');
    await user.selectOptions(within(dialogue).getByLabelText('Fournisseur à payer'), fournisseur.id);
    await user.type(within(dialogue).getByLabelText('Montant (Ar)'), '5000');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    const etat = document.querySelector('.print-bordereau');
    expect(etat).not.toBeNull();
    expect(etat).toHaveTextContent('DEMANDE D’ENGAGEMENT DE DÉPENSES (DED)');
    expect(etat).toHaveTextContent(`VD-${new Date().getFullYear()}-0001`);
    const feuille = document.querySelector('.print-ordre-virement');
    expect(feuille).not.toBeNull();
    expect(feuille).toHaveTextContent('ORDRE DE VIREMENT');
    expect(feuille).toHaveTextContent('SOCIETE OXYGENE');
    // Le numéro définitif du serveur et le libellé en majuscules figurent sur l'ordre.
    expect(feuille).toHaveTextContent(`VD-${new Date().getFullYear()}-0001`);
    expect(feuille?.querySelector('.ordre-virement__observation')).toHaveTextContent('OXYGENE');
    expect(feuille).toHaveTextContent('00004 123');
    expect(feuille?.querySelectorAll('.ordre-virement')).toHaveLength(1);
    expect(feuille).not.toHaveTextContent(/moitié haute|souche|découper/i);
    expect(onMutation).toHaveBeenLastCalledWith({ operation: 'ajouter', virement: expect.objectContaining({
      sens: 'DEPENSE', montant: 5000, libelle: 'OXYGENE', beneficiaireCompte: '00004 123', tiers: 'SOCIETE OXYGENE', tiersId: fournisseur.id,
    }) });
    // La fin de l'impression rend le registre.
    fireEvent(window, new Event('afterprint'));
    expect(document.querySelector('.print-bordereau')).toBeNull();
    expect(document.querySelector('.print-ordre-virement')).toBeNull();
    rerender(<LivreVirements {...props} registre={registre} />);
  });

  it('réimprime l’ordre de virement d’une DED depuis le registre', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    const avecDepense = ajouterVirement(registre, {
      id: 'v2', compteId: compte.id, date: '2026-05-12', sens: 'DEPENSE', libelle: 'Oxygène',
      categorie: 'Divers', tiers: fournisseur.nom, tiersId: fournisseur.id, reference: '', observation: '', montant: 5000,
      createdAt: '2026-05-12T12:00:00Z', beneficiaireBanque: fournisseur.banque, beneficiaireCompte: fournisseur.numeroCompte,
    });
    render(<LivreVirements registre={avecDepense} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);
    await user.click(screen.getByRole('button', { name: `Imprimer l’ordre de virement ${avecDepense.ecritures[1].numero}` }));
    await waitFor(() => expect(imprimer).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.print-ordre-virement')).toHaveTextContent('SOCIETE OXYGENE');
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
    await user.click(screen.getByRole('button', { name: 'Imprimer' }));
    await waitFor(() => expect(impression).toHaveBeenCalled());
    expect(impression.mock.calls.at(-1)?.[0][0].libelle).toContain('BNI · Compte : 00005 00041 43200100200 85');
    expect(impression.mock.calls.at(-1)?.[4]).toBe(true);
    await user.click(screen.getByRole('button', { name: 'DED / dépenses' }));
    expect(screen.getByText(/Aucun virement pour cette sélection/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimer' })).toBeDisabled();
    ouvrir.mockRestore();
  });
  it('filtre les virements par fournisseur ou client et adapte la liste au type choisi', async () => {
    const user = userEvent.setup();
    const avecDeuxTiers = ajouterVirement(registre, {
      id: 'v2', compteId: compte.id, date: '2026-05-14', sens: 'DEPENSE', libelle: 'Achat oxygène',
      categorie: 'Divers', tiers: fournisseur.nom, tiersId: fournisseur.id, reference: 'FAC-02', observation: '', montant: 4500,
      createdAt: '2026-05-14T10:00:00Z', beneficiaireBanque: fournisseur.banque, beneficiaireCompte: fournisseur.numeroCompte,
    });
    render(<LivreVirements registre={avecDeuxTiers} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);

    const selectTiers = screen.getByLabelText('Filtrer par fournisseur ou client');
    expect(screen.getByText('Cotisation')).toBeInTheDocument();
    expect(screen.getByText('Achat oxygène')).toBeInTheDocument();

    await user.selectOptions(selectTiers, fournisseur.id);
    expect(screen.queryByText('Cotisation')).not.toBeInTheDocument();
    expect(screen.getByText('Achat oxygène')).toBeInTheDocument();
    expect(screen.getByText('Filtres actifs')).toBeInTheDocument();

    // Passer à « Recettes » réinitialise un fournisseur incompatible et ne propose plus que les clients.
    await user.click(screen.getByRole('button', { name: 'Recettes' }));
    expect(selectTiers).toHaveValue('');
    expect(screen.getByText('Cotisation')).toBeInTheDocument();
    expect(within(selectTiers).queryByText(fournisseur.nom)).toBeNull();
    expect(within(selectTiers).getByText(client.nom)).toBeInTheDocument();

    await user.selectOptions(selectTiers, client.id);
    expect(screen.getByText('Cotisation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(selectTiers).toHaveValue('');
    expect(screen.getByText('Achat oxygène')).toBeInTheDocument();
    expect(screen.getByText('Aucun filtre')).toBeInTheDocument();
  });
  it('classe les virements par ordre chronologique et se place sur la dernière ligne', () => {
    const defiler = vi.fn();
    Object.defineProperty(HTMLTableRowElement.prototype, 'scrollIntoView', { configurable: true, value: defiler });
    try {
      const avecDeuxDates = ajouterVirement(registre, {
        id: 'v2', compteId: compte.id, date: '2026-06-03', sens: 'DEPENSE', libelle: 'Dernier virement',
        categorie: 'Divers', tiers: fournisseur.nom, tiersId: fournisseur.id, reference: 'FAC-03', observation: '', montant: 8000,
        createdAt: '2026-06-03T10:00:00Z', beneficiaireBanque: fournisseur.banque, beneficiaireCompte: fournisseur.numeroCompte,
      });
      render(<LivreVirements registre={avecDeuxDates} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);
      const tableau = screen.getByRole('table', { name: 'Virements enregistrés' });
      const lignesCorps = tableau.querySelectorAll('tbody tr');
      expect(lignesCorps).toHaveLength(2);
      expect(lignesCorps[0]).toHaveTextContent('Cotisation');
      expect(lignesCorps[1]).toHaveTextContent('Dernier virement');
      expect(within(lignesCorps[1] as HTMLElement).getByTitle('Ligne active')).toBeInTheDocument();
      expect(defiler).toHaveBeenCalledTimes(1);
      expect(defiler).toHaveBeenCalledWith({ behavior: 'instant', block: 'end', inline: 'nearest' });
      expect(defiler.mock.instances[0]).toHaveTextContent('Dernier virement');
    } finally {
      delete (HTMLTableRowElement.prototype as Partial<HTMLTableRowElement>).scrollIntoView;
    }
  });
  it('présente la même synthèse et la même barre de période que le livre journal', async () => {
    const user = userEvent.setup();
    const annee = new Date().getFullYear();
    render(<LivreVirements registre={registre} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn()} erreurExterne={null} />);
    // Trois cartes chiffrées et la carte des comptes, comme la synthèse du journal.
    const synthese = screen.getByRole('region', { name: /Synthèse des virements/ });
    expect(within(synthese).getByText('Recettes par virement')).toBeInTheDocument();
    expect(within(synthese).getByText('Dépenses par virement')).toBeInTheDocument();
    expect(within(synthese).getByText('Comptes bancaires')).toBeInTheDocument();
    // Pas de « mouvement net » : le livre des virements ne calcule aucun solde.
    expect(within(synthese).queryByText('Mouvement net')).toBeNull();
    // 1 000 Ar de recette, rien en dépense.
    expect(within(synthese).getByText('1 000,00 Ar')).toBeInTheDocument();
    expect(within(synthese).getByText('0,00 Ar')).toBeInTheDocument();
    expect(within(synthese).getByText(/1 virement\(s\)/)).toBeInTheDocument();

    // La période et les filtres se comportent comme au journal.
    expect(screen.getByLabelText('Mois des virements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tout afficher' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Aucun filtre')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recettes' }));
    expect(screen.getByText('Filtres actifs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(screen.getByText('Aucun filtre')).toBeInTheDocument();

    // Le mois choisi restreint la sélection ; « Tout afficher » la rétablit.
    fireEvent.change(screen.getByLabelText('Mois des virements'), { target: { value: `${annee}-01` } });
    expect(screen.getByRole('button', { name: 'Tout afficher' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Aucun virement pour cette sélection/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tout afficher' }));
    expect(screen.getByText('VR-2026-0001')).toBeInTheDocument();

    // La synthèse se replie, comme celle du livre journal.
    await user.click(screen.getByRole('button', { name: 'Masquer la synthèse' }));
    expect(screen.queryByRole('region', { name: /Synthèse des virements/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Afficher la synthèse' }));
    expect(screen.getByRole('region', { name: /Synthèse des virements/ })).toBeInTheDocument();
  });
  it('charge des exemples depuis le livre : fiches seules si des virements existent déjà', async () => {
    const user = userEvent.setup();
    // Registre vide : les exemples comprennent comptes, fiches et deux virements.
    const onMutation = vi.fn().mockResolvedValue(true);
    const props = { categories: categoriesParDefaut(), entete: entetesParDefaut(), onMutation, erreurExterne: null };
    render(<LivreVirements {...props} registre={registreVirementsVide()} />);
    await user.click(screen.getByRole('button', { name: /Charger des exemples/ }));
    let dialogue = screen.getByRole('dialog', { name: 'Charger des exemples de virements' });
    expect(dialogue).toHaveTextContent('Comptes bancaires à ajouter : 2');
    expect(dialogue).toHaveTextContent('Clients et fournisseurs à ajouter : 9');
    await user.click(within(dialogue).getByRole('button', { name: 'Charger les exemples' }));
    expect(onMutation).toHaveBeenCalledWith({
      operation: 'charger_exemples',
      exemple: expect.objectContaining({
        comptes: expect.arrayContaining([expect.objectContaining({ banque: 'BNI/C' })]),
        tiers: expect.anything(),
        virements: expect.any(Array),
      }),
    });
    expect(screen.queryByRole('dialog', { name: 'Charger des exemples de virements' })).toBeNull();

    // Sur un registre qui porte déjà un virement, seules les fiches manquantes
    // sont proposées : l'historique n'est jamais complété d'office.
    cleanup();
    const onMutation2 = vi.fn().mockResolvedValue(true);
    render(<LivreVirements {...props} onMutation={onMutation2} registre={registre} />);
    await user.click(screen.getByRole('button', { name: /Charger des exemples/ }));
    dialogue = screen.getByRole('dialog', { name: 'Charger des exemples de virements' });
    expect(dialogue).toHaveTextContent(/Virements d’exemple : non proposés/);
    await user.click(within(dialogue).getByRole('button', { name: 'Charger les exemples' }));
    const action = onMutation2.mock.calls[0][0];
    expect(action.operation).toBe('charger_exemples');
    expect(action.exemple.virements).toBeUndefined();
    expect(action.exemple.comptes.length + action.exemple.tiers.length).toBeGreaterThan(0);
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
  it('garde la barre de période, filtres et nouvelles pièces toujours épinglée en haut au défilement', () => {
    render(<LivreVirements registre={registre} categories={categoriesParDefaut()} entete={entetesParDefaut()} onMutation={vi.fn().mockResolvedValue(true)} erreurExterne={null} hauteurEntete={96} />);
    const barre = screen.getByRole('region', { name: 'Période, filtres et nouvelles pièces' });
    expect(barre.parentElement).toHaveClass('sticky', 'no-print');
    expect(barre.parentElement).toHaveStyle({ top: '96px' });
  });
});

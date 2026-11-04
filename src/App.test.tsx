import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Sauvegarde } from './types';
import { ecritureTest, livreTest } from './test/fixtures';
import { CLE_ECRITURES, CLE_LIVRE, sauvegarderLivre } from './utils/storage';
import { enregistrerEcriture } from './utils/ledger';
import { parametresTest } from './test/fixtures';
import { aujourdHui } from './utils/format';

const lire = (): Sauvegarde => JSON.parse(localStorage.getItem(CLE_LIVRE)!);
const annee = aujourdHui().slice(0, 4);

/**
 * L'application s'ouvre sur la page de connexion : on entre avec le compte
 * administrateur de démonstration, sauf pour les tests qui éprouvent les rôles.
 */
async function ouvrirSession(user: ReturnType<typeof userEvent.setup>, identifiant = 'admin', motDePasse = 'admin1234') {
  await screen.findByRole('heading', { name: /Connexion à la caisse/ });
  await user.type(screen.getByLabelText('Identifiant'), identifiant);
  await user.type(screen.getByLabelText('Mot de passe'), motDePasse);
  await user.click(screen.getByRole('button', { name: /Se connecter/ }));
  // `findAllBy` : l'écran précédent peut n'être pas encore démonté.
  expect((await screen.findAllByRole('heading', { name: 'Livre de caisse' })).length).toBeGreaterThan(0);
}

/** Les réglages (modèles, catégories, en-tête) vivent dans la page Administration. */
async function ouvrirAdministration(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Administration' }));
  await screen.findByRole('heading', { name: 'Administration' });
}

/** Retour au livre journal, pour imprimer ou saisir après un réglage. */
async function revenirAuJournal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Livre journal' }));
  await screen.findByRole('heading', { name: 'Livre de caisse' });
}

async function ajouterRecette(user: ReturnType<typeof userEvent.setup>, libelle = 'Recette test', montant = '15000') {
  await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
  const dialog = screen.getByRole('dialog', { name: 'Nouvelle recette' });
  await user.type(within(dialog).getByLabelText(/Libellé de l’écriture/), libelle);
  await user.type(within(dialog).getByLabelText(/Montant total/), montant);
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
}

describe('parcours de caisse', () => {
  it('crée, détaille, modifie, supprime puis restaure des écritures sans perdre les références', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await ajouterRecette(user);
    // Le masque garde les majuscules actives : le libellé est enregistré en capitales.
    expect(lire().ecritures[0]).toMatchObject({ libelle: 'RECETTE TEST', montant: 15000, numero: `RC-${annee}-0001` });

    await user.click(screen.getByRole('button', { name: 'Nouvelle dépense' }));
    const depense = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    await user.type(within(depense).getByLabelText(/Libellé de l’écriture/), 'Carburant ambulance');
    await user.click(within(depense).getByRole('button', { name: 'Détail par postes' }));
    // Un seul poste complété suffit : aucun autre champ n'est requis dans le détail.
    await user.type(within(depense).getByLabelText('Poste', { exact: true }), 'Gasoil');
    await user.type(within(depense).getByLabelText('Montant (Ar)', { exact: true }), '5000');
    await user.click(within(depense).getByRole('button', { name: 'Ajouter' }));
    expect(within(depense).queryByLabelText('Référence / quittance')).not.toBeInTheDocument();
    await user.click(within(depense).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[1]).toMatchObject({ montant: 5000, lignesDetail: [{ libelle: 'GASOIL', montant: 5000 }] });

    // Le bordereau s'ouvre automatiquement après enregistrement.
    const bordereau = screen.getByRole('dialog', { name: 'Bordereau imprimable' });
    expect(within(bordereau).getByRole('status')).toHaveTextContent('Écriture enregistrée');
    expect(within(bordereau).getByText(/Pièce DP-/)).toBeInTheDocument();
    // Le numéro du document figure dans le sous-titre de la modale et sous le titre.
    expect(bordereau).toHaveTextContent(`AED-${annee}-0001`);
    expect(within(bordereau).getByText('TOTAL DES DEPENSES')).toBeInTheDocument();
    await user.click(within(bordereau).getByRole('button', { name: 'Imprimer ce bordereau' }));
    expect(window.print).toHaveBeenCalledTimes(1);
    await user.click(within(bordereau).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog', { name: 'Bordereau imprimable' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Modifier RC-${annee}-0001` }));
    const edition = screen.getByRole('dialog', { name: `Modifier RC-${annee}-0001` });
    await user.clear(within(edition).getByLabelText(/Montant total/));
    await user.type(within(edition).getByLabelText(/Montant total/), '20000');
    await user.type(within(edition).getByLabelText('Référence de la pièce'), 'F-1');
    await user.type(within(edition).getByLabelText('Observation', { exact: true }), 'Note distincte');
    await user.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[0]).toMatchObject({ montant: 20000, reference: 'F-1', observation: 'Note distincte', numero: `RC-${annee}-0001` });

    await user.click(screen.getByRole('button', { name: `Supprimer DP-${annee}-0001` }));
    await user.click(screen.getByRole('dialog', { name: 'Supprimer cette écriture ?' }).querySelector('button.btn-danger')!);
    expect(lire().ecritures).toHaveLength(1);
    await user.click(screen.getAllByRole('button', { name: 'Annuler la suppression' })[0]);
    expect(lire().ecritures).toHaveLength(2);
    expect(lire().compteurs[`DP-${annee}`]).toBe(1);
  });

  it('personnalise l’en-tête commun et l’imprime sur les deux pièces', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    // Une pièce détaillée est nécessaire : le bordereau imprimable s'ouvre depuis le détail.
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const nouvelle = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(nouvelle).getByLabelText(/Libellé de l’écriture/), 'Recettes du jour');
    await user.type(within(nouvelle).getByLabelText(/Montant total/), '12000');
    await user.click(within(nouvelle).getByRole('button', { name: 'Détail par postes' }));
    await user.type(within(nouvelle).getByLabelText('Poste', { exact: true }), 'Consultations');
    await user.type(within(nouvelle).getByLabelText('Montant (Ar)', { exact: true }), '12000');
    await user.click(within(nouvelle).getByRole('button', { name: 'Ajouter' }));
    await user.click(within(nouvelle).getByRole('button', { name: 'Enregistrer' }));
    await ouvrirAdministration(user);
    await user.click(screen.getByRole('button', { name: /En-tête des bordereaux/ }));
    const modale = screen.getByRole('dialog', { name: 'En-tête des bordereaux' });
    // Un seul en-tête : la première ligne vaut pour les deux imprimés.
    await user.clear(within(modale).getByLabelText('Texte de la ligne 1'));
    await user.type(within(modale).getByLabelText('Texte de la ligne 1'), 'CAISSE CENTRALE SALFA');
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer l’en-tête' }));

    expect(lire().entetes.lignes[0].texte).toBe('CAISSE CENTRALE SALFA');
    await revenirAuJournal(user);

    // L'autorisation de recette reprend cet en-tête…
    await user.click(screen.getByRole('button', { name: `Imprimer le bordereau RC-${annee}-0001` }));
    const autorisation = screen.getByRole('dialog', { name: 'Bordereau imprimable' });
    expect(within(autorisation).getByText('CAISSE CENTRALE SALFA')).toBeInTheDocument();
    expect(within(autorisation).getByText('AUTORISATION DE RECETTES')).toBeInTheDocument();
    expect(autorisation).toHaveTextContent(`ARC-${annee}-0001`);
    await user.click(within(autorisation).getByRole('button', { name: 'Modifier l’en-tête' }));
    expect(screen.getByRole('dialog', { name: 'En-tête des bordereaux' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    // …et l'engagement de dépense aussi : c'est le même papier à en-tête.
    await user.click(screen.getByRole('button', { name: 'Nouvelle dépense' }));
    const depense = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    await user.type(within(depense).getByLabelText(/Libellé de l’écriture/), 'Achat urgent');
    await user.type(within(depense).getByLabelText(/Montant total/), '3000');
    await user.click(within(depense).getByRole('button', { name: 'Détail par postes' }));
    await user.type(within(depense).getByLabelText('Poste', { exact: true }), 'Achat urgent');
    await user.type(within(depense).getByLabelText('Montant (Ar)', { exact: true }), '3000');
    await user.click(within(depense).getByRole('button', { name: 'Ajouter' }));
    await user.click(within(depense).getByRole('button', { name: 'Enregistrer' }));
    await user.click(screen.getAllByRole('button', { name: `Imprimer le bordereau DP-${annee}-0001` })[0]);
    const engagement = screen.getByRole('dialog', { name: 'Bordereau imprimable' });
    expect(within(engagement).getByText('CAISSE CENTRALE SALFA')).toBeInTheDocument();
    // La demande d'engagement porte elle aussi son titre, sigle compris.
    expect(within(engagement).getByText('DEMANDE D’ENGAGEMENT DE DÉPENSES (DED)')).toBeInTheDocument();
    // Le document porte son propre numéro, aligné sur la pièce.
    expect(engagement).toHaveTextContent(`AED-${annee}-0001`);
    await user.click(within(engagement).getByRole('button', { name: 'Fermer' }));
  });

  it('restaure l’en-tête fourni, images comprises', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await ouvrirAdministration(user);
    await user.click(screen.getByRole('button', { name: /En-tête des bordereaux/ }));
    let modale = screen.getByRole('dialog', { name: 'En-tête des bordereaux' });
    // La feuille est le formulaire : on clique la deuxième ligne pour l'écrire.
    await user.click(within(modale).getByLabelText(/^Ligne 2/));
    await user.clear(within(modale).getByLabelText('Texte de la ligne 2'));
    await user.type(within(modale).getByLabelText('Texte de la ligne 2'), 'FLM — SYNODE');
    // Une image retirée doit revenir avec la restauration.
    await user.click(modale.querySelectorAll('.entete-feuille__image')[0]);
    await user.click(within(modale).getByRole('button', { name: /Retirer/ }));
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer l’en-tête' }));
    expect(lire().entetes.lignes[1].texte).toBe('FLM — SYNODE');
    expect(lire().entetes.images).toHaveLength(1);

    await ouvrirAdministration(user);
    await user.click(screen.getByRole('button', { name: /En-tête des bordereaux/ }));
    modale = screen.getByRole('dialog', { name: 'En-tête des bordereaux' });
    await user.click(within(modale).getByRole('button', { name: /Restaurer l’en-tête fourni/ }));
    await user.click(within(modale).getByLabelText(/^Ligne 2/));
    expect(within(modale).getByLabelText('Texte de la ligne 2')).toHaveValue('(ÉGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)');
    expect(modale.querySelectorAll('.entete-feuille__image')).toHaveLength(2);
    await user.click(within(modale).getByRole('button', { name: 'Enregistrer l’en-tête' }));
    expect(lire().entetes.lignes[1].texte).toBe('(ÉGLISE LUTHERIENNE MALGACHE - MALAGASY LUTHERAN CHURCH)');
    expect(lire().entetes.images).toHaveLength(2);
  });

  it('enregistre avec un seul poste renseigné et ignore les lignes vides', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const form = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(form).getByLabelText(/Libellé de l’écriture/), 'Recettes du matin');
    await user.click(within(form).getByRole('button', { name: 'Détail par postes' }));
    await user.type(within(form).getByLabelText('Poste', { exact: true }), 'CONSULTATION');
    await user.type(within(form).getByLabelText('Montant (Ar)', { exact: true }), '4000');
    await user.click(within(form).getByRole('button', { name: 'Ajouter' }));
    // Le formulaire d'ajout est laissé vide : il ne doit ni bloquer ni créer de poste.
    expect(within(form).getByLabelText('Poste', { exact: true })).toHaveValue('');
    expect(within(form).getByLabelText('Montant (Ar)', { exact: true })).toHaveValue('');
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[0]).toMatchObject({ montant: 4000, lignesDetail: [{ libelle: 'CONSULTATION', montant: 4000 }] });
    expect(lire().ecritures[0].lignesDetail).toHaveLength(1);
    // Le bordereau de la pièce s'ouvre immédiatement, sans recherche dans le journal.
    expect(screen.getByRole('dialog', { name: 'Bordereau imprimable' })).toBeInTheDocument();
  });

  it('refuse un détail sans aucun poste complété', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const form = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(form).getByLabelText(/Libellé de l’écriture/), 'Sans poste');
    await user.click(within(form).getByRole('button', { name: 'Détail par postes' }));
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Renseignez au moins un poste');
    // Rien n'a été enregistré : le livre n'existe même pas encore.
    expect(localStorage.getItem(CLE_LIVRE)).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Bordereau imprimable' })).not.toBeInTheDocument();
  });

  it('gère les catégories séparément pour les recettes et les dépenses', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await user.click(screen.getByRole('button', { name: 'Nouvelle dépense' }));
    const form = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    // Le formulaire de dépense propose « Gérer » à côté de la catégorie.
    await user.click(within(form).getByRole('button', { name: 'Gérer' }));
    const gestion = screen.getByRole('dialog', { name: 'Catégories de saisie' });
    await user.click(within(gestion).getByRole('tab', { name: /Dépenses/ }));
    await user.type(within(gestion).getByLabelText('Nouvelle catégorie'), 'Entretien du groupe');
    await user.click(within(gestion).getByRole('button', { name: 'Ajouter' }));
    await user.click(within(gestion).getByRole('button', { name: 'Enregistrer' }));

    // Seules les catégories de dépenses ont changé.
    const livre = lire();
    expect(livre.categories.depense).toContain('Entretien du groupe');
    expect(livre.categories.recette).not.toContain('Entretien du groupe');
    expect(livre.categories.recette).toContain('Consultations');

    // La nouvelle catégorie est proposée dans le formulaire de dépense…
    const apres = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    expect(within(apres).getByLabelText('Catégorie *')).toHaveValue(livre.categories.depense[0]);
    await user.selectOptions(within(apres).getByLabelText('Catégorie *'), 'Entretien du groupe');
    expect(within(apres).getByLabelText('Catégorie *')).toHaveValue('Entretien du groupe');
    await user.click(within(apres).getByRole('button', { name: 'Annuler' }));
    // …et absente de celui des recettes.
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const recette = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    expect(within(recette).queryByRole('option', { name: 'Entretien du groupe' })).not.toBeInTheDocument();
  });

  it('conserve la saisie et affiche une erreur explicite quand le stockage est plein', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(dialog).getByLabelText(/Libellé de l’écriture/), 'À conserver');
    await user.type(within(dialog).getByLabelText(/Montant total/), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('stockage du navigateur est plein');
    expect(within(dialog).getByLabelText(/Libellé de l’écriture/)).toHaveValue('À CONSERVER');
    expect(localStorage.getItem(CLE_LIVRE)).toBeNull();
    spy.mockRestore();
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[0].libelle).toBe('À CONSERVER');
  });

  it('refuse une écriture basée sur une révision périmée par un autre onglet', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(dialog).getByLabelText(/Libellé de l’écriture/), 'Ma saisie');
    await user.type(within(dialog).getByLabelText(/Montant total/), '1000');
    sauvegarderLivre(livreTest({ ecritures: [ecritureTest({ libelle: 'Autre onglet' })] }), 0);
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('autre onglet');
    expect(lire().ecritures).toHaveLength(1);
    expect(lire().ecritures[0].libelle).toBe('Autre onglet');
  });

  it('crée un modèle avec montant par défaut et le réutilise dans une recette', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await ouvrirAdministration(user);
    await user.click(screen.getByRole('button', { name: /Modèles de saisie/ }));
    const gestion = screen.getByRole('dialog', { name: 'Modèles de saisie' });
    await user.click(within(gestion).getByRole('button', { name: 'Nouveau modèle' }));
    const form = screen.getByRole('dialog', { name: 'Nouveau modèle de saisie' });
    await user.type(within(form).getByLabelText(/Nom du modèle/), 'Test modèle');
    await user.type(within(form).getByLabelText('Libellé', { exact: true }), 'CONSULTATION');
    await user.type(within(form).getByLabelText('Montant par défaut', { exact: true }), '500');
    await user.click(within(form).getByRole('button', { name: 'Ajouter' }));
    await user.click(within(form).getByRole('button', { name: 'Enregistrer le modèle' }));
    const modele = lire().masques.find(m => m.nom === 'Test modèle')!;
    expect(modele.lignes[0].montantDefaut).toBe(500);
    await user.click(screen.getByRole('dialog', { name: 'Modèles de saisie' }).querySelector('button.btn-secondary')!);
    await revenirAuJournal(user);
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const saisie = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(saisie).getByLabelText(/Libellé de l’écriture/), 'Recette modèle');
    await user.click(within(saisie).getByRole('button', { name: 'Détail par postes' }));
    await user.selectOptions(within(saisie).getByLabelText('Modèle de bordereau'), modele.id);
    expect(within(saisie).getByLabelText('Montant du poste 1')).toHaveValue('500');
    await user.click(within(saisie).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[0].montant).toBe(500);
  });

  it('vérifie un import, refuse un JSON invalide et restaure après confirmation avec sauvegarde préalable', async () => {
    sauvegarderLivre(livreTest({ ecritures: [ecritureTest()] }), 0);
    const user = userEvent.setup();
    render(<App />);
    await ouvrirSession(user);
    await user.click(screen.getAllByRole('button', { name: 'Données & sauvegardes' })[0]);
    const input = screen.getByLabelText('Fichier de sauvegarde JSON');
    await user.upload(input, new File(['{'], 'invalide.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON valide');
    expect(lire().ecritures[0].libelle).toBe('Recettes du jour');
    const contenu = JSON.stringify(livreTest({ ecritures: [ecritureTest({ id: 'restore', numero: 'RC-2026-0099', libelle: 'Livre restauré' })] }));
    await user.upload(input, new File([contenu], 'valide.json', { type: 'application/json' }));
    await user.click(await screen.findByRole('button', { name: 'Restaurer cette sauvegarde' }));
    const confirmation = screen.getByRole('dialog', { name: 'Remplacer le livre actuel ?' });
    expect(within(confirmation).getByRole('button', { name: 'Restaurer et remplacer' })).toBeDisabled();
    await user.click(within(confirmation).getByRole('checkbox'));
    await user.click(within(confirmation).getByRole('button', { name: 'Restaurer et remplacer' }));
    expect(lire().ecritures[0].libelle).toBe('Livre restauré');
    expect(URL.createObjectURL).toHaveBeenCalled();
    await user.click(screen.getAllByRole('button', { name: 'Livre journal' })[0]);
    expect(screen.getByText('Livre restauré')).toBeInTheDocument();
  });

  it('ne présente pas un stockage corrompu comme un livre vide et migre une seule fois en mode strict', async () => {
    localStorage.setItem(CLE_LIVRE, '{corrompu');
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await ouvrirSession(user);
    expect(screen.getByRole('alert')).toHaveTextContent('illisibles');
    expect(screen.getByRole('button', { name: 'Nouvelle recette' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    unmount();
    localStorage.clear();
    localStorage.setItem(CLE_ECRITURES, JSON.stringify([{ id: 'ancien', type: 'RECETTE', date: aujourdHui(), montant: 1000, libelle: 'Ancienne recette', modePaiement: 'Chèque' }]));
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    render(<React.StrictMode><App /></React.StrictMode>);
    await ouvrirSession(user);
    expect(await screen.findByText('Ancienne recette')).toBeInTheDocument();
    expect(lire().ecritures[0].mode).toBe('Chèque');
    expect(spy.mock.calls.filter(c => c[0] === CLE_LIVRE)).toHaveLength(1);
    expect(localStorage.getItem(CLE_ECRITURES)).toBeTruthy();
  });

  it('ouvre la caisse sur la page de connexion et refuse un mauvais mot de passe', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Aucun écran de caisse avant la connexion.
    expect(screen.getByRole('heading', { name: /Connexion à la caisse/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouvelle recette' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais-mot-de-passe');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion refusée');
    expect(screen.queryByRole('button', { name: 'Nouvelle recette' })).not.toBeInTheDocument();

    // Le bon mot de passe ouvre la caisse.
    await user.clear(screen.getByLabelText('Mot de passe'));
    await user.type(screen.getByLabelText('Mot de passe'), 'admin1234');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(await screen.findByRole('heading', { name: 'Livre de caisse' })).toBeInTheDocument();
  });

  it('restreint ce que chaque rôle peut ouvrir', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    // La caissière ne voit que le livre journal.
    await ouvrirSession(user, 'caisse', 'caisse1234');
    expect(screen.queryByRole('button', { name: 'Analyse de la caisse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Livre journal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle recette' })).toBeInTheDocument();
    unmount();

    // Le comptable consulte le journal et l'analyse, sans saisir ni administrer.
    render(<App />);
    await ouvrirSession(user, 'comptable', 'compta1234');
    expect(screen.getByRole('button', { name: 'Analyse de la caisse' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouvelle recette' })).not.toBeInTheDocument();
    expect(screen.getByText(/Consultation seule/)).toBeInTheDocument();
  });

  it('réserve la modification du solde d’ouverture à l’administrateur', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    // L'administrateur voit le crayon.
    await ouvrirSession(user);
    expect(screen.getByRole('button', { name: 'Modifier le solde d’ouverture du livre' })).toBeInTheDocument();
    unmount();

    // Le comptable lit le solde, sans pouvoir y toucher.
    render(<App />);
    await ouvrirSession(user, 'comptable', 'compta1234');
    expect(screen.queryByRole('button', { name: 'Modifier le solde d’ouverture du livre' })).not.toBeInTheDocument();
    expect(screen.getByText('Lecture seule')).toBeInTheDocument();
    unmount();

    // La caissière non plus.
    render(<App />);
    await ouvrirSession(user, 'caisse', 'caisse1234');
    expect(screen.queryByRole('button', { name: 'Modifier le solde d’ouverture du livre' })).not.toBeInTheDocument();
  });

  it('interdit de clôturer l’année en cours : la clôture n’est ouverte qu’au 1er janvier suivant', async () => {
    const user = userEvent.setup();
    const annee = new Date().getFullYear();
    sauvegarderLivre(livreTest(enregistrerEcriture(livreTest(), ecritureTest({ date: `${annee}-03-01` }))), 0);
    render(<App />);
    await ouvrirSession(user);
    // Aucune bannière de retard : l'année est encore en cours.
    expect(screen.queryByText(`L’exercice ${annee} doit être clôturé.`)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Exercices & clôtures' })[0]);
    expect(screen.getByText(`À partir du 1er janvier ${annee + 1}`)).toBeInTheDocument();
    // Le bouton est désactivé : aucun dialogue de clôture ne peut s'ouvrir.
    const bouton = screen.getByRole('button', { name: `Clôturer l’exercice ${annee}` });
    expect(bouton).toBeDisabled();
    await user.click(bouton);
    expect(screen.queryByRole('dialog', { name: `Clôturer l’exercice ${annee} ?` })).not.toBeInTheDocument();
    expect(screen.getByText(`Clôture possible à partir du 1er janvier ${annee + 1}, une fois l’année révolue.`)).toBeInTheDocument();
    const stocke = lire();
    expect(stocke.parametres.exercice).toBe(annee);
    expect(stocke.ecritures).toHaveLength(1);
    expect(stocke.exercicesClotures).toHaveLength(0);
  });

  it('clôture l’exercice, reporte le solde et bloque toute saisie sur l’année close', async () => {
    const user = userEvent.setup();
    const annee = new Date().getFullYear();
    // Livre d'une année révolue : la saisie doit être bloquée jusqu'à la clôture.
    let donnees = enregistrerEcriture(livreTest({ parametres: parametresTest({ soldeInitial: 1000, exercice: annee - 1 }) }),
      ecritureTest({ date: `${annee - 1}-12-24`, montant: 5000 }));
    donnees = enregistrerEcriture(donnees, ecritureTest({ id: 'e-dep', numero: `DP-${annee - 1}-0001`, sens: 'DEPENSE', categorie: 'Divers', date: `${annee - 1}-12-28`, montant: 2000 }));
    sauvegarderLivre(livreTest(donnees), 0);
    render(<App />);
    await ouvrirSession(user);
    expect(screen.getByText(`L’exercice ${annee - 1} doit être clôturé.`)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: `Clôturer l’exercice ${annee - 1}` })[0]);
    const dialogue = screen.getByRole('dialog', { name: `Clôturer l’exercice ${annee - 1} ?` });
    expect(within(dialogue).getByText('4 000 Ar')).toBeInTheDocument();
    await user.click(within(dialogue).getByRole('button', { name: new RegExp(`Clôturer ${annee - 1} et ouvrir ${annee}`) }));

    const stocke = lire();
    expect(stocke.parametres).toEqual({ soldeInitial: 4000, exercice: annee, reportPrecedent: { annee: annee - 1, solde: 4000 } });
    expect(stocke.ecritures).toHaveLength(0);
    expect(stocke.exercicesClotures).toHaveLength(1);
    expect(stocke.exercicesClotures[0]).toMatchObject({ annee: annee - 1, recettes: 5000, depenses: 2000, soldeCloture: 4000 });
    expect(stocke.exercicesClotures[0].ecritures).toHaveLength(2);

    // L'onglet Exercices expose l'archive et l'exercice en cours.
    await user.click(screen.getAllByRole('button', { name: 'Exercices & clôtures' })[0]);
    expect(screen.getByRole('heading', { name: `Exercice en cours · ${annee}` })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Exercices clôturés' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Télécharger l’archive ${annee - 1}` })).toBeInTheDocument();
    // La saisie est de nouveau possible, sur le nouvel exercice.
    await user.click(screen.getAllByRole('button', { name: 'Livre journal' })[0]);
    await ajouterRecette(user, 'Recette nouvelle année', '1500');
    expect(lire().ecritures[0]).toMatchObject({ montant: 1500, numero: `RC-${annee}-0001` });
  });
});

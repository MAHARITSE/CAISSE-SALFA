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
    await ajouterRecette(user);
    expect(lire().ecritures[0]).toMatchObject({ libelle: 'Recette test', montant: 15000, numero: `RC-${annee}-0001` });

    await user.click(screen.getByRole('button', { name: 'Nouvelle dépense' }));
    const depense = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    await user.type(within(depense).getByLabelText(/Libellé de l’écriture/), 'Carburant ambulance');
    await user.click(within(depense).getByRole('button', { name: 'Détail par postes' }));
    await user.type(within(depense).getByLabelText('Poste', { exact: true }), 'Gasoil');
    await user.type(within(depense).getByLabelText('Référence / quittance'), 'Q-1');
    await user.type(within(depense).getByLabelText('Montant (Ar)', { exact: true }), '5000');
    await user.click(within(depense).getByRole('button', { name: 'Ajouter' }));
    await user.click(within(depense).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[1]).toMatchObject({ montant: 5000, lignesDetail: [{ libelle: 'Gasoil', reference: 'Q-1', montant: 5000 }] });

    await user.click(screen.getByRole('button', { name: /1 postes/ }));
    expect(screen.getByText('Q-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Bordereau DP-${annee}-0001` }));
    const bordereau = screen.getByRole('dialog', { name: 'Bordereau imprimable' });
    expect(within(bordereau).getByText('Total des dépenses')).toBeInTheDocument();
    await user.click(within(bordereau).getByRole('button', { name: 'Imprimer ce bordereau' }));
    expect(window.print).toHaveBeenCalledTimes(1);
    await user.click(within(bordereau).getByRole('button', { name: 'Fermer' }));

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

  it('conserve la saisie et affiche une erreur explicite quand le stockage est plein', async () => {
    const user = userEvent.setup();
    render(<App />);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await user.click(screen.getByRole('button', { name: 'Nouvelle recette' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(dialog).getByLabelText(/Libellé de l’écriture/), 'À conserver');
    await user.type(within(dialog).getByLabelText(/Montant total/), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('stockage du navigateur est plein');
    expect(within(dialog).getByLabelText(/Libellé de l’écriture/)).toHaveValue('À conserver');
    expect(localStorage.getItem(CLE_LIVRE)).toBeNull();
    spy.mockRestore();
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(lire().ecritures[0].libelle).toBe('À conserver');
  });

  it('refuse une écriture basée sur une révision périmée par un autre onglet', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    await user.click(screen.getByRole('button', { name: 'Modèles de saisie' }));
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
    const { unmount } = render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('illisibles');
    expect(screen.getByRole('button', { name: 'Nouvelle recette' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    unmount();
    localStorage.clear();
    localStorage.setItem(CLE_ECRITURES, JSON.stringify([{ id: 'ancien', type: 'RECETTE', date: aujourdHui(), montant: 1000, libelle: 'Ancienne recette', modePaiement: 'Chèque' }]));
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    render(<React.StrictMode><App /></React.StrictMode>);
    expect(await screen.findByText('Ancienne recette')).toBeInTheDocument();
    expect(lire().ecritures[0].mode).toBe('Chèque');
    expect(spy.mock.calls.filter(c => c[0] === CLE_LIVRE)).toHaveLength(1);
    expect(localStorage.getItem(CLE_ECRITURES)).toBeTruthy();
  });

  it('interdit de clôturer l’année en cours : la clôture n’est ouverte qu’au 1er janvier suivant', async () => {
    const user = userEvent.setup();
    const annee = new Date().getFullYear();
    sauvegarderLivre(livreTest(enregistrerEcriture(livreTest(), ecritureTest({ date: `${annee}-03-01` }))), 0);
    render(<App />);
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

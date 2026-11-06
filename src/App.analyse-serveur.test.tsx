import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Ecriture, Sauvegarde } from './types';
import { ecritureTest, livreTest, parametresTest } from './test/fixtures';
import { aujourdHui } from './utils/format';

const api = vi.hoisted(() => ({ charger: vi.fn(), enregistrer: vi.fn() }));
vi.mock('./utils/api', () => ({
  MODE_API: true,
  ErreurApi: class extends Error {},
  sante: vi.fn(() => Promise.resolve({ revision: 4, versionApi: '1.3.0' })),
  session: vi.fn(() => Promise.resolve({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' } })),
  chargerLivreApi: api.charger,
  normaliserLivreServeur: (livre: Sauvegarde) => livre,
  deconnexion: vi.fn(), exporterSql: vi.fn(), configurerServeur: vi.fn(), connexion: vi.fn(),
  mutations: { ecriture: api.enregistrer },
}));

import App from './App';

describe('correction de catégorie en mode serveur', () => {
  it('envoie la pièce complète avec la révision puis affiche le livre renvoyé', async () => {
    const date = aujourdHui();
    const annee = Number(date.slice(0, 4));
    const piece = ecritureTest({ id: 'dep-serveur', numero: `DP-${annee}-0001`, date, sens: 'DEPENSE', categorie: 'Divers', montant: 5000,
      lignesDetail: [{ id: 'detail-serveur', libelle: 'ACHAT', montant: 5000 }], reference: 'REFERENCE' });
    const livre = livreTest({ revision: 4, parametres: parametresTest({ exercice: annee }), ecritures: [piece] });
    api.charger.mockResolvedValue(livre);
    api.enregistrer.mockImplementation(async (_revision: number, ecriture: Ecriture) => ({ livre: { ...livre, revision: 5, ecritures: [ecriture] } }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    await user.click(screen.getByRole('button', { name: 'Analyse de la caisse' }));
    await user.click(screen.getByRole('button', { name: 'Aperçu : Répartition des dépenses' }));
    const dialogue = screen.getByRole('dialog', { name: 'Aperçu des dépenses (1 pièce(s))' });
    await user.selectOptions(within(dialogue).getByLabelText(`Catégorie de DP-${annee}-0001`), 'Carburant & transport');
    await user.click(within(dialogue).getByRole('button', { name: `Enregistrer la catégorie de DP-${annee}-0001` }));
    expect(api.enregistrer).toHaveBeenCalledOnce();
    expect(api.enregistrer).toHaveBeenCalledWith(4, { ...piece, categorie: 'Carburant & transport' });
    expect(await within(dialogue).findByRole('status')).toHaveTextContent('enregistrée');
    expect(within(dialogue).getByLabelText(`Catégorie de DP-${annee}-0001`)).toHaveValue('Carburant & transport');
  });
});

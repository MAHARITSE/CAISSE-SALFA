import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { livreTest, ecritureTest, parametresTest } from './test/fixtures';
import { aujourdHui } from './utils/format';
import type { Ecriture, Sauvegarde } from './types';

const api = vi.hoisted(() => ({ charger: vi.fn(), enregistrer: vi.fn() }));
vi.mock('./utils/api', () => ({
  MODE_API: true, ErreurApi: class extends Error {},
  sante: vi.fn(async () => ({ revision: 1, versionApi: '1.3.0' })),
  session: vi.fn(async () => ({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' } })),
  chargerLivreApi: api.charger, normaliserLivreServeur: (livre: Sauvegarde) => livre,
  lireMessages: vi.fn(async () => ({ comptes: [], messages: [] })), lireDemandes: vi.fn(async () => []),
  deconnexion: vi.fn(), exporterSql: vi.fn(), configurerServeur: vi.fn(), connexion: vi.fn(),
  mutations: { ecriture: api.enregistrer },
}));
import App from './App';

describe('saisie en présence de modifications concurrentes', () => {
  it('actualise et enregistre une nouvelle pièce sans perdre l’autre écriture', async () => {
    const annee = Number(aujourdHui().slice(0, 4));
    const initial = livreTest({ revision: 1, parametres: parametresTest({ exercice: annee }), ecritures: [] });
    const autre = ecritureTest({ id: 'autre', numero: `RC-${annee}-0001`, date: aujourdHui() });
    const recent = { ...initial, revision: 2, ecritures: [autre] };
    api.charger.mockReset().mockResolvedValueOnce(initial).mockResolvedValueOnce(recent);
    api.enregistrer.mockReset().mockRejectedValueOnce({ code: 'conflit_revision' }).mockImplementationOnce(async (_r: number, e: Ecriture) => ({ livre: { ...recent, revision: 3, ecritures: [autre, { ...e, numero: `RC-${annee}-0002` }] } }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    await user.click(await screen.findByRole('button', { name: 'Nouvelle recette' }));
    const dialogue = screen.getByRole('dialog', { name: 'Nouvelle recette' });
    await user.type(within(dialogue).getByLabelText(/Libellé de l’écriture/), 'Nouvelle recette');
    await user.type(within(dialogue).getByLabelText(/Montant total/), '5000');
    await user.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    const journal = await screen.findByRole('table', { name: /Écritures de la caisse/ });
    expect(within(journal).getByText('NOUVELLE RECETTE')).toBeInTheDocument();
    expect(api.enregistrer.mock.calls.map(c => c[0])).toEqual([1, 2]);
    expect(api.enregistrer.mock.calls[0][1].id).toBe(api.enregistrer.mock.calls[1][1].id);
    expect(within(journal).getByText(`RC-${annee}-0002`)).toBeInTheDocument();
    const bordereau = await screen.findByRole('dialog', { name: 'Bordereau imprimable' });
    expect(bordereau).toHaveTextContent('NOUVELLE RECETTE');
    expect(within(bordereau).getByRole('button', { name: 'Imprimer' })).toBeInTheDocument();
  });
});

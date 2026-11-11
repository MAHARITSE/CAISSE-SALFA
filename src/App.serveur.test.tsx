import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const livreIncomplet = {
  format: 'CAISSE-SALFA', version: 1, revision: 0, updatedAt: new Date().toISOString(),
  ecritures: [], parametres: { soldeInitial: 0, exercice: 2026, reportPrecedent: null },
  masques: [], compteurs: {}, exercicesClotures: [],
};

vi.mock('./utils/api', () => ({
  MODE_API: true,
  ErreurApi: class extends Error {},
  sante: vi.fn(() => Promise.resolve({ revision: 0, exercice: 2026, versionApi: '1.3.0' })),
  session: vi.fn(() => Promise.resolve({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' } })),
  chargerLivreApi: vi.fn(() => Promise.resolve(livreIncomplet)),
  deconnexion: vi.fn(), exporterSql: vi.fn(), configurerServeur: vi.fn(), connexion: vi.fn(),
  mutations: new Proxy({}, { get: () => vi.fn() }),
}));

// eslint-disable-next-line import/first
import App from './App';
import { session as sessionApi } from './utils/api';

describe('mode serveur : livre incomplet', () => {
  it('vérifie la session au retour dans l’onglet et déconnecte si elle a expiré', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    const sessionMock = vi.mocked(sessionApi);
    sessionMock.mockResolvedValueOnce({ connecte: false, utilisateur: null });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sessionMock).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Connexion à la caisse/ })).toBeInTheDocument();
  });
  it('affiche le journal sans planter', async () => {
    const messages: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { messages.push(a.map(String).join(' ')); });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Livre de caisse' })).toBeTruthy();
    spy.mockRestore();
    expect(messages.filter(m => /Cannot read|undefined/.test(m))).toEqual([]);
  });
});

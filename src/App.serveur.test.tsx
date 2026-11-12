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
  sante: vi.fn(() => Promise.resolve({ revision: 0, exercice: 2026, versionApi: '1.4.0' })),
  session: vi.fn(() => Promise.resolve({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' }, dureeSession: 1800 })),
  chargerLivreApi: vi.fn(() => Promise.resolve(livreIncomplet)),
  deconnexion: vi.fn(), exporterSql: vi.fn(), configurerServeur: vi.fn(), connexion: vi.fn(),
  mutations: new Proxy({}, { get: () => vi.fn() }),
}));

// eslint-disable-next-line import/first
import App from './App';
import { session as sessionApi } from './utils/api';

describe('mode serveur : livre incomplet', () => {
  it('déconnecte quand le serveur déclare la session fermée, en expliquant pourquoi', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    const sessionMock = vi.mocked(sessionApi);
    sessionMock.mockResolvedValue({ connecte: false, utilisateur: null });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sessionMock).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Connexion à Caisse et Trésorerie/ })).toBeInTheDocument();
    // L'utilisateur sait pourquoi la caisse s'est refermée, au lieu de le deviner.
    expect(screen.getByRole('status')).toHaveTextContent(/session/i);
    sessionMock.mockReset();
    sessionMock.mockImplementation(() => Promise.resolve({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' }, dureeSession: 1800 }));
  });

  it('garde la caisse ouverte quand une coupure réseau empêche de vérifier la session', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    const sessionMock = vi.mocked(sessionApi);
    sessionMock.mockRejectedValue(new Error('Le serveur de la caisse est injoignable.'));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sessionMock).toHaveBeenCalled();
    // Une panne réseau n'est pas une déconnexion : la saisie reste accessible.
    expect(screen.getByRole('heading', { name: 'Livre de caisse' })).toBeInTheDocument();
    sessionMock.mockReset();
    sessionMock.mockImplementation(() => Promise.resolve({ connecte: true, utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' }, dureeSession: 1800 }));
  });

  it('garde la caisse ouverte après une pause de quelques minutes, session confirmée par le serveur', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Livre de caisse' });
    const sessionMock = vi.mocked(sessionApi);
    // Ce que fait un onglet resté ouvert : le serveur renouvelle la présence.
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sessionMock.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: 'Livre de caisse' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Connexion à Caisse et Trésorerie/ })).not.toBeInTheDocument();
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

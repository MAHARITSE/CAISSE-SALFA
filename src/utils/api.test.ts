import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi, chargerLivreApi, connexion, mutations } from './api';
import { ecritureTest, livreTest } from '../test/fixtures';

const livre = livreTest({ ecritures: [ecritureTest({ id: 'e-api', numero: 'RC-2026-0001' })] });

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
}

/** Réponse HTML : ce que renvoie Apache quand mod_rewrite est désactivé. */
function reponseHtml404(): Response {
  return new Response('<!DOCTYPE html><title>404</title>', { status: 404, headers: { 'Content-Type': 'text/html' } });
}

describe('client de l’API WAMP', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('charge le livre depuis le serveur', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ ok: true, livre }));
    await expect(chargerLivreApi()).resolves.toMatchObject({ format: 'CAISSE-SALFA' });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/api\/livre\.php$/);
  });

  it('transmet la révision attendue avec chaque mutation', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ ok: true, livre }));
    const ecriture = livre.ecritures[0];
    await mutations.ecriture(livre.revision, ecriture);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({ revision: livre.revision, ecriture: { id: ecriture.id } });
  });

  it('appelle un fichier réel par point d’API, sans index.php', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reponseJson({ ok: true, livre })));
    await chargerLivreApi();
    await mutations.cloture(3, {});
    await mutations.supprimer(4, 'e-1');
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      expect.stringMatching(/api\/livre\.php$/),
      expect.stringMatching(/api\/cloture\.php$/),
      expect.stringMatching(/api\/ecritures-supprimer\.php$/),
    ]);
    expect(urls.join(' ')).not.toContain('index.php');
  });

  it('explique un fichier d’API absent au lieu d’une erreur générique', async () => {
    fetchMock.mockResolvedValue(reponseHtml404());
    await expect(chargerLivreApi()).rejects.toMatchObject({ code: 'point_absent', statut: 404 });
  });

  it('reprend le message du serveur en cas de conflit de révision', async () => {
    fetchMock.mockResolvedValue(reponseJson(
      { ok: false, erreur: 'Le livre a été modifié dans un autre onglet.', code: 'conflit_revision' },
      409,
    ));
    const erreur = await chargerLivreApi().then(() => null, (e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur).toMatchObject({ code: 'conflit_revision', statut: 409, message: 'Le livre a été modifié dans un autre onglet.' });
  });

  it('signale un serveur injoignable sans masquer la cause', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(chargerLivreApi()).rejects.toMatchObject({ code: 'reseau' });
  });

  it('refuse une réponse qui n’est pas du JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
    await expect(chargerLivreApi()).rejects.toMatchObject({ code: 'reponse_invalide', statut: 500 });
  });

  it('renvoie l’utilisateur connecté après une connexion réussie', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({
      ok: true, connecte: true,
      utilisateur: { id: 1, identifiant: 'admin', nomComplet: 'Administrateur', role: 'admin' },
    }));
    await expect(connexion('admin', 'motdepasse')).resolves.toMatchObject({
      connecte: true, utilisateur: { identifiant: 'admin', role: 'admin' },
    });
  });
});

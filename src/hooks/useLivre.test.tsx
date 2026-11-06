import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { livreTest } from '../test/fixtures';

/**
 * Sur le serveur WAMP, **la base MySQL est la seule source de vérité**.
 *
 * Ces tests verrouillent cette règle : en mode serveur, le livre ne doit être
 * ni lu ni écrit dans le stockage du navigateur. Un livre laissé par une
 * ancienne session de démonstration ne doit jamais apparaître, et une
 * modification ne doit jamais laisser de trace locale.
 */
const { chargerLivreApi, chargerLivre } = vi.hoisted(() => ({
  chargerLivreApi: vi.fn(),
  chargerLivre: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  MODE_API: true,
  chargerLivreApi,
  mutations: {},
}));

// Toute lecture du stockage local est un échec : on la remplace par une fonction
// qui échoue si elle est appelée.
vi.mock('../utils/storage', async () => {
  const reel = await vi.importActual<typeof import('../utils/storage')>('../utils/storage');
  return {
    ...reel,
    chargerLivre,
    sauvegarderLivre: vi.fn(() => { throw new Error('Le stockage du navigateur ne doit pas être écrit en mode serveur.'); }),
  };
});

// eslint-disable-next-line import/first
import { useLivre } from './useLivre';

describe('useLivre en mode serveur (100 % MySQL)', () => {
  const getItem = vi.fn();
  const setItem = vi.fn();

  beforeEach(() => {
    chargerLivreApi.mockReset();
    chargerLivre.mockReset();
    getItem.mockReset();
    setItem.mockReset();
    // Le stockage du navigateur existe, mais ne doit jamais être interrogé.
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem: vi.fn(), clear: vi.fn() });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('démarre avec un livre vide, sans lire le stockage du navigateur', () => {
    chargerLivreApi.mockResolvedValue(livreTest());
    renderHook(() => useLivre());

    expect(chargerLivre).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('affiche le livre renvoyé par le serveur', async () => {
    const livre = livreTest({ ecritures: [] });
    chargerLivreApi.mockResolvedValue(livre);
    const { result } = renderHook(() => useLivre());

    await waitFor(() => expect(result.current.livre.format).toBe('CAISSE-SALFA'));
    expect(chargerLivre).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('refuse toute mutation locale : le serveur seul écrit', () => {
    chargerLivreApi.mockResolvedValue(livreTest());
    const { result } = renderHook(() => useLivre());

    // `muter` est la voie du stockage navigateur : elle ne fait rien ici.
    expect(result.current.muter(d => d)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });
});

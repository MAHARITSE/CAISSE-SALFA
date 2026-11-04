import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLE_ECRITURES, CLE_LIVRE, CLE_PARAMETRES } from './storage';
import { amorcer, modeDemo } from './amorce';

const livre = { format: 'CAISSE-SALFA', version: 1, revision: 4, ecritures: [{ id: 'e1' }] };

const reponseJson = (valeur: unknown): Response => ({ ok: true, status: 200, json: async () => valeur }) as unknown as Response;
const echec = (statut: number): Response => ({ ok: false, status: statut, json: async () => ({}) }) as unknown as Response;

describe('amorçage du jeu d’essai', () => {
  const charger = vi.fn(async (_url: string) => reponseJson(livre));

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    charger.mockClear();
  });

  it('installe le jeu d’essai quand aucun livre n’existe', async () => {
    expect(await amorcer({ charger })).toBe(true);
    const enregistre = JSON.parse(localStorage.getItem(CLE_LIVRE)!);
    expect(enregistre.ecritures).toHaveLength(1);
    expect(enregistre.revision).toBe(0);
    expect(charger).toHaveBeenCalledWith('demo/jeu-essai.json', { cache: 'no-store' });
  });

  it('ne touche jamais à un livre existant sans demande explicite', async () => {
    localStorage.setItem(CLE_LIVRE, JSON.stringify({ ...livre, revision: 9 }));
    expect(await amorcer({ charger })).toBe(false);
    expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).revision).toBe(9);
    expect(charger).not.toHaveBeenCalled();
  });

  it('remplace sur demande explicite en conservant l’ancien livre', async () => {
    localStorage.setItem(CLE_LIVRE, JSON.stringify({ ...livre, revision: 9 }));
    expect(await amorcer({ charger, forcer: true })).toBe(true);
    expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).revision).toBe(0);
    const copie = Object.keys(sessionStorage).find(cle => cle.startsWith('essai_precedent_') && cle.endsWith(CLE_LIVRE));
    expect(copie).toBeDefined();
    expect(JSON.parse(sessionStorage.getItem(copie!)!).revision).toBe(9);
  });

  it('respecte ?demo=0 et ?demo=1', async () => {
    expect(await amorcer({ charger, mode: '0' })).toBe(false);
    expect(charger).not.toHaveBeenCalled();

    localStorage.setItem(CLE_LIVRE, JSON.stringify({ ...livre, revision: 7 }));
    expect(await amorcer({ charger, mode: '1' })).toBe(true);
    expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).revision).toBe(0);
  });

  it('efface les anciennes clés éclatées qui reprendraient le dessus', async () => {
    localStorage.setItem(CLE_ECRITURES, JSON.stringify([{ id: 'ancien' }]));
    localStorage.setItem(CLE_PARAMETRES, JSON.stringify({ soldeInitial: 0 }));
    expect(await amorcer({ charger })).toBe(true);
    expect(localStorage.getItem(CLE_ECRITURES)).toBeNull();
    expect(localStorage.getItem(CLE_PARAMETRES)).toBeNull();
  });

  it('ne charge qu’une fois par session', async () => {
    expect(await amorcer({ charger })).toBe(true);
    localStorage.removeItem(CLE_LIVRE);
    expect(await amorcer({ charger })).toBe(false);
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('signale un fichier absent ou illisible sans casser la page', async () => {
    await expect(amorcer({ charger: async () => echec(404) })).rejects.toThrow('introuvable (404)');
    await expect(amorcer({ charger: async () => reponseJson({ format: 'AUTRE' }) })).rejects.toThrow('illisible');
    expect(localStorage.getItem(CLE_LIVRE)).toBeNull();
  });

  it('lit le paramètre ?demo= sans lever d’exception', () => {
    expect(modeDemo('?demo=1')).toBe('1');
    expect(modeDemo('?a=2&demo=off')).toBe('off');
    expect(modeDemo('')).toBe('');
  });
});

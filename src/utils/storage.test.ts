import { describe, expect, it, vi } from 'vitest';
import { livreTest } from '../test/fixtures';
import { CLE_ECRITURES, CLE_LIVRE, CLE_MASQUES, CLE_PARAMETRES, chargerLivre, sauvegarderLivre } from './storage';

describe('persistance et migration', () => {
  it('reprend les anciennes données sans perdre le mode ni les références, et répare les totaux détaillés', () => {
    const brut = JSON.stringify([{ id: 'old', type: 'recette', date: '2026-11-03', montant: 99999, libelle: 'Recettes', modePaiement: 'Espèces', reference: 'F-1', lignesDetail: [{ id: 'd', libelle: 'Consultation', reference: 'Q-1', montant: 10000 }] }]);
    localStorage.setItem(CLE_ECRITURES, brut);
    localStorage.setItem(CLE_PARAMETRES, JSON.stringify({ soldeInitial: 500 }));
    localStorage.setItem(CLE_MASQUES, '[]');
    const chargement = chargerLivre();
    expect(chargement.erreur).toBeNull();
    expect(chargement.migration).toBe(true);
    expect(chargement.livre.ecritures[0]).toMatchObject({ sens: 'RECETTE', montant: 10000, mode: 'Espèces', numero: 'RC-2026-0001' });
    expect(chargement.livre.ecritures[0].lignesDetail?.[0].reference).toBe('Q-1');
    expect(chargement.livre.masques).toEqual([]);
    expect(chargement.avertissement).toContain('recalculés');
    expect(localStorage.getItem(CLE_ECRITURES)).toBe(brut);
    expect(localStorage.getItem(CLE_LIVRE)).toBeNull();
  });
  it('attribue les numéros manquants après avoir recensé les numéros existants', () => {
    localStorage.setItem(CLE_ECRITURES, JSON.stringify([
      { id: 'a', type: 'RECETTE', date: '2026-11-03', montant: 100, libelle: 'A', numero: 'RC-2026-0001' },
      { id: 'b', type: 'RECETTE', date: '2026-11-03', montant: 200, libelle: 'B' },
    ]));
    const { livre, erreur } = chargerLivre();
    expect(erreur).toBeNull();
    expect(livre.ecritures.map(e => e.numero)).toEqual(['RC-2026-0001', 'RC-2026-0002']);
  });
  it('bloque et préserve un stockage corrompu au lieu de le remplacer par un livre vide', () => {
    localStorage.setItem(CLE_LIVRE, '{corrompu');
    const chargement = chargerLivre();
    expect(chargement.erreur).toContain('illisibles');
    expect(chargement.livre.ecritures).toEqual([]);
    expect(() => sauvegarderLivre(livreTest(), 0)).toThrow();
    expect(localStorage.getItem(CLE_LIVRE)).toBe('{corrompu');
    const restaure = sauvegarderLivre(livreTest(), 0, true);
    expect(restaure.revision).toBe(1);
    expect(chargerLivre().erreur).toBeNull();
  });
  it('refuse d’écraser une révision plus récente provenant d’un autre onglet', () => {
    const livre = livreTest();
    const premier = sauvegarderLivre(livre, 0);
    expect(() => sauvegarderLivre({ ...livre, parametres: { soldeInitial: 999 } }, 0)).toThrow('autre onglet');
    expect(JSON.parse(localStorage.getItem(CLE_LIVRE)!).revision).toBe(premier.revision);
  });
  it('signale un quota plein sans prétendre que la modification est enregistrée', () => {
    const original = JSON.stringify(livreTest());
    localStorage.setItem(CLE_LIVRE, original);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    expect(() => sauvegarderLivre(livreTest(), 0)).toThrow('stockage du navigateur est plein');
    expect(localStorage.getItem(CLE_LIVRE)).toBe(original);
  });
  it('écrit atomiquement les écritures, paramètres, modèles et compteurs', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const livre = sauvegarderLivre(livreTest({ compteurs: { 'RC-2026': 4 } }), 0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(CLE_LIVRE);
    expect(JSON.parse(spy.mock.calls[0][1])).toMatchObject({ revision: 1, compteurs: { 'RC-2026': 4 } });
    expect(livre.exportedAt).toBeUndefined();
  });
});

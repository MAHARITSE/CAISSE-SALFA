import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLE_COMPTES, CLE_SESSION_LOCALE, LONGUEUR_MIN_MOT_DE_PASSE,
  amorcerComptesLocaux, changerMonMotDePasse, lireComptesBruts,
  retenirSessionLocale, verifierConnexionLocale, renouvelerSessionLocale, restaurerSessionLocale,
} from './utilisateurs';

/**
 * Changement de mot de passe personnel : chacun le sien, sans passer par
 * l'administrateur, mais jamais sans connaître l'ancien.
 */
describe('changement de son propre mot de passe', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function connecter(identifiant: string, id: string) {
    await amorcerComptesLocaux();
    retenirSessionLocale({ id });
    return identifiant;
  }

  it('remplace le mot de passe et l’ancien ne fonctionne plus', async () => {
    await amorcerComptesLocaux();
    const comptes = lireComptesBruts();
    const caisse = comptes.find(c => c.identifiant === 'caisse')!;
    await connecter('caisse', caisse.id);

    await changerMonMotDePasse('caisse1234', 'nouveauMdp2026');

    expect(await verifierConnexionLocale('caisse', 'caisse1234')).toBeNull();
    const apres = await verifierConnexionLocale('caisse', 'nouveauMdp2026');
    expect(apres?.identifiant).toBe('caisse');
    expect(apres?.role).toBe('caissier');
  });

  it('refuse un ancien mot de passe faux, sans rien modifier', async () => {
    await amorcerComptesLocaux();
    const comptable = lireComptesBruts().find(c => c.identifiant === 'comptable')!;
    await connecter('comptable', comptable.id);

    await expect(changerMonMotDePasse('pas-le-bon', 'nouveauMdp2026'))
      .rejects.toThrow('Le mot de passe actuel est incorrect.');
    expect(await verifierConnexionLocale('comptable', 'compta1234')).not.toBeNull();
  });

  it('exige un minimum de caractères et un mot de passe différent', async () => {
    await amorcerComptesLocaux();
    const admin = lireComptesBruts().find(c => c.identifiant === 'admin')!;
    await connecter('admin', admin.id);

    await expect(changerMonMotDePasse('admin1234', 'court'))
      .rejects.toThrow(`${LONGUEUR_MIN_MOT_DE_PASSE} caractères`);
    await expect(changerMonMotDePasse('admin1234', 'admin1234'))
      .rejects.toThrow('différent de l’ancien');
    expect(await verifierConnexionLocale('admin', 'admin1234')).not.toBeNull();
  });

  it('n’écrit jamais le mot de passe en clair dans le stockage', async () => {
    await amorcerComptesLocaux();
    const admin = lireComptesBruts().find(c => c.identifiant === 'admin')!;
    await connecter('admin', admin.id);

    await changerMonMotDePasse('admin1234', 'secretTresPerso99');

    const brut = localStorage.getItem(CLE_COMPTES) ?? '';
    expect(brut).not.toContain('secretTresPerso99');
    expect(brut).not.toContain('admin1234');
    // Le sel et le hachage sont bien là, séparés par le caractère prévu.
    expect(lireComptesBruts().find(c => c.identifiant === 'admin')?.secret).toMatch(/^[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('ne touche qu’au compte connecté', async () => {
    await amorcerComptesLocaux();
    const caisse = lireComptesBruts().find(c => c.identifiant === 'caisse')!;
    await connecter('caisse', caisse.id);

    await changerMonMotDePasse('caisse1234', 'nouveauMdp2026');

    expect(await verifierConnexionLocale('admin', 'admin1234')).not.toBeNull();
    expect(await verifierConnexionLocale('comptable', 'compta1234')).not.toBeNull();
  });

  it('se souvient du compte connecté et l’oublie à la déconnexion', async () => {
    await amorcerComptesLocaux();
    retenirSessionLocale({ id: 'u-1' });
    expect(JSON.parse(localStorage.getItem(CLE_SESSION_LOCALE) ?? 'null')).toMatchObject({ id: 'u-1', derniereActivite: expect.any(Number) });
    retenirSessionLocale(null);
    expect(localStorage.getItem(CLE_SESSION_LOCALE)).toBeNull();
  });
});


describe('expiration de présence locale', () => {
  beforeEach(() => { localStorage.clear(); retenirSessionLocale(null); });
  it('garde la caisse ouverte pendant une pause et ne la referme qu’après 30 minutes', async () => {
    const comptes = await amorcerComptesLocaux();
    const id = comptes[0].id;
    const temps = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    retenirSessionLocale({ id });
    // Une pause de plusieurs minutes ne ferme plus la caisse : chaque contrôle
    // réussi repousse l'échéance, comme le font les onglets ouverts.
    temps.mockReturnValue(1_000_000 + 5 * 60_000);
    expect(await restaurerSessionLocale()).toMatchObject({ id });
    temps.mockReturnValue(1_000_000 + 25 * 60_000);
    expect(await restaurerSessionLocale()).toMatchObject({ id });
    // Sans aucun contrôle pendant plus de 30 minutes, la reconnexion est exigée.
    retenirSessionLocale({ id });
    temps.mockReturnValue(1_000_000 + 25 * 60_000 + 30 * 60_000 + 1);
    expect(await restaurerSessionLocale()).toBeNull();
    expect(renouvelerSessionLocale(id)).toBe(false);
  });
  it('renouvelle une session partagée active, mais ne ressuscite pas une déconnexion ou un autre compte', () => {
    const temps = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    retenirSessionLocale({ id: 'a' });
    temps.mockReturnValue(1_000_000 + 20 * 60_000);
    expect(renouvelerSessionLocale('a')).toBe(true);
    // Chaque vérification repousse l'échéance : la présence reste continue.
    temps.mockReturnValue(1_000_000 + 45 * 60_000);
    expect(renouvelerSessionLocale('a')).toBe(true);
    retenirSessionLocale({ id: 'b' });
    expect(renouvelerSessionLocale('a')).toBe(false);
    retenirSessionLocale(null);
    expect(renouvelerSessionLocale('b')).toBe(false);
  });
  it('refuse un horodatage dans le futur plutôt que de faire confiance à une horloge fausse', () => {
    const temps = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    retenirSessionLocale({ id: 'a' });
    temps.mockReturnValue(900_000);
    expect(renouvelerSessionLocale('a')).toBe(false);
  });
  it('refuse les anciennes sessions sans horodatage', async () => {
    retenirSessionLocale({ id: 'a' });
    localStorage.setItem(CLE_SESSION_LOCALE, JSON.stringify({ id: 'a' }));
    expect(await restaurerSessionLocale()).toBeNull();
  });
});

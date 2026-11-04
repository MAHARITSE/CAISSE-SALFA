import { identifiant as nouvelIdentifiant } from './ledger';
import { MODE_API } from './api';
import type { Compte, Role } from './roles';

/**
 * Comptes utilisateurs.
 *
 * Deux sources, jamais mélangées :
 *  - hors serveur (démonstration, tests) : la liste vit dans le stockage du
 *    navigateur et le mot de passe y est haché par SHA-256 + sel ;
 *  - en mode WAMP : l'API PHP garde les comptes en MySQL, hache les mots de
 *    passe avec bcrypt/argon2 et ne renvoie jamais de secret.
 *
 * Le composant Administration ne connaît que cette façade.
 */

export const CLE_COMPTES = 'salfa_utilisateurs_v1';

/** Mot de passe minimal, aligné sur celui du serveur PHP (8 caractères). */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export const ERREUR_COMPTES =
  'Les comptes utilisateurs sont gérés par le serveur MySQL : ouvrez l’application sur le serveur WAMP pour les modifier.';

const encoder = new TextEncoder();

function hexa(octets: ArrayBuffer): string {
  return [...new Uint8Array(octets)].map(o => o.toString(16).padStart(2, '0')).join('');
}

/**
 * Hachage local. Le but n'est pas de résister à une attaque hors ligne — le
 * navigateur ne peut pas garder un secret — mais de ne jamais écrire un mot de
 * passe en clair dans le stockage.
 */
export async function hacherLocal(motDePasse: string, sel: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return `clair:${sel}:${motDePasse}`;
  const donnees = encoder.encode(`${sel}|${motDePasse}`);
  return hexa(await crypto.subtle.digest('SHA-256', donnees));
}

export function selAleatoire(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return hexa(crypto.getRandomValues(new Uint8Array(8)).buffer);
  }
  return Math.random().toString(36).slice(2, 12);
}

/** Comptes de démonstration : un par rôle, pour éprouver les accès. */
export const COMPTES_DEMO: Array<Omit<Compte, 'id' | 'secret'> & { motDePasse: string }> = [
  { identifiant: 'admin', nomComplet: 'Administrateur SALFA', role: 'admin', actif: true, motDePasse: 'admin1234' },
  { identifiant: 'caisse', nomComplet: 'Lydia — Caissière', role: 'caissier', actif: true, motDePasse: 'caisse1234' },
  { identifiant: 'comptable', nomComplet: 'Comptable SALFA', role: 'comptable', actif: true, motDePasse: 'compta1234' },
];

/** Lecture synchrone, réservée aux tests et à l'amorçage. */
export function lireComptesBruts(): Compte[] {
  try {
    const brut = localStorage.getItem(CLE_COMPTES);
    if (!brut) return [];
    const liste = JSON.parse(brut) as unknown;
    return Array.isArray(liste) ? liste.filter(c => c && typeof c === 'object') as Compte[] : [];
  } catch {
    return [];
  }
}

function ecrireComptes(liste: Compte[]): void {
  localStorage.setItem(CLE_COMPTES, JSON.stringify(liste));
}

/**
 * Prépare les comptes locaux : les comptes de démonstration sont créés au
 * premier lancement si la liste est vide. Ils sont modifiables ensuite.
 */
export async function amorcerComptesLocaux(): Promise<Compte[]> {
  const existants = lireComptesBruts();
  if (existants.length) return existants;
  const comptes: Compte[] = [];
  for (const modele of COMPTES_DEMO) {
    const sel = selAleatoire();
    comptes.push({
      id: nouvelIdentifiant('u'),
      identifiant: modele.identifiant,
      nomComplet: modele.nomComplet,
      role: modele.role,
      actif: modele.actif,
      secret: `${sel}$${await hacherLocal(modele.motDePasse, sel)}`,
    });
  }
  ecrireComptes(comptes);
  return comptes;
}

/** Liste utilisable par l'interface : jamais de secret. */
export async function listerComptes(): Promise<Compte[]> {
  if (MODE_API) {
    const { appelerComptes } = await import('./api');
    const reponse = await appelerComptes<{ comptes: Compte[] }>('utilisateurs');
    return reponse.comptes ?? [];
  }
  const liste = await amorcerComptesLocaux();
  return liste.map(({ secret: _secret, ...reste }) => reste);
}

/** Crée un compte. Le mot de passe n'est jamais renvoyé ni journalisé. */
export async function creerCompte(compte: {
  identifiant: string; nomComplet: string; role: Role; motDePasse: string; actif?: boolean;
}): Promise<Compte> {
  const identifiant = compte.identifiant.trim().toLowerCase();
  if (compte.motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    throw new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
  }
  if (MODE_API) {
    const { appelerComptes } = await import('./api');
    const reponse = await appelerComptes<{ compte: Compte }>('utilisateurs-creer', { methode: 'POST', corps: { ...compte, identifiant } });
    return reponse.compte;
  }
  const liste = await amorcerComptesLocaux();
  if (liste.some(c => c.identifiant === identifiant)) throw new Error(`L’identifiant « ${identifiant} » existe déjà.`);
  const sel = selAleatoire();
  const cree: Compte = {
    id: nouvelIdentifiant('u'),
    identifiant,
    nomComplet: compte.nomComplet.trim(),
    role: compte.role,
    actif: compte.actif ?? true,
    secret: `${sel}$${await hacherLocal(compte.motDePasse, sel)}`,
  };
  ecrireComptes([...liste, cree]);
  const { secret: _secret, ...sansSecret } = cree;
  return sansSecret;
}

/** Met à jour un compte ; le mot de passe ne change que s'il est fourni. */
export async function modifierCompte(
  id: string,
  changements: { nomComplet?: string; role?: Role; actif?: boolean; motDePasse?: string },
): Promise<Compte> {
  if (changements.motDePasse && changements.motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    throw new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
  }
  if (MODE_API) {
    const { appelerComptes } = await import('./api');
    const reponse = await appelerComptes<{ compte: Compte }>('utilisateurs-modifier', { methode: 'POST', corps: { id, ...changements } });
    return reponse.compte;
  }
  const liste = await amorcerComptesLocaux();
  const rang = liste.findIndex(c => c.id === id);
  if (rang < 0) throw new Error('Ce compte est introuvable.');
  const actuel = liste[rang];
  const suivant: Compte = {
    ...actuel,
    nomComplet: changements.nomComplet?.trim() || actuel.nomComplet,
    role: changements.role ?? actuel.role,
    actif: changements.actif ?? actuel.actif,
  };
  if (changements.motDePasse) {
    const sel = selAleatoire();
    suivant.secret = `${sel}$${await hacherLocal(changements.motDePasse, sel)}`;
  }
  // Le dernier administrateur actif ne peut pas se retirer ses droits.
  const adminsRestants = liste.filter(c => c.role === 'admin' && c.actif && c.id !== id);
  if (actuel.role === 'admin' && (suivant.role !== 'admin' || !suivant.actif) && adminsRestants.length === 0) {
    throw new Error('Il doit rester au moins un administrateur actif.');
  }
  liste[rang] = suivant;
  ecrireComptes(liste);
  const { secret: _secret, ...sansSecret } = suivant;
  return sansSecret;
}

/** Supprime un compte, sauf le dernier administrateur actif. */
export async function supprimerCompte(id: string): Promise<void> {
  if (MODE_API) {
    const { appelerComptes } = await import('./api');
    await appelerComptes<{ ok: boolean }>('utilisateurs-supprimer', { methode: 'POST', corps: { id } });
    return;
  }
  const liste = await amorcerComptesLocaux();
  const cible = liste.find(c => c.id === id);
  if (!cible) return;
  const adminsRestants = liste.filter(c => c.role === 'admin' && c.actif && c.id !== id);
  if (cible.role === 'admin' && adminsRestants.length === 0) {
    throw new Error('Il doit rester au moins un administrateur actif.');
  }
  ecrireComptes(liste.filter(c => c.id !== id));
}

/**
 * Vérifie un couple identifiant / mot de passe. Hors serveur uniquement : en
 * mode WAMP, la vérification est faite par PHP et le navigateur n'a aucun
 * secret à comparer.
 */
export async function verifierConnexionLocale(identifiant: string, motDePasse: string): Promise<Compte | null> {
  const liste = await amorcerComptesLocaux();
  const compte = liste.find(c => c.identifiant === identifiant.trim().toLowerCase() && c.actif);
  if (!compte || !compte.secret) return null;
  const [sel, attendu] = compte.secret.split('$');
  const calcule = await hacherLocal(motDePasse, sel);
  if (calcule !== attendu) return null;
  const { secret: _secret, ...sansSecret } = compte;
  return sansSecret as Compte;
}

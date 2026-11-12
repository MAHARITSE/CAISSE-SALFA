/**
 * Utilisateurs et rôles de la caisse.
 *
 * Trois rôles, du plus large au plus étroit :
 *  - « admin » : accès à tout, y compris Administration (modèles, catégories,
 *    en-tête, utilisateurs) ;
 *  - « caissier » : le livre journal seulement — il saisit les recettes et les
 *    dépenses ;
 *  - « comptable » : le livre journal et l'analyse de la caisse, en lecture.
 *
 * En mode local (démonstration dans le navigateur), les comptes sont gardés
 * dans le stockage du navigateur. En mode WAMP, ils vivent en MySQL et seul le
 * serveur vérifie les mots de passe : le navigateur ne reçoit jamais un hachage.
 */

export type Role = 'admin' | 'caissier' | 'comptable';

/** Compte tel que l'interface le manipule. */
export interface Compte {
  id: string;
  identifiant: string;
  nomComplet: string;
  role: Role;
  actif: boolean;
  /** Haché local, présent uniquement hors serveur ; jamais affiché. */
  secret?: string;
  derniereConnexion?: string;
}

/** Compte actif de la session en cours. */
export interface UtilisateurConnecte {
  id: number | string;
  identifiant: string;
  nomComplet: string;
  role: Role;
}

export const ROLES: Array<{ valeur: Role; libelle: string; resume: string }> = [
  { valeur: 'admin', libelle: 'Administrateur', resume: 'Tout : Administration, journal, analyse, exercices, données.' },
  { valeur: 'caissier', libelle: 'Caissière', resume: 'Le livre journal seulement : saisie des recettes et des dépenses.' },
  { valeur: 'comptable', libelle: 'Comptable', resume: 'Journal et analyse en lecture ; saisie et modification des virements.' },
];

export function libelleRole(role: Role | string): string {
  return ROLES.find(r => r.valeur === role)?.libelle ?? 'Utilisateur';
}

/** Onglets de l'application, filtrés par rôle. */
export type OngletApplication = 'journal' | 'virements' | 'analyse' | 'exercices' | 'donnees' | 'administration';

/**
 * Un rôle ouvre exactement les onglets listés ici.
 *
 * La caissière ne voit que le livre journal » : ni analyse, ni exercices, ni
 * données. Le comptable consulte le journal et l'analyse.
 */
export function ongletsAutorises(role: Role | string): OngletApplication[] {
  if (role === 'admin') return ['journal', 'virements', 'analyse', 'exercices', 'donnees', 'administration'];
  if (role === 'comptable') return ['journal', 'virements', 'analyse'];
  return ['journal'];
}

/** Un administrateur peut-il ouvrir un onglet donné ? */
export function peutOuvrir(role: Role | string, onglet: OngletApplication): boolean {
  return ongletsAutorises(role).includes(onglet);
}

/** La saisie d'écritures est réservée à la caisse et à l'administration. */
export function peutSaisir(role: Role | string): boolean {
  return role === 'admin' || role === 'caissier';
}

/** Les réglages (modèles, catégories, en-tête, utilisateurs) suivent l'administration. */
export function peutAdministrer(role: Role | string): boolean {
  return role === 'admin';
}

/** Description lisible d'un compte, pour l'en-tête de l'application. */
export function resumeDroits(role: Role | string): string {
  const onglets = ongletsAutorises(role).filter(o => o !== 'administration');
  const noms: Record<string, string> = {
    journal: 'Livre journal',
    virements: 'Livre des virements',
    analyse: 'Analyse de la caisse',
    exercices: 'Exercices',
    donnees: 'Données & sauvegardes',
  };
  return onglets.map(o => noms[o]).join(' · ');
}

/**
 * Le solde d'ouverture est le point de départ de tous les soldes : une seule
 * personne le corrige, l'administrateur. Le serveur applique la même règle.
 */
export function peutModifierSoldeOuverture(role: Role | string): boolean {
  return role === 'admin';
}

/** La clôture d'exercice engage toute la caisse : elle aussi réservée à l'admin. */
export function peutCloturer(role: Role | string): boolean {
  return role === 'admin';
}

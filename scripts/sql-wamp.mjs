/**
 * Écrit le script SQL livré **dans** le paquet `caisse-salfa`.
 *
 * Fichier produit : `deploy/wamp/caisse-salfa/api/caisse-salfa.sql`
 *
 * Il contient absolument tout ce qu'il faut pour avoir une base prête :
 *
 *   1. création de la base `caisse_salfa` (utf8mb4) ;
 *   2. les 14 tables `salfa_*` ;
 *   3. le livre, les paramètres, les catégories et les modèles de départ ;
 *   4. les deux comptes de connexion (`admin` / `admin123`,
 *      `comptable` / `comptable123`) avec leurs empreintes bcrypt ;
 *   5. des requêtes de contrôle qui affichent OK / INCOMPLET après l'import.
 *
 * Il s'importe dans phpMyAdmin (onglet « Importer ») et **remplace** les deux
 * fichiers d'`api/installation/` qui étaient jusqu'ici séparés. Le même schéma
 * continue d'être utilisé par l'amorçage automatique de l'API : une seule
 * source de vérité, donc aucun risque de divergence entre la base créée à la
 * main et celle créée par l'application.
 *
 * Le script est idempotent : le rejouer ne détruit aucune donnée et ne
 * réinitialise aucun mot de passe déjà changé.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');

/**
 * Empreintes bcrypt des mots de passe de départ.
 *
 * Elles sont figées ici (et non calculées à chaque build) pour que le fichier
 * SQL livré soit stable d'une génération à l'autre : un fichier qui change à
 * chaque build créerait un diff Git inutile et empêcherait de vérifier le
 * contenu livré. Elles ont été vérifiées contre `crypt()` (la fonction
 * qu'utilise `password_verify()` en PHP) et `bcryptjs`.
 *
 * Pour changer un mot de passe de départ :
 *   npm i --no-save bcryptjs
 *   node -e "const b=require('bcryptjs');console.log(b.hashSync('nouveau',10).replace(/^\$2b\$/,'\$2y\$'))"
 * puis remplacer la valeur ci-dessous et le mot de passe correspondant dans
 * `deploy/wamp/api/config.php`.
 */
const EMPREINTES = {
  admin123: '$2y$10$Fo4l4z1cBue7Mywu/ZBi5uQS8TzwowszR/aGX2zjRxe8x9c06BGFy',
  comptable123: '$2y$10$ULmDdmCTEFYHQbD.yn9YTuERwAxSuFu6g9stx1z.fi9OPHSB1PMT6',
};

/** Valeurs de départ lues dans `api/config.php` (seule source de vérité). */
function valeursDeDepart() {
  const config = readFileSync(join(racine, 'deploy', 'wamp', 'api', 'config.php'), 'utf8');
  const lire = (cle) => {
    const trouve = config.match(new RegExp(`'${cle}'\\s*=>\\s*'([^']*)'`));
    if (!trouve) {
      throw new Error(`api/config.php : valeur de départ « ${cle} » introuvable.`);
    }
    return trouve[1];
  };
  const base = lire('base');
  return {
    base,
    comptes: [
      { identifiant: lire('compte_admin'), nom: lire('compte_admin_nom'), mdp: lire('compte_admin_mdp'), role: 'admin' },
      { identifiant: lire('compte_comptable'), nom: lire('compte_comptable_nom'), mdp: lire('compte_comptable_mdp'), role: 'comptable' },
    ],
  };
}

/** Échappement d'une chaîne pour un littéral SQL MySQL. */
function texte(valeur) {
  return `'${String(valeur).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

export function ecrireScriptSql(cible) {
  const { base, comptes } = valeursDeDepart();

  let schema = readFileSync(join(racine, 'deploy', 'wamp', 'api', 'installation', 'salfa_install.sql'), 'utf8').trimEnd();
  // La base du fichier d'installation est celle de la configuration : on aligne
  // les deux si un nom de base a été changé dans api/config.php.
  schema = schema
    .replace(/CREATE DATABASE IF NOT EXISTS `[A-Za-z0-9_]+`/, `CREATE DATABASE IF NOT EXISTS \`${base}\``)
    .replace(/^USE `[A-Za-z0-9_]+`;/m, `USE \`${base}\`;`);

  const identifiants = comptes
    .filter((c) => c.identifiant !== '')
    .map((c) => {
      const empreinte = EMPREINTES[c.mdp];
      if (!empreinte) {
        throw new Error(
          `Aucune empreinte bcrypt connue pour le mot de passe de départ « ${c.identifiant} ». `
            + 'Voir le commentaire EMPREINTES dans scripts/sql-wamp.mjs.',
        );
      }
      return { ...c, empreinte };
    });

  const comptesSql = identifiants
    .map((c) => `  (${texte(c.identifiant)}, ${texte(c.nom)}, ${texte(c.empreinte)}, ${texte(c.role)}, 1)`)
    .join(',\n');

  const contenu = `-- ============================================================================
-- CAISSE SALFA — base de données complète (MySQL / MariaDB, WAMP)
-- ============================================================================
-- Fichier GÉNÉRÉ par scripts/sql-wamp.mjs — ne pas modifier à la main :
-- il est reconstruit à chaque \`npm run build:wamp\`.
--
-- IMPORT DANS phpMyAdmin :
--   onglet « Importer » -> choisir ce fichier -> Exécuter
--   (inutile de créer ou de sélectionner la base : ce fichier la crée lui-même)
--
-- À quoi ça sert : c'est la même base que celle créée automatiquement au
-- premier appel de l'API. L'importer ici permet de partir d'une base déjà
-- remplie (tables, catégories, modèles, comptes) sans passer par le navigateur,
-- et de la déplacer d'un serveur à l'autre.
--
-- Rejouable sans risque : tables en « IF NOT EXISTS », données de départ en
-- « ON DUPLICATE KEY UPDATE ». Un mot de passe déjà changé n'est jamais
-- réinitialisé.
--
-- Comptes créés (à changer dès la première connexion) :
${identifiants.map((c) => `--   ${c.identifiant.padEnd(12)} mot de passe : ${c.mdp}  (rôle ${c.role})`).join('\n')}
-- ============================================================================

${schema}

-- ============================================================================
-- Mise à jour d'une base créée avant les rôles actuels
-- ============================================================================
-- Sur une base neuve, ces trois instructions ne changent rien. Sur une base
-- ancienne, le rôle « lecteur » devient « comptable » : des comptes et des
-- mots de passe sont conservés, seul le libellé du rôle change.
ALTER TABLE salfa_utilisateurs
  MODIFY COLUMN role ENUM('lecteur','comptable','caissier','admin') NOT NULL DEFAULT 'caissier';
UPDATE salfa_utilisateurs SET role = 'comptable' WHERE role = 'lecteur';
ALTER TABLE salfa_utilisateurs
  MODIFY COLUMN role ENUM('comptable','caissier','admin') NOT NULL DEFAULT 'caissier';

-- ============================================================================
-- Comptes de connexion de départ
-- ============================================================================
-- Empreintes bcrypt produites par password_hash() : le mot de passe en clair
-- n'apparaît jamais en base et ne peut pas être relu. L'application en crée
-- aussi d'elle-même si la table est vide ; ces lignes ne servent qu'à rendre
-- l'import autonome.
INSERT INTO salfa_utilisateurs (identifiant, nom_complet, mdp_hash, role, actif) VALUES
${comptesSql}
  ON DUPLICATE KEY UPDATE identifiant = identifiant;

-- ============================================================================
-- Contrôles (le résultat s'affiche après l'import)
-- ============================================================================
SELECT 'tables salfa_ présentes' AS controle,
       COUNT(*) AS trouve,
       14 AS attendu,
       IF(COUNT(*) = 14, 'OK', 'INCOMPLET — relancez l’import du fichier entier') AS etat
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME LIKE 'salfa%';

SELECT 'livre initialisé' AS controle,
       (SELECT COUNT(*) FROM salfa_livre WHERE id = 1) AS trouve,
       1 AS attendu,
       IF((SELECT COUNT(*) FROM salfa_livre WHERE id = 1) = 1, 'OK', 'MANQUANT') AS etat;

SELECT 'comptes de connexion' AS controle,
       (SELECT COUNT(*) FROM salfa_utilisateurs) AS trouve,
       ${identifiants.length} AS attendu,
       IF((SELECT COUNT(*) FROM salfa_utilisateurs) >= ${identifiants.length}, 'OK', 'INCOMPLET') AS etat;

SELECT 'administrateur actif' AS controle,
       (SELECT COUNT(*) FROM salfa_utilisateurs WHERE role = 'admin' AND actif = 1) AS trouve,
       1 AS attendu,
       IF((SELECT COUNT(*) FROM salfa_utilisateurs WHERE role = 'admin' AND actif = 1) > 0, 'OK', 'MANQUANT') AS etat;
`;

  mkdirSync(join(cible, '..'), { recursive: true });
  writeFileSync(cible, contenu);
  return { cible, octets: Buffer.byteLength(contenu), comptes: identifiants.length };
}

// Exécution directe : `node scripts/sql-wamp.mjs` régénère le fichier du paquet.
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const r = ecrireScriptSql(join(racine, 'deploy', 'wamp', 'caisse-salfa', 'api', 'caisse-salfa.sql'));
  console.log(`✓ ${r.cible} (${Math.round(r.octets / 1024)} Ko, ${r.comptes} comptes de départ)`);
}

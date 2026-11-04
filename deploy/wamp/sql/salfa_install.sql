-- ============================================================================
-- CAISSE SALFA — schéma MySQL / MariaDB pour WAMP
-- ============================================================================
-- IMPORT DANS phpMyAdmin :
--   onglet « Importer »  ->  choisir ce fichier  ->  Exécuter
--   (inutile de sélectionner une base : ce fichier la crée lui-même)
--
-- Pour un autre nom de base, modifiez les deux lignes CREATE DATABASE et USE
-- ci-dessous, ainsi que api/salfa-config.php.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+03:00';

CREATE DATABASE IF NOT EXISTS `caisse_salfa`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `caisse_salfa`;

CREATE TABLE IF NOT EXISTS salfa_livre (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modifie_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_parametres (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  solde_initial BIGINT NOT NULL DEFAULT 0,
  exercice SMALLINT UNSIGNED NULL,
  report_annee SMALLINT UNSIGNED NULL,
  report_solde BIGINT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_ecritures (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  numero VARCHAR(80) NOT NULL,
  date DATE NOT NULL,
  sens ENUM('RECETTE','DEPENSE') NOT NULL,
  libelle VARCHAR(200) NOT NULL,
  categorie VARCHAR(120) NOT NULL,
  tiers VARCHAR(200) NULL,
  reference VARCHAR(200) NULL,
  observation VARCHAR(2000) NULL,
  montant BIGINT NOT NULL,
  annee_archive SMALLINT UNSIGNED NULL,
  cree_le DATETIME(3) NOT NULL,
  modifie_le DATETIME(3) NULL,
  UNIQUE KEY uq_numero (numero),
  KEY idx_date (date),
  KEY idx_archive (annee_archive),
  CONSTRAINT ck_montant CHECK (montant > 0),
  CONSTRAINT ck_annee CHECK (annee_archive IS NULL OR annee_archive = YEAR(date))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_details (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  ecriture_id VARCHAR(120) NOT NULL,
  libelle VARCHAR(200) NOT NULL,
  reference VARCHAR(200) NULL,
  montant BIGINT NOT NULL,
  ordre SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_ecriture (ecriture_id, ordre),
  CONSTRAINT fk_details_ecriture FOREIGN KEY (ecriture_id) REFERENCES salfa_ecritures(id) ON DELETE CASCADE,
  CONSTRAINT ck_detail_montant CHECK (montant > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_masques (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  nom VARCHAR(120) NOT NULL,
  sens ENUM('RECETTE','DEPENSE') NOT NULL,
  description VARCHAR(500) NULL,
  ordre SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_masque_lignes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  masque_id VARCHAR(120) NOT NULL,
  description VARCHAR(200) NOT NULL,
  montant_defaut BIGINT NULL,
  ordre SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_masque (masque_id, ordre),
  CONSTRAINT fk_lignes_masque FOREIGN KEY (masque_id) REFERENCES salfa_masques(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- En-tête imprimable de chaque bordereau (engagement de dépense, autorisation de recette).
-- Les images sont stockées en data URL PNG/JPEG, bornées côté application à 1 Mo.
CREATE TABLE IF NOT EXISTS salfa_entetes (
  document ENUM('depense','recette') NOT NULL PRIMARY KEY,
  mode ENUM('image','textes') NOT NULL DEFAULT 'textes',
  image MEDIUMTEXT NULL,
  lignes MEDIUMTEXT NULL,
  -- Images placées librement sur la feuille : [{id, source, x, y, largeur, alt}].
  images MEDIUMTEXT NULL,
  logo_gauche MEDIUMTEXT NULL,
  logo_droit MEDIUMTEXT NULL,
  modifie_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catégories de saisie, distinctes pour les recettes et les dépenses.
CREATE TABLE IF NOT EXISTS salfa_categories (
  sens ENUM('RECETTE','DEPENSE') NOT NULL,
  nom VARCHAR(120) NOT NULL,
  ordre SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (sens, nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_compteurs (
  cle VARCHAR(20) NOT NULL PRIMARY KEY,
  valeur INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_clotures (
  annee SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  cloture_le DATETIME(3) NOT NULL,
  solde_ouverture BIGINT NOT NULL,
  recettes BIGINT NOT NULL,
  depenses BIGINT NOT NULL,
  solde_cloture BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_utilisateurs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifiant VARCHAR(80) NOT NULL,
  nom_complet VARCHAR(120) NOT NULL,
  mdp_hash VARCHAR(255) NOT NULL,
  -- Rôles : admin (tout), caissier (livre journal), comptable (journal + analyse).
  -- L'ancien « lecteur » est ramené à « comptable » par salfa_roles.sql.
  role ENUM('comptable','caissier','admin') NOT NULL DEFAULT 'caissier',
  actif TINYINT(1) NOT NULL DEFAULT 1,
  derniere_connexion DATETIME(3) NULL,
  cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_identifiant (identifiant)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  utilisateur_id INT UNSIGNED NOT NULL,
  jeton_hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NULL,
  agent VARCHAR(255) NULL,
  cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vu_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expire_le DATETIME(3) NOT NULL,
  UNIQUE KEY uq_jeton (jeton_hash),
  KEY idx_utilisateur (utilisateur_id),
  CONSTRAINT fk_session_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES salfa_utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_tentatives (
  cle_hash CHAR(64) NOT NULL PRIMARY KEY,
  action VARCHAR(40) NOT NULL,
  compteur INT UNSIGNED NOT NULL DEFAULT 0,
  derniere_le DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salfa_journal_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  resultat VARCHAR(20) NOT NULL,
  ip VARCHAR(45) NULL,
  agent VARCHAR(255) NULL,
  detail VARCHAR(500) NULL,
  cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_date (cree_le)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Livre unique et paramètres initiaux
INSERT INTO salfa_livre (id, revision) VALUES (1, 0)
  ON DUPLICATE KEY UPDATE id = id;
INSERT INTO salfa_parametres (id, solde_initial, exercice, report_annee, report_solde)
  VALUES (1, 0, YEAR(CURDATE()), NULL, NULL)
  ON DUPLICATE KEY UPDATE id = id;

-- Catégories de saisie par défaut, séparées par sens (modifiables depuis l'application)
INSERT INTO salfa_categories (sens, nom, ordre) VALUES
  ('RECETTE', 'Recettes journalières', 0),
  ('RECETTE', 'Consultations', 1),
  ('RECETTE', 'Pharmacie', 2),
  ('RECETTE', 'Laboratoire', 3),
  ('RECETTE', 'Hospitalisation', 4),
  ('RECETTE', 'Maternité', 5),
  ('RECETTE', 'Imagerie', 6),
  ('RECETTE', 'Subventions & dons', 7),
  ('RECETTE', 'Remboursements', 8),
  ('RECETTE', 'Autres recettes', 9),
  ('DEPENSE', 'Achats médicaments', 0),
  ('DEPENSE', 'Consommables médicaux', 1),
  ('DEPENSE', 'Fournitures de bureau', 2),
  ('DEPENSE', 'Carburant & transport', 3),
  ('DEPENSE', 'Maintenance & équipements', 4),
  ('DEPENSE', 'Salaires & primes', 5),
  ('DEPENSE', 'Frais de mission', 6),
  ('DEPENSE', 'Honoraires', 7),
  ('DEPENSE', 'Eau & électricité', 8),
  ('DEPENSE', 'Téléphone & internet', 9),
  ('DEPENSE', 'Divers', 10)
  ON DUPLICATE KEY UPDATE nom = nom;

-- Modèles de saisie par défaut (facultatifs, supprimables depuis l'application)
INSERT INTO salfa_masques (id, nom, sens, description, ordre) VALUES
  ('masque-recettes-hopital', 'Bordereau recettes hôpital', 'RECETTE', 'Les 12 postes du carnet de caisse hospitalier.', 0),
  ('masque-depenses-courantes', 'Charges courantes & fonctionnement', 'DEPENSE', 'Dépenses périodiques d’exploitation.', 1)
  ON DUPLICATE KEY UPDATE nom = VALUES(nom);

-- Réexécutable : les postes des deux modèles livrés sont remplacés, pas dupliqués.
DELETE FROM salfa_masque_lignes WHERE masque_id IN ('masque-recettes-hopital', 'masque-depenses-courantes');

INSERT INTO salfa_masque_lignes (masque_id, description, montant_defaut, ordre) VALUES
  ('masque-recettes-hopital', 'CONSULTATION', NULL, 0),
  ('masque-recettes-hopital', 'ECHOGRAPHIE', NULL, 1),
  ('masque-recettes-hopital', 'CHAMBRE', NULL, 2),
  ('masque-recettes-hopital', 'LABORATOIRE', NULL, 3),
  ('masque-recettes-hopital', 'MATERNITE', NULL, 4),
  ('masque-recettes-hopital', 'MEDICAMENT', NULL, 5),
  ('masque-recettes-hopital', 'SOINS', NULL, 6),
  ('masque-recettes-hopital', 'HOSPITALISATION', NULL, 7),
  ('masque-recettes-hopital', 'DENTISTERIE', NULL, 8),
  ('masque-recettes-hopital', 'BLOC', NULL, 9),
  ('masque-recettes-hopital', 'DIVERS', NULL, 10),
  ('masque-recettes-hopital', 'VACCIN', NULL, 11),
  ('masque-depenses-courantes', 'ACHATS MEDICAMENTS', NULL, 0),
  ('masque-depenses-courantes', 'FOURNITURES MEDICALES', NULL, 1),
  ('masque-depenses-courantes', 'CARBURANT', NULL, 2),
  ('masque-depenses-courantes', 'EAU & ELECTRICITE', NULL, 3),
  ('masque-depenses-courantes', 'MAINTENANCE', NULL, 4),
  ('masque-depenses-courantes', 'DIVERS', NULL, 5);

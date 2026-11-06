-- ============================================================================
-- CAISSE SALFA — mise à jour d'une base déjà installée
--
-- À exécuter UNE FOIS sur une base créée avant l'arrivée des rôles
-- « administrateur / caissière / comptable ». Le script est idempotent :
-- le rejouer ne change rien de plus.
--
--   mysql -u root -p salfa < api/installation/salfa_roles.sql
--
-- ou, sous WAMP : phpMyAdmin > base « salfa » > Importer > ce fichier.
-- ============================================================================

-- 1) Le rôle « lecteur » devient « comptable ».
--
--    « lecteur » ne voulait dire qu'une chose : consulter le livre journal et
--    l'analyse, sans saisir. C'est exactement le rôle du comptable. On le
--    renomme donc, sans toucher aux comptes ni aux mots de passe.
--
--    L'ENUM est agrandi AVANT le renommage, sinon MySQL refuse la valeur.
ALTER TABLE salfa_utilisateurs
  MODIFY COLUMN role ENUM('lecteur','comptable','caissier','admin') NOT NULL DEFAULT 'caissier';

UPDATE salfa_utilisateurs SET role = 'comptable' WHERE role = 'lecteur';

-- 2) L'ENUM est resserré sur les trois rôles réels.
ALTER TABLE salfa_utilisateurs
  MODIFY COLUMN role ENUM('comptable','caissier','admin') NOT NULL DEFAULT 'caissier';

-- 3) Le solde d'ouverture reste modifiable par le seul administrateur :
--    c'est le serveur qui le vérifie (api/points/solde-initial.php exige
--    le rôle « admin »). Aucune colonne à ajouter.
--
--    Contrôle : il doit rester au moins un administrateur actif, sans quoi
--    plus personne ne pourrait corriger le solde ni clôturer un exercice.
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN CONCAT('OK — ', COUNT(*), ' administrateur(s) actif(s)')
    ELSE 'ATTENTION — aucun administrateur actif : relancez installer.php pour en recréer un'
  END AS controle_administrateur
FROM salfa_utilisateurs
WHERE role = 'admin' AND actif = 1;

-- 4) Table des comptes, pour vérification après migration.
SELECT id, identifiant, nom_complet, role, actif
FROM salfa_utilisateurs
ORDER BY FIELD(role, 'admin', 'caissier', 'comptable'), identifiant;

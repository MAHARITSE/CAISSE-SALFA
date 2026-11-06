-- ============================================================================
-- CAISSE SALFA — vérification de l'import
-- ============================================================================
-- À exécuter dans phpMyAdmin APRÈS salfa_install.sql :
--   onglet SQL -> coller ce fichier -> Exécuter
-- Vous devez voir 14 tables, et la colonne « etat » à OK.
-- ============================================================================

SELECT 'tables salfa_ présentes' AS controle,
       COUNT(*) AS trouve,
       14 AS attendu,
       IF(COUNT(*) = 14, 'OK', 'INCOMPLET — relancez salfa_install.sql') AS etat
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'caisse_salfa'
  AND TABLE_NAME LIKE 'salfa%';

-- Le livre et les paramètres doivent exister (id = 1).
SELECT 'livre initialisé' AS controle,
       (SELECT COUNT(*) FROM caisse_salfa.salfa_livre WHERE id = 1) AS trouve,
       1 AS attendu,
       IF((SELECT COUNT(*) FROM caisse_salfa.salfa_livre WHERE id = 1) = 1, 'OK', 'MANQUANT') AS etat;

-- Les en-têtes personnalisés des bordereaux (facultatif) : table prête, encore vide.
SELECT 'table des en-têtes de bordereau' AS controle,
       (SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = 'caisse_salfa' AND TABLE_NAME = 'salfa_entetes') AS trouve,
       1 AS attendu,
       IF((SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = 'caisse_salfa' AND TABLE_NAME = 'salfa_entetes') = 1, 'OK', 'MANQUANTE') AS etat;

-- Aucun compte : relancez installer.php pour recréer un administrateur (normal au premier import).
SELECT 'comptes utilisateurs' AS controle,
       (SELECT COUNT(*) FROM caisse_salfa.salfa_utilisateurs) AS trouve,
       'créés par installer.php' AS attendu,
       IF((SELECT COUNT(*) FROM caisse_salfa.salfa_utilisateurs) > 0, 'OK', 'à créer') AS etat;

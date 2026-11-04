-- ============================================================================
-- CAISSE SALFA — vérification de l'import
-- ============================================================================
-- À exécuter dans phpMyAdmin APRÈS salfa_install.sql :
--   onglet SQL -> coller ce fichier -> Exécuter
-- Vous devez voir 12 lignes, et la dernière colonne « attendu » à OK.
-- ============================================================================

SELECT 'tables salfa_ présentes' AS controle,
       COUNT(*) AS trouve,
       12 AS attendu,
       IF(COUNT(*) = 12, 'OK', 'INCOMPLET — relancez salfa_install.sql') AS etat
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'caisse_salfa'
  AND TABLE_NAME LIKE 'salfa%';

-- Le livre et les paramètres doivent exister (id = 1).
SELECT 'livre initialisé' AS controle,
       (SELECT COUNT(*) FROM caisse_salfa.salfa_livre WHERE id = 1) AS trouve,
       1 AS attendu,
       IF((SELECT COUNT(*) FROM caisse_salfa.salfa_livre WHERE id = 1) = 1, 'OK', 'MANQUANT') AS etat;

-- Aucun compte : l'étape suivante est outils\creer-admin.bat (normal au premier import).
SELECT 'comptes utilisateurs' AS controle,
       (SELECT COUNT(*) FROM caisse_salfa.salfa_utilisateurs) AS trouve,
       'créés par creer-admin.bat' AS attendu,
       IF((SELECT COUNT(*) FROM caisse_salfa.salfa_utilisateurs) > 0, 'OK', 'à créer') AS etat;

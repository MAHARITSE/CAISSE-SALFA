# Audit et corrections — CAISSE SALFA

**Date :** 3 novembre 2026  
**Version livrée :** 1.1.0  
**Version suivante :** 1.2.0 — audit d’interface et version du paquet, voir `INTERFACE.md`  
**Périmètre :** application React/TypeScript/Vite existante, stockage local,
saisie, journal, bordereaux, modèles, exports et impression. Aucun backend n’a
été ajouté : l’application reste locale au navigateur.

## Principaux défauts constatés puis corrigés

| Constat | Risque | Correction |
| --- | --- | --- |
| Mode de paiement perdu au rechargement | Donnée métier perdue | Persistance du mode historique, puis suppression du champ : la caisse ne gère que les espèces |
| Références des sous-postes perdues à l’édition/enregistrement | Bordereau incomplet | Référence conservée par poste, éditable et exportée |
| Référence et observation fusionnées | Information ambiguë | Champs distincts, stockage et export séparés |
| Total détaillé pouvant diverger de la somme des postes ; postes à zéro écartés en silence | Totaux faux | Validation stricte du total et de chaque poste ; recalcul explicite seulement à la migration avec avertissement |
| CSV additionnant la ligne principale et ses sous-lignes | Double comptage à l’export | Montant porté soit par la ligne simple, soit par les postes, jamais les deux |
| Chaînes utilisateur non neutralisées dans le CSV | Injection de formule Excel | Préfixage des valeurs textuelles dangereuses ; montants numériques conservés |
| `localStorage.setItem` sans gestion d’erreur | Fausse confirmation d’enregistrement | Sauvegarde atomique, messages explicites, formulaire conservé, réessai possible |
| Stockage corrompu silencieusement remplacé par un livre vide | Perte de données | Chargement bloquant, export brut de secours, restauration explicite |
| Écritures, paramètres et masques sauvegardés séparément | État partiellement enregistré | Un seul snapshot versionné et atomique |
| Écrasement possible entre onglets | Perte d’une écriture concurrente | Révision persistée, contrôle avant écriture, événement `storage` |
| Numéro de pièce réutilisable après suppression ; numéro modifié avec la date | Identité de pièce instable | Compteurs persistants ; numéro et création d’origine conservés à l’édition |
| Dates basées sur `toISOString()` et dates impossibles acceptées | Décalage de jour, données invalides | Date locale et validation calendaire réelle |
| Impression d’un bordereau imprimant le journal | Document incorrect | Document de bordereau dédié, impression portrait isolée |
| Modales sans piège de focus fiable | Accessibilité et saisie accidentelle | `<dialog>` natif, focus piégé, Échap, confirmation avant abandon |
| Débordement horizontal mobile dû au libellé masqué du tableau | Interface mobile cassée | Conteneur de tableau positionné ; vérifié à 390 px |
| Police et script `fetch` externes inutiles dans `index.html` | Dépendance réseau et métadonnées trompeuses | Police système, script retiré, titre/description/favicon corrigés |

## Améliorations ajoutées

- Sauvegardes JSON complètes, import validé, aperçu, confirmation et sauvegarde
  automatique du livre remplacé.
- Export brut de secours pour les anciennes clés et les données corrompues.
- Annulation de la dernière suppression.
- Clôture annuelle : archive figée de l’exercice, solde reporté, exercice
  suivant vide, blocage des saisies hors exercice, onglet Exercices & clôtures,
  export d’une archive autonome et conversion des livres multi-années.
- Clôture interdite tant que l’année n’est pas révolue : autorisée seulement à
  partir du 1er janvier suivant, bouton désactivé et règle vérifiée avant toute
  écriture de l’archive.
- Analyse par catégorie et ratio dépenses/recettes.
- Filtres par catégorie, recherche insensible aux accents.
- Mode de paiement retiré de l’interface et des exports : la caisse ne traite que
  les espèces. Les anciennes écritures portant un autre mode restent lisibles.
- Modèles avec montants par défaut, réordonnancement des postes et confirmation
  avant remplacement d’une saisie.
- Pagination à l’écran ; impression de toute la sélection.
- Interface responsive, états vides, notifications, garde-fou d’erreur React.
- Validation stricte des sauvegardes : format/version, doublons, montants,
  dates, cohérence des détails et précision numérique du solde cumulé.

## Vérifications effectuées

- `npm run lint` : TypeScript strict, paramètres et locaux inutilisés refusés.
- `npm test` : **41 tests** unitaires et d’intégration passés.
- `npm run test:e2e` : **6 parcours Chromium** passés (desktop, mobile,
  multi-onglets, clôture annuelle, conversion d’un livre multi-années, refus de
  clôture d’une année en cours), incluant saisie détaillée, persistance, CSV,
  bordereau, impression, focus modal et absence de débordement mobile.
- `npm run build` : build de production réussi.
- `npm audit --omit=dev` : **0 vulnérabilité connue** sur les dépendances de
  production au moment de l’audit.

Couverture notable : migration legacy, conservation des références/modes,
réparation signalée des totaux, numérotation après suppression, conflit de
révision, quota de stockage plein, stockage corrompu, import JSON invalide,
restauration confirmée, neutralisation CSV et non-double-comptage,
clôture d’exercice, chaîne des soldes reportés et conversion d’un livre
multi-années.

## Limites et recommandations

- Le stockage local n’est pas chiffré et n’est pas une base de données
  multi-utilisateur. Il n’y a ni authentification ni synchronisation serveur.
- La suppression reste possible et l’historique n’est pas une piste d’audit
  immuable ; l’archive d’exercice est figée dans l’application, mais une
  sauvegarde restaurée peut toujours la remplacer. Pour un usage comptable réglementé, ajouter un backend, des rôles,
  une journalisation immuable et une politique de clôture/contre-passation.
- Exporter une sauvegarde JSON après chaque session et conserver plusieurs
  copies hors du navigateur. Ne pas effacer les données du site sans sauvegarde.
- La restauration remplace le livre ; elle ne fusionne pas deux historiques.
- Vérifier les pièces migrées dont le total a été recalculé, puis conserver une
  sauvegarde JSON validée.

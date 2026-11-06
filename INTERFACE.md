# Audit d’interface — CAISSE SALFA

**Date :** 5 novembre 2026
**Version :** 1.3.0
**Périmètre :** coquille applicative, connexion, livre journal, filtres, saisie,
analyse, exercices, données et sauvegardes, administration, modales, contrôles
d’affichage et impression. Aucune règle de gestion ni aucun format de
sauvegarde n’a été modifié : ce travail porte uniquement sur ce que l’on voit
et sur la façon de s’en servir.

## Méthode

1. Lecture de tous les composants de `src/components`, de `src/App.tsx`, de
   `src/index.css` et de `index.html`.
2. Confrontation des classes utilisées avec les classes réellement définies
   (utilitaires Tailwind et classes maison) : une classe inexistante ne produit
   aucune erreur de compilation, seulement un élément non stylé.
3. Revue systématique de la couverture du thème sombre, écran par écran, en
   comparant chaque utilitaire clair (`text-slate-900`, `bg-white`, …) et son
   équivalent sombre dans le même élément.
4. Revue d’accessibilité : repères, titres, libellés, ordre de tabulation,
   annonces des changements, contrastes, cibles tactiles.
5. Exécution de `npm run lint`, `npm test` et `npm run build`, puis contrôle que
   les classes produites existent bien dans la feuille compilée.
6. Mise à jour des parcours Playwright : ils ne tenaient pas compte de l’écran
   de connexion et ne pouvaient donc plus s’exécuter.

## Défauts constatés, puis corrigés

| Constat | Effet pour l’utilisateur | Correction |
| --- | --- | --- |
| Thème sombre appliqué à la coquille et au journal, mais absent de neuf écrans (analyse, exercices, données, administration, synthèse, catégories, modèles, mot de passe, éditeur d’en-tête) | Textes gris foncé sur cartes sombres : pages illisibles la nuit, alors que le mode sombre est proposé dans la barre d’accessibilité | Variantes `dark:` ajoutées partout ; contrastes vérifiés par calcul de luminance dans un test de bout en bout |
| Barre de filtres accrochée à `top: 102px` en dur | Dès que l’en-tête passait sur deux lignes (téléphone) ou que la taille de police augmentait, la barre chevauchait l’en-tête ou laissait un trou | Hauteur réelle de l’en-tête mesurée (`ResizeObserver`) et transmise à la barre, qui reste collante à partir de 640 px seulement |
| Tableau du journal large de 960 px sur un écran de 390 px | Les boutons Imprimer / Modifier / Supprimer sortaient de l’écran : il fallait faire défiler horizontalement à chaque ligne | Colonne « Action » collante à droite, avec le fond de la ligne (active, en édition, normale) |
| Trois champs de l’éditeur d’en-tête utilisaient la classe `input`, jamais définie | Police, taille et position des images s’affichaient avec le style brut du navigateur | Remplacés par `field` avec des tailles compactes |
| Classes `slate-850` (fond du report à nouveau, survol de la navigation) inexistantes dans Tailwind | Aucune couleur appliquée : ligne et survol sans repère en mode sombre | Remplacées par `slate-800` |
| Deux sélecteurs de modèle dans le même formulaire de saisie | On ne savait plus lequel faisait foi ; le second alourdissait la zone des montants | Un seul sélecteur, en haut du formulaire, avec le bouton « Gérer les modèles » à côté |
| État vide du journal sans action | Message « Ajoutez une recette ou une dépense pour commencer » sans bouton à proximité | Deux boutons « Saisir une recette / une dépense » dans l’état vide, masqués pour un rôle en lecture seule |
| Message de validation affiché en bas d’un formulaire long | Erreur hors du champ de vision, l’utilisateur croyait l’enregistrement passé | Défilement automatique vers le message, déjà annoncé par `role="alert"` |
| Aucun lien d’évitement, `<main>` sans identifiant | Navigation au clavier obligée de traverser toute la barre à chaque page | Lien « Aller au contenu principal », visible au premier Tab, et `main` focalisable |
| Tableau sans `scope`, sans légende, tri non annoncé | Lecteurs d’écran incapables de relier une cellule à sa colonne ou de connaître le tri | `scope="col"`, `aria-sort`, légende en lecture seule, nombre de lignes en `aria-live` |
| Voyant d’état annonçant « Serveur à vérifier » en mode local | Vocabulaire faux : il n’y a pas de serveur hors WAMP | « Stockage à vérifier » en local, « Serveur à vérifier » sur le serveur |
| Contrôles d’accessibilité flottants en bas à droite | Ils recouvraient la colonne d’actions, désormais collée à droite | Déplacés en bas à gauche ; les notifications restent à droite |
| Connexion sans identité visuelle, `autocomplete="off"` sur les deux champs | Le gestionnaire de mots de passe du navigateur ne pouvait rien proposer | Bloc SALFA en tête de carte, `username` / `current-password` |
| Navigation mensuelle différente entre journal (flèches) et analyse (champ seul) | Geste à réapprendre d’un onglet à l’autre | Mêmes flèches précédent / suivant dans l’analyse |
| « Solde de clôture » sur une carte mensuelle | Confusion avec la clôture annuelle, qui est irréversible | Renommé « Solde en fin de période » ; infobulle du journal alignée |
| Pied de page recouvert par la barre flottante sur téléphone | Dernière ligne de la page illisible | Marge basse de 5 rem sur le contenu |
| `theme-color` unique et description « ordres de virement », fonction qui n’existe pas | Barre du navigateur claire sur thème sombre, métadonnées trompeuses | Deux `theme-color` (clair / sombre), description alignée sur le livre journal |
| Titre d’onglet figé sur « Gestion de Caisse SALFA » | Plusieurs onglets ouverts impossibles à distinguer | Le titre suit la page : « Analyse de la caisse · Caisse SALFA » |
| Texte d’aide de la connexion en `text-slate-400` | Contraste insuffisant pour une consigne utile | Passé en `text-slate-500` (et `dark:text-slate-400`) |
| Notifications et total de saisie non annoncés | Lecteurs d’écran muets après un enregistrement ou une modification de montant | `aria-live="polite"` sur la notification et sur le total |
| Serveur MySQL inaccessible et l’écran de connexion affichait la phrase technique en rouge, sous le mot de passe | On croyait à des identifiants erronés ; rien à l’écran ne disait quoi faire | Panneau « Connexion MySQL à préciser » (ou « Serveur injoignable ») au-dessus du formulaire : hôte, port, base, utilisateur et mot de passe à saisir une fois — le serveur crée alors lui-même sa base, ses tables et ses comptes, sans aucune page d’installation. Bouton « Réessayer » qui reteste `api/index.php?action=sante`, lien vers le diagnostic JSON |

## Ce qui a été volontairement laissé tel quel

- **Le document imprimé reste blanc, encre noire, coté en millimètres.** C’est
  le fac-similé des imprimés officiels : le thème sombre ne doit jamais
  l’atteindre. Les utilitaires `dark:` n’y ont pas été ajoutés.
- **La densité du tableau du journal** (huit colonnes) répond au besoin
  comptable ; c’est le défilement qui a été rendu supportable, pas le contenu
  qui a été appauvri.
- **Les couleurs de rôle** (recette verte, dépense rouge) sont conservées : elles
  portent un sens constant dans toute l’application.

## Vérifications effectuées

- `npm run lint` : TypeScript strict, aucune erreur.
- `npm test` : **126 tests** unitaires et d’intégration passés.
- `npm run build` : build de production réussi (`index.css` 73,8 kB, `index.js`
  391 kB avant compression).
- Contrôle du CSS compilé : les utilitaires ajoutés (`dark:bg-slate-800/40`,
  `dark:text-brand-200`, `sm:sticky`, `dark:bg-emerald-950`, `.lien-evitement`)
  sont bien générés, donc réellement appliqués.
- `tests/e2e/caisse.spec.ts` : les six parcours ouvrent maintenant une session
  avant d’agir, et deux parcours les complètent — mode sombre (fond sombre,
  titre clair, préférence conservée après actualisation) et accroche de la barre
  de filtres (position collante et décalage de zéro pixel avec l’en-tête sur
  ordinateur, bloc simple sur téléphone).

> Le navigateur Chromium n’est pas installé dans l’environnement de cet audit
> (`npx playwright install` y est bloqué). Les parcours Playwright ont été mis à
> jour et relus, mais `npm run test:e2e` doit être lancé sur un poste outillé
> avant diffusion.

## Déploiement serveur : aucune installation

La version serveur se résume à **copier un dossier** dans `C:\wamp64\www\caisse-salfa`.
Le dossier est livré dans le dépôt (`deploy/wamp/caisse-salfa/`, avec l'archive
`caisse-salfa.zip`) et ne contient que ce que montre l'explorateur Windows :
`api`, `assets`, `.htaccess`, `.user.ini`, `favicon`, `index`.

- Le premier appel de l'API écrit sa configuration (hors de `www` quand c'est
  possible, sinon dans `api\data\`), crée la base `caisse_salfa`, ses 14 tables,
  les catégories, les modèles de bordereaux et deux comptes de départ
  (`admin` / `admin123`, `comptable` / `comptable123`).
- Il n'y a **ni page d'installation, ni script `.bat`, ni ligne de commande, ni
  fichier à modifier**.
- Si MySQL refuse l'accès par défaut de WAMP (mot de passe personnalisé, port
  3307), l'écran de connexion demande une fois les accès MySQL : même résultat,
  sans quitter l'application. Le formulaire ne revient plus ensuite.
- L'amorçage est idempotent : une copie interrompue, un redémarrage ou un
  deuxième appel ne détruisent ni ne dupliquent rien ; un mot de passe déjà
  changé n'est jamais réinitialisé.
- Vérifié sous PHP 8.4 (WebAssembly) : amorçage complet (configuration, base,
  14 tables, comptes), détection des chemins de configuration, résolution
  automatique des ports MySQL 3306/3307/3308, et 24 tests de l'API verts.

## Version du paquet

Le paquet livré annonçait deux versions différentes : `api/index.php?action=verifier`
répondait `versionApi: 1.2` quand `api/index.php?action=sante` répondait `1.1`, et
aucun écran n’indiquait la version réellement installée. Une mise à jour partielle
de `C:\wamp64\www\caisse-salfa` (une page recopiée, pas l’API) passait donc
inaperçue.

- Une seule valeur fait foi : le champ `version` de `package.json`. Elle est
  recopiée dans `src/utils/version.ts` (`VERSION_APPLICATION`) ; le test
  `src/utils/version.test.ts` échoue si les deux divergent. L’API PHP, livrée
  hors de ce dépôt, annonce la même version (`SALFA_VERSION_API`).
- Le paquet serveur inscrit la version dans `index.html`
  (`<meta name="salfa-version" content="1.2.0">`) et refuse un index sans elle.
- Le pied de page affiche `v1.2.0`. En mode serveur, il ajoute la version
  annoncée par l’API et affiche un bandeau orange si les deux diffèrent :
  « Paquet incomplet ».
- La réponse JSON de `?action=verifier` compare les deux versions, ligne
  « version du paquet » : une copie partielle du dossier est ainsi repérée.

## Recommandations restantes

- Ramener les textes d’aide encore en `text-slate-400` (compteurs, mentions
  secondaires) à `text-slate-500` pour atteindre le niveau AA partout.
- Envisager une vue « cartes » du journal sur téléphone si l’usage mobile
  devient majoritaire : le tableau restera le format de référence sur poste fixe.
- Rendre l’en-tête du tableau collant pendant le défilement vertical des
  périodes longues (10 000 écritures possibles).
- Ajouter des captures de non-régression visuelle dans les parcours Playwright,
  une fois le navigateur disponible.
- Si la caisse est traduite (malgache, français, anglais), sortir les libellés
  de rôles et de documents des composants.

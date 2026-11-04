# CAISSE SALFA — Livre journal de trésorerie

Application de **trésorerie hospitalière** : tenue du livre journal de la caisse
(recettes, dépenses, bordereaux détaillés), analyse par période et sauvegardes.

Deux modes, un seul code source :

| Mode | Stockage | Usage |
| --- | --- | --- |
| **local** (par défaut) | stockage du navigateur | poste isolé, démonstration, tests |
| **serveur** | MySQL via l’API PHP | partage entre plusieurs postes du service, déploiement WAMP |

Le mode serveur est produit par `npm run build:wamp` : `index.html` compilé à la
racine du paquet, API PHP/MySQL, dossier `data/` privé et scripts `.bat` —
**sans aucun Node.js sur le serveur**. Voir `deploy/wamp/INSTALLATION.md`.

## Démarrer

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # vérification TypeScript + build de production
npm run lint       # tsc --noEmit
npm test           # tests unitaires et intégration (Vitest / Testing Library)
npm run check      # lint + tests + build
```

Paquet de déploiement Windows/WAMP (frontend compilé + API PHP + scripts `.bat`) :

```bash
npm run build:wamp     # compile en mode API et remplit deploy/wamp (index.html racine)
```

Tests dans un vrai navigateur (Chromium) :

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

`bun.lock` est également maintenu pour les environnements qui utilisent Bun.

Installez avec `npm ci` (ou `bun install`) plutôt qu’avec `npm install`, afin de
garder les versions verrouillées par `package-lock.json`.

## Fonctionnalités

- **Livre journal** : recettes et dépenses, solde cumulé chronologique, report à
  nouveau du mois, recherche insensible aux accents, filtres par type et
  catégorie, pagination à l’écran.
- **Saisie contrôlée** : date calendaire valide, montants entiers en ariary,
  référence de pièce et observation distinctes, catégorie, tiers/service. Le
  total d’une écriture détaillée doit être exactement égal à la somme de ses
  postes.
- **Bordereaux détaillés** : postes et montants, modèles réutilisables avec
  montants par défaut facultatifs et ordre des postes conservé. Un seul poste
  complété suffit ; les lignes laissées vides sont ignorées à l’enregistrement.
- **Impression immédiate** : le bordereau imprimable s’ouvre automatiquement
  après l’enregistrement d’une pièce, prêt à être imprimé. La colonne « Action »
  du journal propose l’impression, la modification et la suppression de chaque
  pièce, y compris celles saisies en montant unique.
- **Documents conformes aux modèles officiels** : l’engagement de dépense
  (« DEMANDE D’ENGAGEMENT DE DÉPENSE ») et l’autorisation de recette
  (« AUTORISATION DE RECETTE ») reprennent la présentation des imprimés SALFA :
  en-tête de l’hôpital sur sept lignes, « DATE : » en gras, « Objet : »,
  « Pièce n° », tableau à cinq colonnes (N°, Libellé, N° Compte, Montant,
  Observation), ligne de total (« TOTAL DES DÉPENSES » ou
  « TOTAL DES RECETTES »), mention « Arrêtée à la somme de … ariary » écrite en
  toutes lettres, puis les cases de signature — Caissier(e), Gestionnaire et
  Médecin Chef pour une recette, auxquelles s’ajoute le Demandeur pour une
  dépense. Le document s’imprime seul, sur une page A4 portrait.
- **Masques de saisie** : les montants s’écrivent avec séparation des milliers
  (1 250 000) et un curseur stable ; les libellés et les postes sont saisis en
  majuscules.
- **Catégories gérées par sens** : les recettes et les dépenses ont chacune
  leur liste de catégories, modifiable depuis le bouton « Gérer » du formulaire
  de saisie (ajout, renommage, ordre, suppression, restauration des listes
  livrées). Retirer une catégorie ne modifie jamais une écriture existante.
- **Document par pièce** : chaque dépense reçoit une **demande d’engagement**
  (`AED-AAAA-0001`) et chaque recette une **autorisation de recette**
  (`ARC-AAAA-0001`). Le numéro reprend l’année et le rang de la pièce
  (`DP-2026-0007` → `AED-2026-0007`) : les deux se répondent toujours, y compris
  après réimpression.
- **En-tête personnalisable** : l’engagement de dépense et l’autorisation de
  recette ont chacun leur propre en-tête, modifiable depuis le bouton
  « En-tête » du journal ou depuis un bordereau ouvert. Deux modes : « Textes et
  logos » (huit lignes de texte, deux logos facultatifs, aperçu immédiat) ou
  « Image complète » (PNG/JPEG d’1 Mo maximum). « Restaurer l’en-tête fourni »
  revient au modèle livré, pour le seul document affiché. L’en-tête suit le
  livre : il est enregistré localement ou dans MySQL (`salfa_entetes`) et
  transporté par les sauvegardes JSON.
- **Numérotation stable** : `RC-AAAA-0001` / `DP-AAAA-0001`. Les compteurs sont
  persistés : supprimer une pièce ne libère pas son numéro. Une modification
  conserve le numéro et la date de création d’origine.
- **Annulation de suppression** : la dernière écriture supprimée peut être
  restaurée depuis le journal tant qu’elle n’a pas été remplacée par une autre
  opération de suppression.
- **Analyse** : répartition des recettes et dépenses par catégorie et ratio
  dépenses/recettes de la période.
- **Clôture annuelle** : le livre ne grossit pas indéfiniment. Chaque année est
  un exercice ; la clôture fige ses écritures dans une archive, reporte le solde
  sur l’année suivante et bloque toute saisie sur l’année close.
- **Mode serveur WAMP** : API PHP 8.1+ sans Composer, MySQL/MariaDB, comptes et
  rôles (`lecteur`, `caissier`, `admin`), sessions à expiration, limitation des
  tentatives, journal d’audit, verrou optimiste par révision (409 explicite) et
  revalidation intégrale de chaque écriture côté serveur.
- **Exports** : CSV compatible Excel (UTF-8 BOM, séparateur `;`), protection
  contre l’injection de formules, colonnes mode/référence/observation, montants
  détaillés non comptés deux fois. Les totaux exportés correspondent à la
  sélection affichée ; le solde de clôture reste celui de la période complète.
- **Impression** : journal en A4 paysage (toutes les pages de la sélection),
  bordereau seul en A4 portrait avec ses zones de signature.
- **Sauvegardes JSON** : export complet, vérification avant import, aperçu,
  confirmation explicite et sauvegarde automatique du livre actuel avant
  remplacement. Un export brut de secours est disponible pour le diagnostic.
- **Onglet Exercices & clôtures** : exercice en cours, solde reporté, historique
  des clôtures et téléchargement d’une archive autonome par exercice.
- **Livres antérieurs** : un livre créé avant cette version reste lisible ; il
  est converti à l’ouverture, les années passées étant archivées et l’année
  courante ouverte, avec un avertissement explicite.
- **Robustesse** : sauvegarde atomique, erreurs de stockage visibles, contrôle de
  révision entre onglets, migration des anciennes données, garde-fou en cas de
  stockage corrompu, boîtes de dialogue accessibles et interface responsive.
- **Navigation** : une seule barre d’en-tête (journal, analyse, données,
  modèles), sans panneau latéral ; libellés abrégés et entièrement visibles sur
  téléphone.

## Règles de gestion

- **Un exercice = une année civile.** Le livre en cours ne contient que les
  écritures de l’année ouverte ; les années précédentes sont des archives
  figées, consultables et exportables, mais non modifiables.
- **Impossible de clôturer une année encore en cours.** La clôture n’est
  autorisée qu’à partir du **1er janvier suivant** : pendant l’année, le bouton
  reste désactivé et indique la date d’ouverture de la clôture.
- **La clôture est explicite.** Elle télécharge d’abord une sauvegarde complète,
  archive les écritures, reporte le solde en solde d’ouverture de l’année
  suivante et remet la saisie à zéro. L’opération est irréversible.
- **Une saisie doit appartenir à l’exercice ouvert.** Le sélecteur de date est
  borné au 1er janvier–31 décembre de cet exercice ; une date hors exercice est
  refusée, jamais décalée.
- Si la nouvelle année a commencé sans clôture, une bannière le signale : les
  saisies restent bloquées sur l’année ouverte jusqu’à la clôture.
- Une clôture demandée avant l’échéance est refusée côté métier **et** côté
  interface : aucune archive ne peut être créée par anticipation.
- L’application ne gère qu’un seul mode de paiement : **les espèces**. Le champ
  n’est plus demandé à la saisie ; les écritures anciennes qui portent un autre
  mode restent lisibles telles quelles jusqu’à leur modification.
- Les montants sont des **entiers MGA**. Les décimales, les notations scientifiques
  et les valeurs vides ne sont pas converties silencieusement en zéro.
- Le **solde d’ouverture du livre** précède tout l’historique conservé. Ce n’est
  pas le solde d’ouverture du mois affiché ; le modifier recalcule tous les soldes.
- Les filtres réduisent les lignes et les totaux affichés, mais les **soldes
  cumulés** restent calculés sur le livre complet afin de ne pas fausser la
  trésorerie.
- Une écriture détaillée doit avoir au moins un poste positif ; chaque poste
  conservé doit avoir un libellé et un montant positif. Les postes à zéro d’un
  modèle doivent être complétés ou supprimés avant l’enregistrement.
- Limites techniques : 10 000 écritures, 200 postes par écriture/modèle,
  500 modèles, montant unitaire maximal de 999 999 999 999 Ar, import JSON de
  8 Mo maximum. Le solde cumulé doit rester dans la plage des entiers fiables
  de JavaScript.

## Données et sauvegardes

Le livre courant est enregistré atomiquement dans :

- `salfa_tresorerie_livre_v2` — écritures, paramètres, modèles, compteurs,
  révision et horodatage.

Les anciennes clés sont lues au premier lancement si la nouvelle clé est absente :

- `salfa_tresorerie_ecritures_v1` ou `salfa_caisse_transactions` ;
- `salfa_tresorerie_parametres_v1` ;
- `salfa_tresorerie_masques_v1`.

Un livre antérieur sans exercice est normalisé une seule fois, sans perte :
ses écritures des années passées sont archivées (montant et totaux conservés)
et l’année la plus récente reste ouverte.

La migration conserve les clés d’origine. Elle reprend les références, attribue
les numéros manquants sans collision et recalcule les
anciens totaux détaillés incohérents à partir des postes positifs, avec un
avertissement explicite. Les données invalides bloquent la migration plutôt que
d’être écartées en silence.

Une **sauvegarde JSON complète** utilise le format `CAISSE-SALFA`, version 1.
Elle peut être restaurée dans un autre navigateur. La restauration **remplace**
le livre ; elle ne fusionne pas les écritures. L’**export brut de secours**
conserve les chaînes localStorage d’origine, y compris corrompues ; il est destiné
au diagnostic et n’est pas un fichier de restauration.

### Important

Le stockage local et les fichiers exportés ne sont **pas chiffrés par
l’application**. Il n’y a pas d’authentification, de serveur, de synchronisation
multi-appareil ni de piste d’audit immuable. Effacer les données du site, changer
de profil ou utiliser la navigation privée peut entraîner une perte des données.
Utilisez un appareil protégé, exportez une sauvegarde après chaque session et
conservez plusieurs copies dans des emplacements sûrs.

## Structure

```text
src/
  App.tsx                         navigation, filtres, actions et notifications
  types.ts                        modèle de données et format de sauvegarde
  hooks/useLivre.ts               état, persistance, migration, multi-onglets
  components/
    SaisieEcriture.tsx            formulaire recette/dépense et postes
    LivreJournal.tsx              journal, détails et dépliage des postes
    Bordereau.tsx                 document imprimable et sa boîte de dialogue
    EnteteBordereauModal.tsx      en-tête modifiable des deux bordereaux
    Synthese.tsx                  indicateurs et solde initial
    Analyse.tsx                   statistiques par catégorie et ratio
    Exercices.tsx                 exercice en cours, clôtures et archives
    DonneesSauvegardes.tsx        export/import JSON et secours brut
    GestionMasquesModal.tsx       modèles de bordereaux
    GestionCategoriesModal.tsx    catégories de recettes et de dépenses
    ChampMontant.tsx              saisie monétaire à séparateurs de milliers
    Modale.tsx / Confirmation.tsx dialogues natifs accessibles
    ErrorBoundary.tsx             garde-fou d’affichage
  utils/
    ledger.ts                     calculs, numérotation, mutations, clôture annuelle
    validation.ts                 validation stricte des données
    storage.ts                    stockage atomique et migration
    backup.ts                     sauvegardes JSON et secours
    export.ts                     CSV sûr et téléchargements
    format.ts                     dates locales et montants
    constants.ts                  catégories, modes, limites, modèles
    entete.ts                     modèle, validation et valeurs par défaut des en-têtes
    nombreEnLettres.ts            montants écrits en toutes lettres (ariary)
  test/                           configuration et fixtures de tests
tests/e2e/                        parcours Chromium (desktop, mobile, onglets)
```

Voir aussi [`AUDIT.md`](./AUDIT.md) pour le détail des corrections effectuées.

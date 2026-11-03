# CAISSE SALFA — Livre journal de trésorerie

Application de **trésorerie hospitalière** : tenue du livre journal de la caisse
(recettes, dépenses, bordereaux détaillés), analyse par période et sauvegardes
locales. Les données restent dans le navigateur ; aucun serveur applicatif ni
service externe n’est nécessaire.

## Démarrer

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # vérification TypeScript + build de production
npm run lint       # tsc --noEmit
npm test           # tests unitaires et intégration (Vitest / Testing Library)
npm run check      # lint + tests + build
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
  nouveau du mois, recherche insensible aux accents, filtres par type, catégorie
  et mode de paiement, pagination à l’écran.
- **Saisie contrôlée** : date calendaire valide, montants entiers en ariary,
  mode de paiement, référence de pièce et observation distinctes, catégorie,
  tiers/service. Le total d’une écriture détaillée doit être exactement égal à
  la somme de ses postes.
- **Bordereaux détaillés** : postes, références/quittances, modèles réutilisables
  avec montants par défaut facultatifs et ordre des postes conservé.
- **Numérotation stable** : `RC-AAAA-0001` / `DP-AAAA-0001`. Les compteurs sont
  persistés : supprimer une pièce ne libère pas son numéro. Une modification
  conserve le numéro et la date de création d’origine.
- **Annulation de suppression** : la dernière écriture supprimée peut être
  restaurée depuis le journal tant qu’elle n’a pas été remplacée par une autre
  opération de suppression.
- **Analyse** : répartition des recettes et dépenses par catégorie, mouvements
  par mode de paiement, ratio dépenses/recettes de la période.
- **Exports** : CSV compatible Excel (UTF-8 BOM, séparateur `;`), protection
  contre l’injection de formules, colonnes mode/référence/observation, montants
  détaillés non comptés deux fois. Les totaux exportés correspondent à la
  sélection affichée ; le solde de clôture reste celui de la période complète.
- **Impression** : journal en A4 paysage (toutes les pages de la sélection),
  bordereau seul en A4 portrait avec zones de signature.
- **Sauvegardes JSON** : export complet, vérification avant import, aperçu,
  confirmation explicite et sauvegarde automatique du livre actuel avant
  remplacement. Un export brut de secours est disponible pour le diagnostic.
- **Robustesse** : sauvegarde atomique, erreurs de stockage visibles, contrôle de
  révision entre onglets, migration des anciennes données, garde-fou en cas de
  stockage corrompu, boîtes de dialogue accessibles et interface responsive.

## Règles de gestion

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

La migration conserve les clés d’origine. Elle reprend le mode de paiement et
les références, attribue les numéros manquants sans collision et recalcule les
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
    LivreJournal.tsx              journal, détails, bordereau imprimable
    Synthese.tsx                  indicateurs et solde initial
    Analyse.tsx                   statistiques par catégorie et mode
    DonneesSauvegardes.tsx        export/import JSON et secours brut
    GestionMasquesModal.tsx       modèles de bordereaux
    Modale.tsx / Confirmation.tsx dialogues natifs accessibles
    ErrorBoundary.tsx             garde-fou d’affichage
  utils/
    ledger.ts                     calculs, tri, numérotation, mutations
    validation.ts                 validation stricte des données
    storage.ts                    stockage atomique et migration
    backup.ts                     sauvegardes JSON et secours
    export.ts                     CSV sûr et téléchargements
    format.ts                     dates locales et montants
    constants.ts                  catégories, modes, limites, modèles
  test/                           configuration et fixtures de tests
tests/e2e/                        parcours Chromium (desktop, mobile, onglets)
```

Voir aussi [`AUDIT.md`](./AUDIT.md) pour le détail des corrections effectuées.

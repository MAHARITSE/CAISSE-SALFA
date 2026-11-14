# CAISSE SALFA — Livre journal de trésorerie

Application de **trésorerie hospitalière** : tenue du livre journal de la caisse
(recettes, dépenses, bordereaux détaillés), analyse par période et sauvegardes.

Deux modes, un seul code source :

| Mode | Stockage | Usage |
| --- | --- | --- |
| **local** (par défaut) | stockage du navigateur | poste isolé, démonstration, tests |
| **serveur** | **MySQL uniquement** (aucun stockage navigateur) | partage entre plusieurs postes du service, déploiement WAMP |

Le mode serveur s’installe par **simple copie d’un dossier** dans
`C:\wamp64\www\caisse-salfa` : le dossier prêt à l’emploi est livré dans
[`deploy/wamp/caisse-salfa/`](./deploy/wamp/caisse-salfa) (et dans
`deploy/wamp/caisse-salfa.zip`). Il contient `index.html` compilé, `assets/`,
`api/`, `.htaccess`, `.user.ini`, `favicon`. Aucun Node.js sur le serveur et
**aucune installation** : le premier appel crée la configuration, la base MySQL,
les tables et les comptes de départ. En mode serveur, **la base MySQL est la seule
source de vérité** : l’application ne lit ni n’écrit le stockage du navigateur,
et la session est portée par un cookie PHP. La base de départ est également
livrée en clair dans `api/caisse-salfa.sql`, importable dans phpMyAdmin si l’on
préfère ne pas laisser l’API la créer. Voir
[`deploy/wamp/api/README.md`](./deploy/wamp/api/README.md).
(`?api=1` dans l’URL force le mode serveur.)

## Démarrer

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # vérification TypeScript + build de production
npm run lint       # tsc --noEmit
npm test           # tests unitaires et intégration (Vitest / Testing Library)
npm run check      # lint + tests + build
```

Paquet serveur WAMP — déjà livré dans `deploy/wamp/`, à copier dans `www`.
Pour le régénérer après une modification du code :

```bash
npm run build:wamp     # met à jour deploy/wamp/caisse-salfa/ et caisse-salfa.zip
```

Tests dans un vrai navigateur (Chromium) :

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

La version de l’application n’est écrite qu’une fois : le champ `version` de
`package.json`. Elle est recopiée dans `src/utils/version.ts`, et
`src/utils/version.test.ts` échoue si les deux divergent. Le pied de page affiche
la version et signale un paquet serveur dont l’interface et l’API ne sont pas de
la même version.

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
  (« AUTORISATION DE RECETTES ») reproduisent les imprimés SALFA fournis.
  L’en-tête de l’hôpital occupe sept lignes entre ses deux logos ; viennent
  ensuite le titre, « Pièce n° », « DATE : » et « Objet : » soulignés, le
  tableau à cinq colonnes (N°, Libellé, N° Compte, Montant, Observation), la
  ligne « TOTAL DES RECETTES » ou « TOTAL DES DÉPENSES », la mention « Arrêtez
  à la somme de … Ariary » écrite en toutes lettres, puis les cases de
  signature — Caissier(e), Gestionnaire et Médecin Chef pour une recette,
  auxquelles s’ajoute le Demandeur pour une dépense.
  Les cotes sont celles des modèles, relevées en millimètres sur une page A4 :
  marges de 7,6 mm, colonnes de 11,2 / 87,0 / 22,0 / 35,9 / 41,5 mm, lignes de
  11,6 mm. Le document est envoyé à la fenêtre d’impression du navigateur
  au format A4 portrait. Les montants portent deux décimales (2 657 400,00).
- **Masques de saisie** : les montants s’écrivent avec séparation des milliers
  (1 250 000) et un curseur stable ; les libellés et les postes sont saisis en
  majuscules, comme les catégories nouvellement saisies ou renommées. Les données
  historiques ne sont pas converties automatiquement. Les montants affichés ont
  deux décimales et des séparateurs de milliers ; la saisie reste en ariary
  entiers. Dans la zone d’ajout d’un poste, Entrée a le même effet que le bouton
  « Ajouter » ; un poste en cours doit être ajouté ou vidé avant l’enregistrement.
  Le libellé de l’écriture est saisi librement, sans liste de suggestions.
  La devise n’est pas répétée dans les tableaux.
- **Catégories gérées par sens** : les recettes et les dépenses ont chacune
  leur liste de catégories, modifiable depuis le bouton « Gérer » du formulaire
  de saisie (ajout, renommage, ordre, suppression, restauration des listes
  livrées). Retirer une catégorie ne modifie jamais une écriture existante.
- **Document par pièce** : chaque dépense reçoit une **demande d’engagement**
  (`AED-AAAA-0001`) et chaque recette une **autorisation de recette**
  (`ARC-AAAA-0001`). Le numéro reprend l’année et le rang de la pièce
  (`DP-2026-0007` → `AED-2026-0007`) : les deux se répondent toujours, y compris
  après réimpression.
- **En-tête personnalisable** : la demande d’engagement de dépense et
  l’autorisation de recette portent le **même papier à en-tête**, réglé une
  seule fois depuis le bouton « En-tête ». Chaque ligne se met en forme comme
  dans un traitement de texte — police, taille au demi-point, gras, italique,
  souligné, alignement — et l’on ajoute, réordonne ou supprime des lignes.
  Le bordereau imprimé conserve la casse et la mise en forme choisies dans
  l’éditeur, ainsi que les positions des images.
  Les images se **glissent librement sur la feuille A4** : on les dépose, on les
  déplace à la souris ou au doigt, puis on les règle au millimètre (position et
  largeur). L’aperçu montre la feuille entière. « Restaurer l’en-tête fourni »
  revient au modèle livré, logos compris. Un livre créé avant cette version
  reprend ses deux anciens logos comme images placées. L’en-tête suit le livre :
  il est enregistré localement ou dans MySQL (`salfa_entetes`) et transporté par
  les sauvegardes SQL.
- **Numérotation stable** : `RC-AAAA-0001` / `DP-AAAA-0001`. Les compteurs sont
  persistés : supprimer une pièce ne libère pas son numéro. Une modification
  conserve le numéro et la date de création d’origine.
- **Deux livres, deux jeux de réglages** : Administration range d’un côté le
  **livre de caisse** (modèles de saisie, catégories, en-tête des bordereaux) et
  de l’autre le **livre des virements** (comptes bancaires et RIB). Aucun réglage
  d’un livre ne se règle dans la section de l’autre.
- **Comptes bancaires et RIB, réglés dans Administration** : la section
  « Comptes bancaires et RIB » liste les comptes de l’hôpital et permet de les
  **ajouter**, de les **modifier** ou de les **supprimer** (banque, numéro de
  compte / RIB, titulaire — donneur d’ordre —, adresse et code banque à cinq
  chiffres). Un compte dont le numéro manque porte la mention « RIB à
  compléter » ; le bouton « Préparer BNI/C et BNI/D » crée les deux comptes
  manquants sans numéro, à compléter ensuite. Un compte qui porte des virements
  ne peut pas être supprimé : ses ordres déjà émis perdraient leur RIB — son
  numéro se corrige, il ne se retire pas. Ce réglage est réservé à
  l’administrateur ; le livre des virements, lui, ne fait que les utiliser.
- **Clients et fournisseurs** : le bénéficiaire d’un virement vient d’une fiche,
  tenue dans le livre des virements. Un **client** pour une recette ; un
  **fournisseur** pour une DED, dont le **RIB est obligatoire** (établissement
  bancaire et numéro de compte) puisqu’il s’imprime sur l’ordre de virement. Le
  choix de la fiche remplit le nom et les mentions du bénéficiaire, qui restent
  modifiables pour une pièce particulière. Aucun virement ne s’enregistre sans
  fiche ; les pièces antérieures gardent leur tiers écrit à la main. Une fiche
  qui porte des virements ne se supprime pas, elle se corrige.
- **Livre des virements** : l’administrateur et le comptable saisissent et
  corrigent les recettes ou DED par virement sur les comptes réglés dans
  Administration, filtrent le registre et impriment des bordereaux individuels
  ou un état séparant recettes et dépenses. Les séries `VR-AAAA-0001` et
  `VD-AAAA-0001` sont distinctes des pièces de caisse. Aucun solde bancaire n’est
  calculé ; la clôture en espèces ne modifie pas le registre bancaire.
- **Ordre de virement obligatoire** : chaque **DED par virement** imprime
  aussitôt, sans aperçu, l’**ordre de virement** du formulaire BNI 114018 remis à
  la banque, en **un seul exemplaire** dans la moitié haute de la feuille A4,
  sans souche ni trait de découpe. Date, compte débité
  et son RIB, bénéficiaire, montant en chiffres et en toutes lettres, référence,
  observations et signature y figurent ; le titre, le nom de la banque et les
  mentions du modèle sont reproduits, sans aucune image : le document n’embarque
  pas de logo et se complète au besoin à la main. L’ordre est réimprimable depuis
  la ligne du virement.
  Les recettes par virement n’impriment rien : rien n’est à envoyer à la banque.
  Les mentions propres au bénéficiaire (adresse, établissement bancaire, compte
  ou RIB) et le caractère permanent ou occasionnel se saisissent dans le
  formulaire du virement ; **une mention laissée vide reste en blanc sur le
  papier**, à compléter à la main, pour ne jamais bloquer un enregistrement.
- **Annulation de suppression** : la dernière écriture supprimée peut être
  restaurée depuis le journal tant qu’elle n’a pas été remplacée par une autre
  opération de suppression.
- **Analyse** : répartition des recettes et dépenses par catégorie et ratio
  dépenses/recettes de la période. L’aperçu des dépenses permet de rechercher,
  trier et déplier les pièces. La liste reste compacte : le bouton « Catégorie »
  ouvre le formulaire uniquement pour la pièce à corriger. Les utilisateurs
  autorisés peuvent modifier la catégorie d’une dépense de l’exercice ouvert ;
  le comptable et les exercices clôturés restent en lecture seule.
- **Clôture annuelle** : le livre ne grossit pas indéfiniment. Chaque année est
  un exercice ; la clôture fige ses écritures dans une archive, reporte le solde
  sur l’année suivante et bloque toute saisie sur l’année close.
- **Mode serveur WAMP** : API PHP 8.1+ sans Composer, MySQL/MariaDB, comptes et
  rôles (`lecteur`, `caissier`, `admin`), sessions à expiration, limitation des
  tentatives, journal d’audit, verrou optimiste par révision (409 explicite) et
  revalidation intégrale de chaque écriture côté serveur.
- **Export Excel** : classeur `.xlsx` avec montants numériques, textes sans
  formules et détails non comptés deux fois. Les totaux correspondent à la
  sélection affichée ; le solde de clôture reste celui de la période complète.
- **Impression du journal** : le bouton Imprimer ouvre la sélection dans la
  visionneuse PDF du navigateur, avec l’en-tête des bordereaux, les catégories
  en objet et la signature du Gestionnaire sur la dernière page. Si le dialogue
  ne s’ouvre pas automatiquement, utiliser Imprimer dans la visionneuse. Il faut
  autoriser les fenêtres contextuelles pour la caisse. Les bordereaux individuels
  restent imprimables en A4 portrait avec leurs zones de signature.
- **Sauvegardes SQL** : export MySQL complet en mode serveur, ou instantané SQL
  du livre en mode local. La restauration dans l’application vérifie un instantané
  intégré au fichier, demande confirmation et sauvegarde le livre actuel avant
  remplacement. Elle restaure le livre, pas les comptes ; pour restaurer également
  les comptes ou un ancien dump, utiliser phpMyAdmin. Aucun SQL importé n’est
  exécuté par l’application. Un export brut SQL sert au diagnostic local.
- **Onglet Exercices & clôtures** : exercice en cours, solde reporté, historique
  des clôtures et téléchargement d’une archive autonome par exercice.
- **Exemples de démonstration** : sur un livre encore vide, « Données &
  sauvegardes » propose de charger un jeu d’exemples — écritures de caisse avec
  leurs lignes de détail, deux comptes BNI avec leur RIB, clients, fournisseurs et
  virements datés de l’année en cours. Le chargement demande une confirmation et
  télécharge la sauvegarde SQL du livre en place ; il disparaît dès la première
  pièce enregistrée. Le livre des virements a le sien : « Charger des exemples »
  y ajoute les comptes et les fiches manquants sans rien remplacer, et les deux
  virements d’exemple tant que le registre n’en contient aucun.
- **Livres antérieurs** : un livre créé avant cette version reste lisible ; il
  est converti à l’ouverture, les années passées étant archivées et l’année
  courante ouverte, avec un avertissement explicite.
- **Robustesse** : sauvegarde atomique, erreurs de stockage visibles, contrôle de
  révision entre onglets, migration des anciennes données, garde-fou en cas de
  stockage corrompu, boîtes de dialogue accessibles et interface responsive.
- **Navigation** : une seule barre d’en-tête (journal, analyse, exercices,
  données, administration — chacun selon son rôle), sans panneau latéral ;
  libellés abrégés et entièrement visibles sur téléphone. La barre de filtres
  s’accroche sous l’en-tête quelle que soit sa hauteur réelle, mesurée à
  l’affichage, y compris après un changement de taille de police.
- **Interface** : thème clair et thème sombre complets (aucune page ne reste en
  texte foncé sur fond foncé), colonne d’actions du journal toujours atteignable
  quand le tableau défile, états vides qui proposent directement la saisie,
  lien d’évitement « Aller au contenu », tri des colonnes annoncé aux lecteurs
  d’écran, messages d’erreur amenés sous les yeux, et titre de l’onglet du
  navigateur qui suit la page ouverte. Le détail se lit dans
  [`INTERFACE.md`](./INTERFACE.md).

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
- Le livre de caisse reste réservé aux **espèces**. Les virements sont saisis
  dans leur propre registre et ne modifient jamais le solde de caisse ; les
  écritures anciennes gardent leur mode jusqu’à leur modification.
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

La sauvegarde migrée livrée (`sauvegarde_caisse_salfa.sql`) place le report de
12 596 600 Ar au 01/01/2025 (pièce RC-2025-0927, anciennement RC-2024-0001).
L’ouverture de 2025 est ramenée à zéro : le report figure dans les recettes de
2025 et la clôture reste à 4 626 500 Ar. L’archive 2024 est désormais vide.
Le fichier livré reflète uniquement les données des classeurs historiques : il
ne contient pas les saisies ultérieures d’une installation existante. Sa
restauration **remplace le livre entier sans fusion**. Exporter d’abord une
sauvegarde récente et ne pas restaurer ce fichier si les nouvelles données
doivent être conservées. La mise à jour de l’installation ne modifie pas
automatiquement un livre existant.

Une **sauvegarde SQL récente** produite par l’application contient un instantané
validable du livre. Le bouton de restauration remplace le livre sans fusion et
ne modifie pas les comptes utilisateurs. Les virements et comptes bancaires sont inclus ;
une ancienne sauvegarde sans registre bancaire conserve celui en place. Le fichier est limité à 24 Mo (8 Mo pour le livre
intégré). En mode WAMP, le dump SQL contient aussi les comptes hachés et peut
être restauré intégralement avec phpMyAdmin ; pour les anciens dumps sans
instantané, utiliser également phpMyAdmin. En mode local, le SQL contient le
livre sous forme d’instantané dans une table de sauvegarde, pas une base WAMP.
L’export brut de secours conserve les clés locales pour diagnostic ; il ne
constitue pas un fichier de restauration automatique.

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
    OrdreVirement.tsx             ordre de virement bancaire (demi-A4, formulaire BNI)
    EnteteBordereauModal.tsx      éditeur de l’en-tête commun (polices, images libres)
    Synthese.tsx                  indicateurs et solde initial
    Analyse.tsx                   statistiques par catégorie et ratio
    Exercices.tsx                 exercice en cours, clôtures et archives
    DonneesSauvegardes.tsx        export SQL, restauration du livre et secours brut
    GestionMasquesModal.tsx       modèles de bordereaux
    GestionCategoriesModal.tsx    catégories de recettes et de dépenses
    ChampMontant.tsx              saisie monétaire à séparateurs de milliers
    Modale.tsx / Confirmation.tsx dialogues natifs accessibles
    ErrorBoundary.tsx             garde-fou d’affichage
  utils/
    ledger.ts                     calculs, numérotation, mutations, clôture annuelle
    validation.ts                 validation stricte des données
    storage.ts                    stockage atomique et migration
    backup.ts                     instantanés SQL, validation et secours
    export.ts                     téléchargements et utilitaires CSV
    export-excel.ts               classeur Excel du journal
    export-pdf.ts                 état imprimable de la sélection
    format.ts                     dates locales et montants
    constants.ts                  catégories, modes, limites, modèles
    entete.ts                     modèle, validation et valeurs par défaut des en-têtes
    nombreEnLettres.ts            montants écrits en toutes lettres (ariary)
  assets/
    logo-salfa-gauche.png         logos des imprimés, incorporés au paquet
    logo-salfa-droit.png
  test/                           configuration et fixtures de tests
tests/e2e/                        parcours Chromium (desktop, mobile, onglets)
```

Voir aussi [`AUDIT.md`](./AUDIT.md) pour le détail des corrections métier et
[`INTERFACE.md`](./INTERFACE.md) pour l’audit d’interface (thème sombre,
accessibilité, ergonomie) et ses vérifications.

### Demandes de précision sur une écriture

Dans le journal de l'exercice ouvert, l'administrateur utilise le bouton « ? » de la ligne pour envoyer une demande. Tous les administrateurs et caissiers la voient dans le panneau des demandes du journal ; celui-ci se met à jour à la connexion et toutes les minutes. Le caissier peut ouvrir la pièce, l'enregistrer, puis marquer explicitement la demande comme complétée. L'historique est consultable dans le même panneau. Une pièce supprimée ou clôturée n'est plus modifiable depuis ce panneau.

En mode serveur, les demandes sont partagées dans une table MySQL créée au premier accès (le compte MySQL doit avoir le droit CREATE). Elles ne sont pas comprises dans les exports/restaurations du livre de l'application : sauvegarder également cette table avec la base MySQL. En mode local, elles restent dans le stockage du navigateur et ne sont pas partagées entre ordinateurs ni incluses dans les sauvegardes du livre.

### Messagerie privée et session

L'icône enveloppe dans l'en-tête ouvre les messages privés, regroupés en conversations par correspondant et affichés sous forme de bulles, dans l'ordre chronologique. Chaque utilisateur peut choisir un destinataire actif, envoyer un message, répondre et marquer les messages reçus comme lus ; le compteur est actualisé environ toutes les 15 secondes. Sur le serveur, l'API ne renvoie que les messages envoyés ou reçus par le compte connecté. La table MySQL `messages_prives` est créée au premier accès : elle doit être sauvegardée avec la base (les exports du livre ne la comprennent pas). En mode local de démonstration, les messages restent dans le navigateur et ne sont pas protégés contre une personne ayant accès à son stockage ; utiliser le mode serveur pour la confidentialité et le partage entre ordinateurs.

La session est partagée entre les onglets et fenêtres du navigateur et reste active après actualisation. Tant qu’un onglet de la caisse est ouvert, il signale sa présence toutes les 15 secondes et au retour dans l’onglet.

Une session n’est fermée qu’après **30 minutes sans activité** (`duree_session`, en secondes, dans la configuration de l’API — de 5 minutes à 8 heures). La fenêtre était auparavant de 60 secondes : une pause téléphonique, une mise en veille ou un onglet suspendu par Chrome renvoyait à l’écran de connexion en pleine saisie. L’interface lit la durée annoncée par le serveur : les deux côtés ne peuvent plus diverger.

Trois situations n’entraînent **aucune** déconnexion, parce qu’elles ne prouvent pas que la session est fermée : une coupure réseau, une réponse lente du serveur, un onglet momentanément inactif. Quand la session est réellement close, l’écran de connexion indique **pourquoi** : expiration après inactivité, révocation, ou autre compte ouvert sur le poste.

Reste une déconnexion attendue : fermer le navigateur, ou cliquer « Se déconnecter » sur un poste partagé. Un compte désactivé par l’administrateur exige aussi une reconnexion.

Pour les alertes de messages, la cloche flottante active ou désactive le son ; le choix est conservé dans ce navigateur. Une notification système peut aussi signaler les nouveaux messages si elle a été autorisée dans les paramètres du site. La vérification a lieu environ toutes les 15 secondes tant que l'application est ouverte et connectée. Chrome peut bloquer le son avant une interaction et il n'y a pas d'alerte lorsque le site est fermé. Les notifications système exigent HTTPS reconnu ou localhost ; elles sont indépendantes de la cloche sonore.

### Nom des modèles de saisie

Le nom du modèle est utilisé comme libellé initial de l'écriture (en majuscules), que l'utilisateur peut ensuite modifier. Si un libellé est déjà saisi, une confirmation est demandée avant son remplacement. Pour les anciens modèles ayant un libellé associé différent, c'est désormais le nom qui est utilisé ; les écritures déjà enregistrées ne changent pas. L'ancien libellé reste stocké tant que le modèle n'est pas modifié.

### Saisies simultanées

En mode serveur, si un autre utilisateur modifie le livre pendant une saisie, l'application recharge la dernière révision et réessaie automatiquement l'enregistrement lorsque cela ne risque pas d'écraser une écriture. Si la pièce en cours de modification a elle-même changé ou a été supprimée, ou si l'exercice ou la catégorie n'est plus valide, le formulaire conserve la saisie et signale le problème ; copiez votre travail, fermez le formulaire puis rechargez le livre pour comparer les données. Une erreur réseau n'est jamais réessayée automatiquement, afin d'éviter de créer une pièce en double.

Après l'enregistrement d'une écriture, la fenêtre d'impression du navigateur est sollicitée directement, sans écran d'aperçu dans l'application. Il en va de même pour l'ordre de virement imprimé en un seul exemplaire sur la feuille A4 après chaque DED par virement. Une pièce déjà enregistrée peut aussi être réimprimée depuis sa ligne dans le journal. La confirmation effective de l'impression dépend de Chrome et de l'imprimante : l'application ne peut pas savoir si une feuille est sortie.

### Messages privés, son et présence

Le son des messages est activé par défaut dès que Chrome l’autorise, généralement après un clic ou une touche dans la caisse. La cloche flottante permet de désactiver ou réactiver le son ; l’icône barrée indique qu’il est désactivé. Ce choix est conservé dans le navigateur. Laissez cet onglet connecté et le son de Chrome et de Windows activé. Un nouveau message reçu déclenche un son d’une seconde dans cet onglet, même s’il est en arrière-plan et sans notification système ; la recherche se fait environ toutes les 15 secondes. Chrome peut ralentir ou suspendre l’onglet, différer la recherche, ou bloquer le son avant une interaction. À la reprise de l’onglet ou du réseau, l’application vérifie les messages. L'application ne peut pas sonner si le navigateur est fermé ou l'ordinateur en veille. Vérifiez que la cloche n’est pas barrée et que le son du site, de Chrome et de Windows est activé.

Pour les notifications Windows, autorisez aussi les notifications de ce site dans Chrome et dans Windows. Sur un autre ordinateur, Chrome exige une adresse **HTTPS reconnue** ; sur une adresse réseau HTTP, l'autorisation peut être indisponible. Le son de l'application peut être activé séparément, sous réserve des réglages du navigateur.

Le point vert indique une activité récente dans la messagerie du serveur : le statut est approximatif, avec une expiration après environ 60 secondes sans contact. Il ne prouve pas que la personne est devant son poste. Cette présence n'est pas partagée entre ordinateurs en mode local de démonstration. Une suppression, individuelle ou de toute une conversation, ne retire les messages que de votre propre messagerie : le correspondant conserve sa copie. Les messages et leurs suppressions sont conservés dans des tables MySQL séparées des sauvegardes du livre ; sauvegardez aussi la base complète.

La messagerie présente les utilisateurs à gauche et la conversation sélectionnée à droite. Le point vert indique une présence récente ; le gris signifie hors ligne ou présence inconnue en mode local. Les échanges restent privés et une suppression ne concerne que votre boîte.

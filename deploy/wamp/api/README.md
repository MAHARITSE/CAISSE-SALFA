# CAISSE SALFA — version WampServer / MySQL

Application de caisse partagée entre plusieurs postes, sans Node.js sur le
serveur : le dossier se **copie** dans `www`, et le premier appel prépare tout.

**Aucune installation.** Pas de script `.bat`, pas de ligne de commande, pas de
page d'installation, aucun fichier à modifier : la base, les tables, les
catégories, les modèles de bordereaux et les comptes de départ se créent tout
seuls au premier lancement.

**Le fichier SQL est livré avec le site : `api/caisse-salfa.sql`.** Il contient
toute la base — les 14 tables, les catégories, les modèles de bordereaux, les
paramètres et les deux comptes de connexion. Normalement vous n'en avez pas
besoin : l'API prépare tout seule au premier appel. Il sert quand on préfère
partir d'une base déjà faite, ou la déplacer d'un serveur à l'autre :

1. ouvrir **phpMyAdmin** (`http://127.0.0.1/phpmyadmin/`) ;
2. onglet **Importer**, choisir `caisse-salfa\api\caisse-salfa.sql`, **Exécuter** ;
3. le fichier affiche quatre lignes de contrôle, toutes en `OK`.

Il crée la base `caisse_salfa` lui-même : inutile de la créer avant, inutile de
sélectionner quoi que ce soit. Il est **rejouable** : le relancer ne détruit
aucune écriture et ne réinitialise aucun mot de passe déjà changé. Après
l'import, ouvrir l'application et se connecter avec `admin` / `admin123`.

> Le dossier `api\` reste fermé au navigateur (Apache refuse les `.sql`) : ce
> fichier ne se télécharge jamais par une URL, il s'ouvre depuis l'explorateur
> Windows ou depuis phpMyAdmin.

**Tout est dans MySQL.** En version serveur, l'application ne lit ni n'écrit
jamais le stockage du navigateur : écritures, en-têtes, catégories, modèles,
compteurs et comptes vivent dans la base. La session est portée par un cookie
PHP. Effacer les données du site, changer de profil ou naviguer en privé ne
touche donc pas au livre — seul un vidage de la base le ferait.

## 1. Copier le dossier dans `www`

1. Démarrer WampServer (icône verte : Apache **et** MySQL).
2. Copier le dossier **`caisse-salfa`** (celui qui contient `index.html`) dans
   `C:\wamp64\www\` → on obtient `C:\wamp64\www\caisse-salfa\index.html`.
   Variante : décompresser **`deploy/wamp/caisse-salfa.zip`** dans `C:\wamp64\www\`
   — l'archive contient déjà le dossier `caisse-salfa\`, rien ne se déverse à
   la racine de `www`.
3. Ouvrir **http://127.0.0.1/caisse-salfa/** et se connecter.

Au premier appel, l'API :

- écrit sa configuration `C:\wamp64\salfa-config.php` (hors de `www`, donc
  invisible depuis le navigateur) ;
- crée la base `caisse_salfa` si elle n'existe pas ;
- crée ses 14 tables et les données de départ (catégories, modèles de
  bordereaux) ;
- crée deux comptes :

| Compte | Mot de passe | Rôle |
| --- | --- | --- |
| `admin` | `admin123` | administrateur : tout, dont les comptes et la clôture |
| `comptable` | `comptable123` | consultation du journal et de l'analyse |

> **Changez ces deux mots de passe** dès la première connexion, depuis la barre
> d'en-tête (bouton « Changer mon mot de passe ») puis l'onglet Administration.

## 2. Si MySQL a un mot de passe personnalisé

L'écran de connexion affiche alors « Connexion MySQL à préciser » avec un
formulaire : hôte, port, base, utilisateur, mot de passe. Validez, le serveur
est préparé avec ces accès et le formulaire ne revient plus. C'est le seul cas
où une saisie est demandée ; il n'y a toujours rien à installer.

Le port par défaut de WampServer (3306) est essayé, puis 3307 et 3308 : un
MySQL qui a changé de port est reconnu sans rien configurer.

## 3. Contenu du dossier copié dans `www`

Rien de plus que ce que montre l'explorateur Windows :

```text
caisse-salfa\
  api\        API PHP/MySQL (index.php + lib/ + points/)
  assets\     JavaScript et CSS compilés
  .htaccess   Apache : données fermées, limites PHP 32 Mo, cache
  .user.ini   mêmes limites quand PHP tourne en module
  favicon     icône de l'onglet
  index       la page de l'application
```

À l'intérieur de `api\` (jamais affiché par le navigateur) :

```text
api\
  index.php        point d'entrée unique
  config.php       accès MySQL par défaut et écriture de la configuration
  socle.php        inclusions + amorçage automatique
  lib\            amorce (base, tables, comptes), db, auth, validation, métier, export SQL
  points\         une action par fichier : livre, ecritures, cloture, sauvegarde…
  caisse-salfa.sql base complète à importer dans phpMyAdmin (tables + comptes)
  installation\   schéma interne lu par l'amorçage automatique
  data\            configuration et sauvegardes — interdit d'accès web
  tests\           tests de l'API (ligne de commande, sans MySQL)
  README.md        ce guide
```

Le dossier prêt à copier est livré dans le dépôt, avec son archive
`deploy/wamp/caisse-salfa.zip` : il n'y a donc rien à compiler sur le serveur.
Il est régénéré par le build (§ 5) après une modification du code.

## 4. Mise à jour d'une installation existante

1. Sauvegarder (onglet « Données & sauvegardes » → export `.sql`).
2. Recopier le nouveau dossier dans `www\caisse-salfa`, en acceptant le
   remplacement des fichiers. La configuration (`C:\wamp64\salfa-config.php`
   ou, à défaut, `api\data\salfa-config.php`) est conservée : ne pas la supprimer.
3. Actualiser avec **Ctrl+F5**.

Le schéma et les comptes existants sont conservés : aucun script SQL à rejouer.
Si un doute subsiste, `api/caisse-salfa.sql` peut être réimporté sans risque :
il ne complète que ce qui manque.
La ligne « version du paquet » du diagnostic signale une interface et une API
de versions différentes (copie partielle).

## 5. Régénérer ce dossier après une modification du code

Le dossier livré est déjà prêt : cette étape ne concerne que le développeur qui
modifie l'application (Node.js requis **ici seulement**) :

```bash
npm ci
npm run build:wamp     # met à jour deploy/wamp/caisse-salfa/ et caisse-salfa.zip
```

Puis copier le dossier (ou le ZIP) sur le serveur. Ne pas copier `deploy/wamp/`
lui-même dans `www` : il contient aussi les sources et les archives.

## 6. Sauvegardes

- **Export `.sql`** (onglet « Données & sauvegardes », administrateur) : structure
  et données **réelles** du moment, réimportable dans phpMyAdmin → *Importer*.
  C'est la sauvegarde à faire avant toute manipulation ; `api/caisse-salfa.sql`
  livré avec le site ne contient que la base de départ, sans les écritures.
- **Sauvegarde JSON** : le livre seul, restaurable depuis l'application.
- Un dump phpMyAdmin de la base `caisse_salfa` convient aussi ; le fichier
  contient les comptes et leurs empreintes, jamais les mots de passe en clair.

## 7. Diagnostic

`http://127.0.0.1/caisse-salfa/api/index.php?action=verifier` renvoie un JSON
lisible : version de PHP, extensions, connexion MySQL, nombre de tables, compte
administrateur, cohérence des versions. C'est le premier endroit à consulter en
cas de difficulté.

## 8. Sécurité

- **HTTP ne chiffre rien** : sur un réseau, mots de passe et montants circulent
  en clair. Pour un usage réel, activer HTTPS et restreindre Apache aux postes
  autorisés (pare-feu Windows).
- Ne pas exposer ce serveur à Internet.
- La configuration contient le mot de passe MySQL : elle est écrite **hors** de
  `www` (`C:\wamp64\salfa-config.php`) quand c'est possible, sinon dans
  `api\data\` (fermé par `.htaccess`). Ne jamais la copier ailleurs ni la
  transmettre.
- Protéger les exports `.sql` : ils contiennent toute la comptabilité.

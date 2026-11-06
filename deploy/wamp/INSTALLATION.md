# CAISSE SALFA — installation sur WAMP

**Copier le dossier dans `C:\wamp64\www\caisse-salfa`, ouvrir
<http://localhost/caisse-salfa/> dans le navigateur, cliquer sur
« Ouvrir l’installation », puis saisir les accès MySQL. C’est tout.**

Aucun script à double-cliquer, aucune ligne de commande, aucun Node.js sur le
serveur : la page d’accueil est du HTML statique déjà compilé, l’API est du PHP
pur sans Composer, et la base est le MySQL de WAMP.

---

## 1. Contenu du paquet

```
caisse-salfa\
├── index.html          page d'accueil (application déjà compilée)
├── installer.php       installation dans le navigateur (à supprimer après usage, facultatif)
├── assets/             JavaScript, CSS, icônes
├── api/                API PHP/MySQL
│   ├── index.php       aiguillage : api/index.php?action=livre
│   ├── socle.php       inclusions communes
│   ├── config.php      valeurs par défaut, version, fuseau horaire
│   ├── points/         une action par fichier (livre.php, cloture.php…)
│   ├── lib/            db.php, auth.php, validation.php, metier.php, installation.php
│   ├── tests/          test-api.php (24 tests sans MySQL)
│   └── salfa-config.modele.php
├── data/               configuration et sauvegardes (INACCESSIBLE du web)
│   ├── salfa-config.php        écrit par installer.php
│   └── sauvegardes/            dumps SQL
├── sql/salfa_install.sql       schéma complet + données de départ
├── .htaccess                   Apache
└── INSTALLATION.md
```

---

## 2. Prérequis

| Élément | Version | Vérification |
| --- | --- | --- |
| WAMP | 3.x | icône verte (Apache + MySQL) |
| PHP | 8.1+, **64 bits** | extensions `pdo_mysql`, `mbstring`, `json` |
| Navigateur | Chrome / Edge / Firefox | — |

Dans WAMP : clic sur l'icône → **PHP → Version** → choisir 8.1 ou plus.

Le PHP doit être **64 bits** (cas de WAMP 3.x x64). Sur un PHP 32 bits, un
montant supérieur à 2 147 483 647 Ar ne tient pas dans un entier : le paquet
plafonne alors les montants à **2 000 000 000 Ar** au lieu de
**999 999 999 999 Ar**, et le diagnostic le signale sur la ligne « PHP 64 bits ».

---

## 3. Installation

1. Copier le dossier complet (`deploy\wamp`) dans le dossier web de WAMP, par
   exemple `C:\wamp64\www\caisse-salfa`. **Copier tout le dossier**, pas
   seulement `index.html` : l'API, le schéma SQL et ce guide en font partie.
2. Ouvrir <http://localhost/caisse-salfa/>. L'écran de connexion affiche un
   panneau orange **« Serveur pas encore installé »**.
3. Cliquer sur **« Ouvrir l'installation »** (page `installer.php`).
4. Renseigner les accès MySQL puis le compte administrateur, et valider.

L'installateur crée en une seule fois : la base de données, les 14 tables, les
modèles de saisie, les catégories, le compte administrateur et le fichier
`data\salfa-config.php`. Il affiche ensuite un compte rendu avec un lien direct
vers la caisse.

**Accès MySQL demandés :** hôte (`127.0.0.1`), port (`3306`), nom de la base
(`caisse_salfa`, créée si absente), utilisateur (`root` sur une installation
WAMP neuve) et son mot de passe (vide par défaut). La page « Où trouver les
accès MySQL ? » les rappelle.

Le mot de passe MySQL n'apparaît jamais à l'écran et n'est écrit que dans
`data\salfa-config.php`, un dossier interdit d'accès depuis le navigateur. Les
comptes applicatifs sont hachés (bcrypt).

### Vérifier ensuite

Ouvrir <http://localhost/caisse-salfa/api/index.php?action=verifier> : le
diagnostic renvoie, ligne par ligne, l'état de PHP, des extensions, des
fichiers, de la connexion MySQL, des tables et du compte administrateur.

Il se termine par le bloc **Version du paquet** : la version écrite dans
`index.html` (interface compilée) doit être identique à celle de `api/config.php`
(API). Si les deux diffèrent, le dossier a été recopié en partie : reprendre
`index.html`, `assets/` et `api/` depuis le même paquet. L'application le
signale aussi par un bandeau orange en bas de page.

---

## 4. Installation manuelle du schéma (facultatif)

Utile si vous préférez préparer la base vous-même, par exemple pour reprendre
un serveur existant.

1. phpMyAdmin > onglet **Importer** > `sql/salfa_install.sql` > **Exécuter**.
   Le fichier commence par `CREATE DATABASE IF NOT EXISTS` puis `USE` : inutile
   de créer la base avant, inutile de la sélectionner.
2. Ouvrir ensuite `installer.php` comme au §3 : il détecte le schéma déjà
   présent (la création des tables est rejouable), crée le compte
   administrateur et écrit la configuration.

### Import phpMyAdmin : erreur « #1046 — Aucune base n'a été sélectionnée »

L'import a été lancé depuis le niveau **serveur**. Réimportez le fichier
`salfa_install.sql` livré (il crée et sélectionne la base lui-même), ou cliquez
d'abord sur `caisse_salfa` dans la colonne de gauche, puis **Importer**.

Pour savoir où vous en êtes, exécutez `sql/verifier-import.sql` (onglet
**SQL**) : il indique le nombre de tables présentes, l'état du livre et celui
des comptes.

---

## 5. Comptes et rôles

| Rôle | Pages ouvertes | Consulter / exporter | Saisir | Solde d'ouverture, clôture, restauration, Administration |
| --- | --- | --- | --- | --- |
| `comptable` | livre journal, analyse | oui | non | non |
| `caissier` | livre journal | oui | oui | non |
| `admin` | tout | oui | oui | oui |

**Le solde d'ouverture n'est modifiable que par l'administrateur.** Le crayon de
la synthèse disparaît pour les autres rôles (« Lecture seule »), et le serveur
refuse de toute façon l'écriture `solde-initial` à quiconque n'est pas `admin` :
l'interface ne fait que refléter une règle déjà tenue en base.

### Base déjà installée (rôles ajoutés après coup)

L'ancien rôle `lecteur` devient `comptable`. Sur une base existante, exécutez
une fois `sql/salfa_roles.sql` (onglet **Importer** de phpMyAdmin, base
`caisse_salfa`). Le script est idempotent, convertit les comptes `lecteur`,
resserre l'ENUM sur les trois rôles et contrôle qu'il reste au moins un
administrateur actif.

### Créer des comptes, changer les mots de passe

- **Administrateur** : onglet **Administration** de l'application, pour créer
  un compte, changer un rôle ou désactiver un accès.
- **Chacun change son mot de passe** sans passer par l'administrateur : bouton
  « clé » à côté du nom, en haut à droite. L'ancien mot de passe est exigé.
  L'administrateur ne voit que le hachage en base : il ne peut pas deviner le
  mot de passe choisi.
- **Mot de passe administrateur oublié** : dans le dossier du site, créez un
  fichier vide `data\reinitialiser-mdp.txt`, puis ouvrez
  <http://localhost/caisse-salfa/installer.php>. Un formulaire de
  réinitialisation apparaît ; il supprime le fichier aussitôt, ce qui referme
  la page. Sans ce fichier, `installer.php` refuse toute modification.
- Session : cookie `HttpOnly`, expiration après 12 h ou 30 min d'inactivité.
- 8 tentatives de connexion par quart d'heure et par adresse.
- Chaque connexion, saisie, suppression, clôture et restauration est journalisée
  dans `salfa_journal_audit`.

---

## 6. Sauvegardes : fichier `.sql`

Sous WAMP, la sauvegarde de référence est le **dump `.sql`** — l'habituel
export MySQL, réimportable dans phpMyAdmin.

- Onglet **Données & sauvegardes** > **Télécharger la sauvegarde .sql**
  (administrateur). Le fichier `sauvegarde_caisse_salfa_AAAA-MM-JJ_HH-MM-SS.sql`
  contient la structure des tables utiles puis leurs données.
- **Restauration** : arrêter la caisse, puis phpMyAdmin > **Importer** > le
  fichier > Exécuter. Les tables présentes sont remplacées, les absentes
  créées.
- Ce qui n'est **pas** exporté, volontairement : `salfa_sessions` (sessions
  ouvertes, à rouvrir) et `salfa_tentatives` (compteurs anti-intrusion, propres
  au serveur).
- Les mots de passe partent **hachés** (bcrypt) : le fichier ne permet pas de
  les lire, mais il restitue les comptes.
- La sauvegarde **JSON** reste disponible à côté : elle ne contient que le
  livre et repart d'une caisse neuve, utile pour changer de machine.

### Sauvegarde automatique chaque soir

Créez une tâche planifiée Windows (Planificateur de tâches) qui appelle
`mysqldump.exe` de WAMP, puis copiez `data\sauvegardes\` sur un disque externe :

```
C:\wamp64\bin\mysql\mysql8.4.0\bin\mysqldump.exe --user=root --result-file=C:\wamp64\www\caisse-salfa\data\sauvegardes\salfa-%date%.sql caisse_salfa
```

Adaptez le chemin de `mysqldump.exe` à votre version de WAMP (dossier
`C:\wamp64\bin\mysql\`).

---

## 7. Règles appliquées côté serveur

L'API ne fait jamais confiance au navigateur :

- une seule caisse en espèces ;
- une date hors de l'exercice ouvert est refusée (`hors_exercice`) ;
- numéro `RC-AAAA-0001` / `DP-AAAA-0001` attribué par le serveur, jamais réutilisé ;
- somme des postes = montant total, sinon refus ;
- **clôture uniquement à partir du 1er janvier suivant l'exercice**, écritures
  archivées immuables, solde reporté ;
- restauration JSON entièrement validée **avant** la moindre suppression ;
- verrou de ligne + révision : deux postes ne s'écrasent jamais (message 409).

---

## 8. Dépannage

| Symptôme | Cause | Solution |
| --- | --- | --- |
| « Serveur pas encore installé » (panneau orange) | configuration MySQL absente | « Ouvrir l'installation », puis « Réessayer » |
| « Connexion à MySQL impossible » | WAMP arrêté, base ou mot de passe faux | démarrer WAMP (icône verte), relancer `installer.php` ou corriger `data\salfa-config.php` |
| « Serveur injoignable » (panneau orange) | Apache arrêté ou `api/` incomplet | démarrer WAMP, recopier tout le paquet |
| « L'API est introuvable » | dossier `api/` non copié | recopier tout le dossier |
| Page blanche | erreur PHP | `C:\wamp64\logs\php_error.log`, puis diagnostic JSON |
| « Paquet incomplet » (pied de page) | interface et API de versions différentes | recopier `index.html`, `assets/` et `api/` du même paquet |
| « Conflit de révision » | deux postes ont saisi ensemble | recharger : la saisie est conservée |
| « Session expirée » | 30 min d'inactivité | se reconnecter |
| Mot de passe administrateur oublié | — | créer `data\reinitialiser-mdp.txt`, ouvrir `installer.php` |

---

## 9. Après la mise en service

1. Vérifier que `data/` renvoie **403** dans le navigateur.
2. Créer un compte `caissier` par personne (onglet Administration).
3. Supprimer `installer.php` du serveur : il se verrouille déjà tout seul, mais
   le retirer évite d'exposer une page d'installation. `api/tests/` peut aussi
   être supprimé.
4. Mettre à jour : sur un poste de développement, `npm run build:wamp`, puis
   recopier **tout** le paquet en conservant `data\salfa-config.php` (les tables
   et les données restent en base). Une page à jour avec une API ancienne — ou
   l'inverse — déclenche l'alerte « Paquet incomplet ».

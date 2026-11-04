# CAISSE SALFA — installation sur WAMP

Copier le dossier dans `C:\wamp64\www\caisse-salfa`, puis double-cliquer sur
**`outils\installer.bat`**. C'est tout.

Aucun Node.js n'est nécessaire sur le serveur : la page d'accueil est du HTML
statique déjà compilé, l'API est du PHP pur sans Composer, et la base est le
MySQL de WAMP.

---

## 1. Contenu du paquet

```
caisse-salfa\
├── index.html          page d'accueil (application déjà compilée)
├── assets/             JavaScript, CSS, icônes
├── api/                API PHP/MySQL
│   ├── index.php       aiguillage : api/index.php?action=livre
│   ├── socle.php       inclusions communes
│   ├── config.php      valeurs par défaut, fuseau horaire
│   ├── points/         une action par fichier (livre.php, cloture.php…)
│   ├── lib/            db.php, auth.php, validation.php, metier.php
│   ├── tests/          test-api.php (24 tests sans MySQL)
│   └── salfa-config.modele.php
├── data/               configuration et sauvegardes (INACCESSIBLE du web)
│   ├── salfa-config.php        créé par l'installateur
│   └── sauvegardes/            dumps SQL
├── outils/
│   ├── installer.bat           installation complète
│   ├── verifier.bat            diagnostic
│   ├── creer-admin.bat         compte / mot de passe oublié
│   ├── sauvegarder.bat         dump MySQL daté
│   ├── importer-sauvegarde.bat restauration d'un dump
│   ├── demarrer-url.bat        ouvre le navigateur
│   └── *-cli.php               scripts PHP appelés par les .bat
├── sql/salfa_install.sql       schéma complet + données de départ
├── .htaccess                   Apache
└── INSTALLATION.md
```

---

## 2. Prérequis

| Élément | Version | Vérification |
| --- | --- | --- |
| WAMP | 3.x | icône verte (Apache + MySQL) |
| PHP | 8.1+ | extensions `pdo_mysql`, `mbstring`, `json` |
| Navigateur | Chrome / Edge / Firefox | — |

Dans WAMP : clic sur l'icône → **PHP → Version** → choisir 8.1 ou plus.

---

## 3. Installation automatique

1. Copier le dossier `deploy\wamp` sur le serveur (par exemple dans
   `C:\wamp64\www\caisse-salfa`).
2. Double-cliquer sur **`outils\installer.bat`**.
   Le script détecte WAMP, copie le site, demande les accès MySQL, crée la base,
   les 14 tables, les modèles de saisie, les catégories et le compte administrateur.
3. Ouvrir **<http://localhost/caisse-salfa/>**.

Le script n'affiche jamais le mot de passe MySQL en clair et le stocke hors du
web, dans `data\salfa-config.php` (bcrypt pour les comptes applicatifs).

### Vérifier ensuite

```
outils\verifier.bat
```

Contrôle PHP, extensions, fichiers, connexion MySQL, tables, compte admin — ou,
depuis le navigateur : `http://localhost/caisse-salfa/api/index.php?action=verifier`
(réponse JSON, ligne par ligne).

---

## 4. Installation manuelle

1. Copier `index.html`, `assets/`, `api/`, `data/`, `.htaccess` dans
   `C:\wamp64\www\caisse-salfa`.
2. **Importer `sql/salfa_install.sql` dans phpMyAdmin.** Le fichier crée lui-même
   la base `caisse_salfa` : inutile de la créer avant, et inutile de sélectionner
   une base dans le menu de gauche.
3. Créer un compte : `outils\creer-admin.bat` — il crée aussi
   `data/salfa-config.php` si le fichier est absent, en vous demandant les accès
   MySQL.
4. Vérifier : `outils\verifier.bat`.

### Import phpMyAdmin : erreur « #1046 — Aucune base n'a été sélectionnée »

Cette erreur signifie que l'import a été lancé depuis le niveau **serveur**, alors
que le script ne contenait pas encore son `USE`.

**Le `salfa_install.sql` livré dans ce paquet ne peut pas produire cette erreur** :
il commence par `CREATE DATABASE IF NOT EXISTS` puis `USE`, et c'est la 3e et la
4e instruction du fichier. Si vous la voyez quand même, le fichier importé n'est
pas celui du paquet — c'est une copie plus ancienne. Vérifiez avant tout :

```
head -20 sql\salfa_install.sql
```

Les lignes 15 et 19 doivent afficher `CREATE DATABASE IF NOT EXISTS `caisse_salfa``
et `USE `caisse_salfa`;`. Trouvez le fichier réellement déposé sur le serveur
(`C:\wamp64\www\caisse-salfa\sql\`), pas celui resté dans votre dossier de
téléchargement.

Deuxième cause possible : phpMyAdmin a importé le fichier **partiellement**.
Dans ce cas le message n'est pas un #1046 mais une erreur sur une instruction
précise — lisez son numéro, il tombe sur une ligne du fichier.

Si le doute persiste, deux solutions de repli, dans cet ordre :

- **cliquer d'abord sur `caisse_salfa`** dans la colonne de gauche, puis onglet
  **Importer** : le `USE` devient superflu ;
- **passer par l'installateur** (recommandé) : `outils\installer.bat` crée la
  base, les tables et le compte administrateur en une fois, via l'API, sans
  phpMyAdmin.

Pour savoir où vous en êtes, exécutez `sql/verifier-import.sql` (onglet **SQL**) :
il indique le nombre de tables présentes, l'état du livre et celui des comptes.

Un contrôle automatique accompagne le fichier :

```
python3 tests/sql/scinder.py sql/salfa_install.sql
```

Il rejoue le découpage instruction par instruction comme phpMyAdmin, et vérifie
que `CREATE DATABASE` puis `USE` précèdent bien la première table.

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
une fois :

```
mysql -u root -p salfa < sql/salfa_roles.sql
```

ou, via phpMyAdmin : base `caisse_salfa` > onglet **Importer** > `salfa_roles.sql`.
Le script est idempotent, convertit les comptes `lecteur`, resserre l'ENUM sur
les trois rôles et contrôle qu'il reste au moins un administrateur actif.

- `outils\creer-admin.bat` crée un compte ou réinitialise un mot de passe.
- **Chacun change son mot de passe** sans passer par l'administrateur : bouton
  « clé » à côté du nom, en haut à droite. L'ancien mot de passe est exigé.
  L'administrateur n'a plus à le faire pour les autres, et ne peut pas
  deviner le mot de passe choisi : il ne voit que le hachage en base.
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
  contient la structure des 12 tables utiles puis leurs données.
- **Restauration** : arrêter la caisse, puis phpMyAdmin > **Importer** > le
  fichier > Exécuter. Les tables présentes sont remplacées, les absentes
  créées. En ligne de commande : `mysql -u root -p caisse_salfa < fichier.sql`.
- Ce qui n'est **pas** exporté, volontairement : `salfa_sessions` (sessions
  ouvertes, à rouvrir) et `salfa_tentatives` (compteurs anti-intrusion, propres
  au serveur).
- Les mots de passe partent **hachés** (bcrypt) : le fichier ne permet pas de
  les lire, mais il restitue les comptes.
- La sauvegarde **JSON** reste disponible à côté : elle ne contient que le
  livre et repart d'une caisse neuve, utile pour changer de machine.

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

## 7. Sauvegardes

| Méthode | Commande | Contenu |
| --- | --- | --- |
| JSON (interface) | onglet « Données & sauvegardes » | livre portable, restaurable |
| Dump MySQL | `outils\sauvegarder.bat` | base complète + comptes |

Planifier `sauvegarder.bat` chaque soir (Planificateur de tâches Windows) puis
copier `data\sauvegardes\` sur un disque externe.

---

## 8. Dépannage

| Symptôme | Cause | Solution |
| --- | --- | --- |
| « L'API n'est pas configurée » | `data/salfa-config.php` absent | `outils\installer.bat` |
| « Connexion à MySQL impossible » | WAMP arrêté, base ou mot de passe faux | démarrer WAMP, relancer `installer.bat` |
| Page blanche | erreur PHP | `outils\verifier.bat`, puis `C:\wamp64\logs\php_error.log` |
| « L'API est introuvable » | dossier `api/` non copié | recopier tout le dossier |
| « Conflit de révision » | deux postes ont saisi ensemble | recharger : la saisie est conservée |
| « Session expirée » | 30 min d'inactivité | se reconnecter |
| Mot de passe oublié | — | `outils\creer-admin.bat` |

---

## 9. Après la mise en service

1. Supprimer `api/connexion-bootstrap.php` et `api/tests/` du serveur.
2. Vérifier que `data/` renvoie **403** dans le navigateur.
3. Créer un compte `caissier` par personne.
4. Mettre à jour : relancer `npm run build:wamp` sur un poste de développement,
   puis `outils\installer.bat` (les tables et les données sont conservées).

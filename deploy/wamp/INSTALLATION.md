# CAISSE SALFA — installation sur WAMP (Windows, Apache, MySQL/MariaDB, PHP)

Ce dossier est le paquet à copier sur le serveur. **Aucun Node.js n’est nécessaire sur
le serveur** : le frontend a déjà été compilé (`frontend/`), l’API est du PHP pur
sans Composer, et la base est MySQL/MariaDB fournie par WAMP.

---

## 1. Ce que contient le paquet

```
deploy/wamp/
├── frontend/            application React compilée (index.html + assets/)
├── api/                 API PHP : un fichier par point, PAS d'index.php
│   ├── points/          points d'entrée publics (un fichier = une opération)
│   │   ├── sante.php  session.php  connexion.php  deconnexion.php
│   │   ├── livre.php  ecritures.php  ecritures-supprimer.php
│   │   ├── ecritures-restaurer.php  masques.php  solde-initial.php
│   │   └── cloture.php  restauration.php  sauvegarde.php  mot-de-passe.php
│   ├── socle.php        inclusions communes (aucune route)
│   ├── config.php       valeurs par défaut, constantes, fuseau horaire
│   ├── salfa-config.modele.php  modèle de configuration à copier
│   ├── connexion-bootstrap.php  création du premier administrateur (CLI)
│   ├── lib/             utile.php, db.php, auth.php, validation.php, metier.php
│   └── tests/test-api.php       tests sans MySQL (php api/tests/test-api.php)
├── sql/salfa_install.sql        schéma complet + données de départ
├── outils/
│   ├── installer.bat            installation guidée (copie vers WAMP)
│   ├── configurer-base.php      assistant de connexion MySQL
│   ├── preparer-base.php        création des tables
│   ├── creer-admin.bat          compte administrateur / mot de passe oublié
│   ├── sauvegarder.bat          dump mysqldump daté
│   ├── verifier.bat             contrôle des fichiers et de l'API
│   ├── importer-sauvegarde.bat  restauration d’un dump
│   └── demarrer-url.bat         ouverture de l’application
├── .htaccess            routage Apache, cache et protections
└── INSTALLATION.md      ce fichier
```

Préfixe des tables : `salfa_` (12 tables). Toutes les écritures comptables sont
transactionnelles ; un verrou de ligne et une **révision** empêchent deux postes de
s’écraser mutuellement (conflit signalé par un message explicite, sans perte).

---

## 2. Prérequis

| Élément | Version minimale | Remarque |
| --- | --- | --- |
| WAMP | 3.x | Apache 2.4, MySQL ou MariaDB 10.4+ |
| PHP | 8.1 | extensions `pdo_mysql`, `mbstring`, `json`, `openssl` |
| Navigateur | Chrome / Edge / Firefox récent | aucun module complémentaire |

Dans WAMP, cliquer sur l’icône pour choisir la **version de PHP 8.1 ou supérieure**,
puis vérifier que l’icône devient verte (Apache + MySQL démarrés).

---

## 3. Installation guidée (recommandée)

1. Copier tout le dossier `deploy\wamp` sur le serveur, par exemple
   `C:\wamp64\www\caisse-salfa` (ou laisser `installer.bat` le faire).
2. Double-cliquer sur **`outils\installer.bat`**.
   Le script :
   - vérifie WAMP et `php.exe` ;
   - copie le frontend et l’API dans `C:\wamp64\www\caisse-salfa` ;
   - demande les accès MySQL (par défaut `root` sans mot de passe sous WAMP) et écrit
     `api\salfa-config.php` avec un sel de session aléatoire ;
   - crée la base `caisse_salfa`, les tables et les deux modèles de saisie de départ ;
   - crée le compte administrateur de votre choix.
3. Ouvrir **<http://localhost/caisse-salfa/>** et se connecter.

> `installer.bat` écrit un nom d’utilisateur mais **pas** le mot de passe dans un
> journal : le mot de passe du compte applicatif n’est stocké que sous forme de hachage
> bcrypt dans MySQL.

---

## 4. Installation manuelle

1. Copier `frontend/`, `api/`, `.htaccess` et `INSTALLATION.md` dans
   `C:\wamp64\www\caisse-salfa` (rien d'autre : il n'y a **aucun `index.php`**,
   la page d'accueil est `index.html`).
2. Copier `api/salfa-config.modele.php` en `api/salfa-config.php`, puis renseigner
   `hote`, `port`, `base`, `utilisateur`, `mot_de_passe` et remplacer `sel_session`.
3. Créer la base et importer `sql/salfa_install.sql` :
   - phpMyAdmin → Importer, **ou**
   - `C:\wamp64\bin\mysql\mysql8.x.x\bin\mysql.exe -u root -e "CREATE DATABASE caisse_salfa CHARACTER SET utf8mb4"`
     puis importer le fichier.
4. Créer l’administrateur :
   `php api/connexion-bootstrap.php admin "MotDePasseSolide" "Nom complet"`.
5. Vérifier la réponse de l’API :
   `http://localhost/caisse-salfa/api/points/sante.php` doit renvoyer
   `{"ok":true,"base":"connectee",…}.`

### Si l’application n’est pas dans `/caisse-salfa/`

Le routage de `.htaccess` et la base de l’API sont relatifs : l’application fonctionne
dans n’importe quel sous-dossier (`http://localhost/salfa/`). Pour un déploiement à la
racine du serveur web, adapter les deux lignes `RewriteBase`.

### Aucune réécriture d’URL n’est nécessaire

L’application appelle directement les fichiers : `api/points/livre.php`,
`api/points/cloture.php`… `mod_rewrite` n’est utilisé que pour renvoyer
`index.html` sur une URL inconnue (facultatif). Si un fichier d’API manque,
l’application affiche « Le fichier d’API … est introuvable sur le serveur ».

---

## 5. Comptes et rôles

| Rôle | Consultation / exports | Saisie, modification, suppression | Clôture, solde d’ouverture, restauration |
| --- | --- | --- | --- |
| `lecteur` | oui | non | non |
| `caissier` | oui | oui | non |
| `admin` | oui | oui | oui |

- Créer un autre compte : `outils\creer-admin.bat` (le même script réinitialise aussi
  un mot de passe oublié).
- Sessions : cookie `HttpOnly`, expiration après **12 h** ou **30 min** d’inactivité.
- Limitation : **8 tentatives** de connexion par quart d’heure et par adresse.
- Journal d’audit : chaque connexion, saisie, suppression, clôture et restauration est
  horodatée dans `salfa_journal_audit`.

---

## 6. Règles métier appliquées côté serveur

L’API ne fait pas confiance au navigateur : elle revalide tout.

- Un seul mode de paiement : espèces.
- Une seule écriture par exercice ouvert : une date hors de l’année ouverte est refusée
  (`hors_exercice`), avec le message invitant à clôturer l’année.
- Numéro de pièce `RC-AAAA-0001` / `DP-AAAA-0001` attribué par le serveur ; un numéro
  supprimé n’est jamais réutilisé (`salfa_compteurs`).
- Somme des postes = montant total, sinon `total_incoherent`.
- **Clôture uniquement à partir du 1er janvier suivant l’exercice** ; les écritures de
  l’année clôturée deviennent immuables (`annee_archive`), le solde est reporté.
- Restauration JSON : le fichier est entièrement validé (format, doublons, chaîne des
  soldes) **avant** la moindre suppression.

---

## 7. Sauvegardes

| Méthode | Commande | Usage |
| --- | --- | --- |
| JSON interne | onglet « Données & sauvegardes » | archive portable, restauration depuis l’interface |
| Dump MySQL | `outils\sauvegarder.bat` | sauvegarde serveur complète (base + comptes) |
| Restauration SQL | `outils\importer-sauvegarde.bat` | dernier recours, remplace la base |

Planifier `sauvegarder.bat` chaque soir avec le Planificateur de tâches Windows, puis
copier `deploy\wamp\sauvegardes\` sur un disque externe ou un partage réseau.

---

## 8. Vérifications après installation

```
http://localhost/caisse-salfa/                     → écran de connexion
http://localhost/caisse-salfa/api/points/sante.php  → {"ok":true,"base":"connectee",...}
php api/tests/test-api.php                         → 24 tests de validation
```

Parcours de recette conseillé : créer une recette, une dépense avec deux postes,
modifier, supprimer puis annuler la suppression, exporter le CSV, télécharger une
sauvegarde JSON, la restaurer, puis vérifier la page « Exercices & clôtures ».

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « L’API n’est pas encore configurée » | `api/salfa-config.php` absent | lancer `outils\installer.bat` |
| « Connexion à MySQL impossible » | WAMP arrêté, base absente, mot de passe faux | démarrer WAMP, vérifier `salfa-config.php`, lancer `outils\verifier.bat` |
| Écran blanc | erreur PHP | consulter `C:\wamp64\logs\php_error.log` |
| « Le fichier d’API … est introuvable » | dossier `api/` incomplet | recopier tout le dossier `api/` (surtout `api/points/`) |
| « Conflit de révision » | deux postes ont saisi en même temps | recharger le livre : la saisie est conservée |
| « Session expirée » | 30 min d’inactivité | se reconnecter |
| Mot de passe oublié | — | `outils\creer-admin.bat` sur le serveur |

---

## 10. Après la mise en service

1. Supprimer `api/connexion-bootstrap.php` et `api/tests/` du serveur.
2. Vérifier que `api/salfa-config.php` n’est accessible qu’en local (le `.htaccess` le
   bloque déjà) et n’est **jamais** versionné (`.gitignore`).
3. Régler le fuseau du serveur sur `Indian/Antananarivo` (`config.php`).
4. Créer un compte `caissier` par personne : ne pas partager le compte administrateur.
5. Mettre à jour le frontend : relancer `npm run build:wamp` sur un poste de
   développement, puis `outils\installer.bat` (les tables et les données sont conservées).

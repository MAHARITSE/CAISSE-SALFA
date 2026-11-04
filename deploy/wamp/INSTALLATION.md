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
   les 12 tables, les modèles de saisie et le compte administrateur.
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
2. Créer la base et importer `sql/salfa_install.sql` (phpMyAdmin).
3. Copier `api/salfa-config.modele.php` en `data/salfa-config.php` et renseigner
   les accès MySQL (remplacer aussi `sel_session`).
4. Créer un compte : `outils\creer-admin.bat`.

---

## 5. Comptes et rôles

| Rôle | Consulter / exporter | Saisir, modifier, supprimer | Clôturer, solde d'ouverture, restaurer |
| --- | --- | --- | --- |
| `lecteur` | oui | non | non |
| `caissier` | oui | oui | non |
| `admin` | oui | oui | oui |

- `outils\creer-admin.bat` crée un compte ou réinitialise un mot de passe.
- Session : cookie `HttpOnly`, expiration après 12 h ou 30 min d'inactivité.
- 8 tentatives de connexion par quart d'heure et par adresse.
- Chaque connexion, saisie, suppression, clôture et restauration est journalisée
  dans `salfa_journal_audit`.

---

## 6. Règles appliquées côté serveur

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

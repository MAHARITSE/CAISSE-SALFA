# Jeu d’essai — trois derniers mois

Ce dossier contient un livre de caisse de démonstration, prêt à être chargé
dans l’application **CAISSE SALFA**. Il permet de manipuler le journal, les
statistiques, les bordereaux et les en-têtes sans saisir les pièces à la main.

## Contenu

| Fichier | Rôle |
|---|---|
| `charger-demo.html` | Page qui installe le livre dans le navigateur et ouvre l’application. |
| `jeu-essai.json` | Le même livre, lu automatiquement par la page ci-dessus. |
| `jeu_essai_caisse_salfa_<mois>.json` | Fichier à importer manuellement depuis l’onglet « Données & sauvegardes ». |

## Données

Trois mois complets, **52 pièces**, toutes détaillées par postes (elles
ouvrent donc le bordereau imprimable) :

| Mois | Pièces | Recettes | Dépenses | Solde de fin |
|---|---|---|---|---|
| Septembre 2026 | 17 | 8 026 550 Ar | 2 458 000 Ar | 6 818 550 Ar |
| Octobre 2026 | 17 | 8 026 550 Ar | 2 458 000 Ar | 12 387 100 Ar |
| Novembre 2026 | 18 | 8 426 550 Ar | 2 458 000 Ar | 18 355 650 Ar |

Solde d’ouverture : **1 250 000 Ar**. Exercice ouvert : **2026**.

Les recettes reprennent le carnet de caisse hospitalier (consultations,
laboratoire, médicament, échographie, soins, maternité, hospitalisation) ; les
dépenses couvrent les achats, le carburant, l’électricité, la maintenance, les
missions, les fournitures et les honoraires. Décembre, janvier et novembre
auraient des pièces propres à chaque mois : le générateur en prévoit.

## Charger le jeu d’essai

**Méthode 1 — page de démonstration** (mode local, sans serveur) :

1. Ouvrir `demo/charger-demo.html` depuis le serveur de développement
   (`http://localhost:3000/demo/charger-demo.html`) ;
2. cliquer sur « Charger et ouvrir l’application ».

Le livre déjà présent, s’il existe, est conservé sous une clé
`essai_precedent_*` du navigateur avant remplacement.

**Méthode 2 — import classique** (fonctionne aussi en mode WAMP/MySQL) :

1. onglet **Données & sauvegardes** ;
2. choisir `jeu_essai_caisse_salfa_2026-09_2026-10_2026-11.json` ;
3. cocher la confirmation puis **Restaurer et remplacer**.

L’application valide intégralement le fichier avant de remplacer quoi que ce
soit, et exporte automatiquement le livre courant au préalable.

## Régénérer le fichier

Depuis la racine du dépôt :

```bash
npx vite-node scripts/jeu-essai.ts -- --mois=2026-11
```

Le script s’appuie sur le vrai moteur du livre (validation, numérotation
annuelle, compteurs) : un jeu incohérent ne peut pas être produit. Le dernier
mois indiqué devient l’exercice ouvert ; les deux précédents sont inclus.

## À savoir

- Ces données sont fictives. N’importez pas ce fichier sur une installation qui
  contient de vraies écritures sans avoir exporté une sauvegarde au préalable.
- Le test `src/utils/jeu-essai.test.ts` relit le fichier livré avec le
  validateur de l’application : si le format change, la suite de tests le
  signale.

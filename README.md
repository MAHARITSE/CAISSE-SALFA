# CAISSE SALFA — Livre journal des recettes et dépenses

Application de **trésorerie hospitalière** : le caissier ne suit pas les recettes
par client, il tient le **livre journal** de la caisse — recettes d'un côté,
dépenses de l'autre, avec le **solde cumulé** après chaque écriture, comme le
classeur Excel « Livre journal des recettes et dépenses ».

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint     # tsc --noEmit
```

## Le livre

Chaque écriture porte :

| Colonne | Rôle |
| --- | --- |
| Date | jour de l'opération |
| N° pièce | `RC-2026-0001` (recette) / `DP-2026-0001` (dépense), attribué automatiquement |
| Libellé | motif de l'opération |
| Catégorie | consultations, pharmacie, laboratoire… / médicaments, carburant, salaires… |
| Tiers / service | fournisseur, service, patient |
| Mode | espèces, chèque, virement, mobile money |
| Référence | pièce justificative |
| Recette / Dépense | montant MGA (une seule des deux colonnes) |
| Solde | solde de trésorerie cumulé **après** l'écriture |

En tête du tableau figure le **report à nouveau** : solde d'ouverture du mois,
modifiable dans la carte « Solde d'ouverture ».

## Saisie : deux modes, l'interface simple par défaut

L'onglet **Saisie** propose :

- **Saisie simple** (par défaut) : une écriture à la fois, avec la bascule
  Recette / Dépense. C'est l'interface habituelle, à utiliser pour la majorité
  des opérations.
- **Bordereau multi-lignes** : à appeler quand un état de recette comporte
  plusieurs lignes de vente — la caissière remplit alors le bordereau d'un coup.

## Modèle de saisie des recettes (bordereau papier)

Le mode **Bordereau multi-lignes** reprend le bordereau utilisé sur papier :

| n° | Désignation | Référence | Montant | Observation |
| --- | --- | --- | --- | --- |
| 1 | MÉDICAMENT | n° pièce | montant | remarque |
| 2 | CONSULTATION | … | … | … |
| … | ÉCHOGRAPHIE, HOSPITALISATION, DENTISTERIE, SOINS, LABORATOIRE, BLOC, DIVERS, VACCIN | | | |

- En-tête : **Date** et **P/c de** (le nom porté sur le bordereau).
- Le **total des recettes** se calcule à chaque frappe.
- Le montant est repris en toutes lettres : « Arrêtée la recette à la somme totale de
  *Un million six cent trente mille quatre cents Ariary* ».
- À l'enregistrement, **chaque ligne renseignée devient une écriture de recette**
  du livre journal (numéros `RC-2026-0001`, `RC-2026-0002`…) avec sa référence
  et son observation ; le total du journal correspond au total du bordereau.
- Seules les lignes avec un montant > 0 sont enregistrées, les autres restent vierges.

## Fonctions

- **Saisie** : interface simple (recette / dépense, une ligne) et bordereau
  multi-lignes à la demande, numéro automatique, suggestions de libellés et de
  tiers déjà utilisés.
- **Correction** : `✎` ouvre le panneau de modification de l'écriture (recette
  comme dépense), `×` la supprime après confirmation.
- **Période** : sélecteur de mois, bouton « Tout afficher », recherche plein texte.
- **Synthèse** : recettes, dépenses et solde de la période affichée.
- **Export Excel** : CSV `;` + BOM UTF-8 (`livre_journal_novembre_2026.csv`),
  avec en-tête, report à nouveau, totaux et solde — s'ouvre directement dans Excel.
- **Impression** : journal mis en page en A4 paysage, sans les contrôles.

## Données

Tout reste dans le navigateur :

- `salfa_tresorerie_ecritures_v1` — le livre journal ;
- `salfa_tresorerie_parametres_v1` — solde d'ouverture.

Les données de la version précédente (`salfa_caisse_transactions`, recettes et
dépenses avec `numeroPiece` / `type`) sont **reprises automatiquement** au
premier lancement, puis converties au nouveau format.

## Structure

```
src/
  App.tsx                    état, filtres, solde cumulé
  types.ts                   Ecriture, LigneJournal, Parametres
  components/SaisieEcriture.tsx     saisie simple (recette ou dépense)
  components/RecetteCaisse.tsx      bordereau de recette multi-lignes
  components/EditionEcriture.tsx    correction d'une écriture
  components/LivreJournal.tsx
  components/Synthese.tsx
  utils/storage.ts           lecture/écriture + reprise de l'ancien format
  utils/format.ts            Ariary, dates, libellés de mois
  utils/numberToWords.ts     montant en toutes lettres (Ariary)
  utils/export.ts            export CSV compatible Excel
```

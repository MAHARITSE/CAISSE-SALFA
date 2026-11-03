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

## Fonctions

- **Saisie** : bascule Recette / Dépense, numéro automatique, suggestions de
  libellés et de tiers déjà utilisés.
- **Correction** : `✎` recharge l'écriture dans le formulaire, `×` la supprime
  (confirmation avant suppression).
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
  components/SaisieEcriture.tsx
  components/LivreJournal.tsx
  components/Synthese.tsx
  utils/storage.ts           lecture/écriture + reprise de l'ancien format
  utils/format.ts            Ariary, dates, libellés de mois
  utils/export.ts            export CSV compatible Excel
```

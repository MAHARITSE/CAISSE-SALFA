# CAISSE SALFA — Dépenses

Version minimaliste de la caisse : **saisie des dépenses**, **masque de saisie** (liste plate de dépenses types) et **journal en lecture seule**. Aucun autre écran.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
npm run lint     # tsc --noEmit
```

## Utilisation

- **Saisie** : date, montant, libellé, catégorie, bénéficiaire, mode de règlement, référence. Le numéro (`DEP-2026-0001`) est généré automatiquement.
- **Masque de saisie** : liste de dépenses types. Un clic pré-remplit le formulaire ; `+ Ajouter la saisie au masque` enregistre la saisie en cours comme dépense type ; `×` la retire.
- **Journal** : toutes les dépenses enregistrées, avec total. Lecture seule.

## Structure

```
src/
  App.tsx                     coquille + état (dépenses, masque, onglet)
  types.ts                    Depense, MasqueDepense, ModePaiement
  components/SaisieDepense.tsx
  components/MasqueDepenses.tsx
  components/Journal.tsx
  utils/storage.ts            lecture/écriture localStorage + compatibilité ancien format
  utils/format.ts             formatage Ariary / date
```

## Données

Tout est conservé dans le navigateur :
- `salfa_caisse_transactions` — dépenses (l'ancien format `numeroPiece` / `type` reste lisible) ;
- `salfa_caisse_masques_depenses` — masque de saisie (l'ancien format `montantDefaut` reste lisible).

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c3e7939a-c697-4a66-8d4a-0a67fa4ab747

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Masque de saisie des dépenses (CAISSE SALFA)

Le module **Saisie de Caisse → Dépense** intègre désormais un *masque de saisie des
dépenses*, construit sur le même modèle d'ajout / modification d'entête que
l'application [SALAIRE-SALFA](https://github.com/MAHARITSE/SALAIRE-SALFA)
(`bulletin/header.ts` + `BulletinHeaderModal.tsx`).

### 1. Appeler une dépense du masque
Dans l'écran de saisie, passez en **Dépense (Sortie)** : le bandeau
« Masque de saisie des dépenses » propose la liste des dépenses types
(`MDEP-0001`, `MDEP-0002`, …). Un clic (ou le sélecteur) pré-remplit le
formulaire : libellé, catégorie, bénéficiaire, mode de règlement, montant,
compte bancaire et références.

### 2. Décider qu'une dépense entre dans le masque
Au moment de valider une dépense, cochez **« Verser cette dépense dans le masque
de saisie »** :
- une nouvelle entrée `MDEP-…` est créée, ou
- l'entrée appliquée est mise à jour si « Mettre à jour le masque appliqué » est coché.

Le bouton **« Ajouter au masque maintenant »** fait la même chose sans enregistrer
la transaction dans la caisse.

### 3. Ajout / modification des entrées du masque
**« Gérer les masques »** ouvre la fenêtre de gestion : création, modification,
duplication, retrait, activation/désactivation (une dépense inactive reste
enregistrée mais n'est plus proposée ni imprimée) et reprise d'une dépense déjà
saisie depuis la mémoire de caisse.

### 4. Entête du document (modèle SALAIRE-SALFA)
**« Entête »** ouvre la fenêtre de réglage de l'entête, avec les deux modes du
modèle SALAIRE SALFA :
- **Image complète** : import d'une image PNG/JPEG (1 Mo max) ;
- **Textes et logos personnalisés** : 7 lignes éditables, logos gauche/droit,
  titre du document, nombre de lignes de la feuille vierge et mention de pied.

L'aperçu, l'écran et le document imprimé utilisent le **même rendu**
(`src/components/MasqueEntete.tsx`), avec restauration de l'entête fourni.

### 5. Impression
**« Imprimer le masque »** génère le document officiel avec l'entête configuré :
- **Masque rempli** : dépenses du masque sélectionnées, total et montant en
  toutes lettres, visas caissier / chef comptable / direction ;
- **Feuille vierge** : lignes à remplir à la main puis à saisir dans l'application.

### Fichiers ajoutés
| Fichier | Rôle |
| --- | --- |
| `src/utils/masqueDepenses.ts` | Modèle d'entête (validation, lecture/écriture, import d'image) et utilitaires du masque |
| `src/components/MasqueEntete.tsx` | Rendu partagé de l'entête (aperçu, écran, impression) |
| `src/components/MasqueEnteteModal.tsx` | Ajout / modification de l'entête |
| `src/components/MasqueDepensesModal.tsx` | Gestion des dépenses du masque |
| `src/components/MasqueDepensePrintModal.tsx` | Aperçu et impression du masque |
| `src/components/MasqueSaisiePanel.tsx` | Bandeau du masque intégré à la saisie |

Les masques (`salfa_caisse_masques_depenses`) et l'entête
(`salfa_caisse_masque_entete_v1`) sont conservés dans le navigateur et inclus
dans la sauvegarde / restauration JSON de l'application.

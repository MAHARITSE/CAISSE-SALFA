/**
 * Amorçage du jeu d'essai — développement uniquement.
 *
 * Injecté par vite.config.ts (plugin « amorce-demo », `apply: 'serve'`) : ce
 * fichier n'existe ni dans `vite build` ni dans le paquet WAMP.
 *
 *  - `?demo=0` : aucun chargement ;
 *  - `?demo=1` : remplace le livre courant (l'ancien est conservé) ;
 *  - sinon : n'installe le jeu d'essai que si aucun livre n'existe encore.
 */
import { amorcer, modeDemo } from '../src/utils/amorce';

void amorcer({ mode: modeDemo(location.search) })
  .then(recharge => { if (recharge) location.reload(); })
  .catch(erreur => {
    console.warn('[démo] jeu d’essai non chargé :', erreur instanceof Error ? erreur.message : erreur);
  });

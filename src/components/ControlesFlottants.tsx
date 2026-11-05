import { useEffect, useState } from 'react';
import { Minus, Moon, Plus, Sun } from 'lucide-react';

const CLE_THEME = 'salfa_theme';
const CLE_TAILLE = 'salfa_taille_police';
export const NIVEAUX_TAILLE = [13, 14, 15, 16, 17, 18, 20, 22] as const;
export const TAILLE_DEFAUT = 16;

/**
 * Détermine le thème actif au démarrage (stocké ou préférence système).
 */
function themeInitial(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stocke = localStorage.getItem(CLE_THEME);
  if (stocke === 'dark' || stocke === 'light') return stocke;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Récupère la taille de police initiale enregistrée (16px par défaut).
 */
function tailleInitiale(): number {
  if (typeof window === 'undefined') return TAILLE_DEFAUT;
  const stocke = Number(localStorage.getItem(CLE_TAILLE));
  if (stocke && NIVEAUX_TAILLE.includes(stocke as (typeof NIVEAUX_TAILLE)[number])) {
    return stocke;
  }
  return TAILLE_DEFAUT;
}

/**
 * Barre flottante en bas à droite de l'écran :
 * - Commutation mode clair / mode sombre
 * - Réduction (-) et augmentation (+) de la taille de police
 */
export function ControlesFlottants() {
  const [theme, setTheme] = useState<'light' | 'dark'>(themeInitial);
  const [taille, setTaille] = useState<number>(tailleInitiale);

  // Applique le thème et la taille au montage et lors des changements
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(CLE_THEME, theme);
    } catch {
      // Ignorer si le stockage local est indisponible
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${taille}px`;
    try {
      localStorage.setItem(CLE_TAILLE, String(taille));
    } catch {
      // Ignorer si le stockage local est indisponible
    }
  }, [taille]);

  const basculerTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  const reduirePolice = () => {
    const index = NIVEAUX_TAILLE.indexOf(taille as (typeof NIVEAUX_TAILLE)[number]);
    if (index > 0) {
      setTaille(NIVEAUX_TAILLE[index - 1]);
    } else if (index === -1) {
      // Si la taille était hors-grille, trouver le plus proche inférieur
      const inferieur = [...NIVEAUX_TAILLE].reverse().find(n => n < taille);
      setTaille(inferieur ?? NIVEAUX_TAILLE[0]);
    }
  };

  const augmenterPolice = () => {
    const index = NIVEAUX_TAILLE.indexOf(taille as (typeof NIVEAUX_TAILLE)[number]);
    if (index !== -1 && index < NIVEAUX_TAILLE.length - 1) {
      setTaille(NIVEAUX_TAILLE[index + 1]);
    } else if (index === -1) {
      const superieur = NIVEAUX_TAILLE.find(n => n > taille);
      setTaille(superieur ?? NIVEAUX_TAILLE[NIVEAUX_TAILLE.length - 1]);
    }
  };

  const reinitialiserPolice = () => {
    setTaille(TAILLE_DEFAUT);
  };

  const indexActuel = NIVEAUX_TAILLE.indexOf(taille as (typeof NIVEAUX_TAILLE)[number]);
  const peutReduire = indexActuel > 0 || (indexActuel === -1 && taille > NIVEAUX_TAILLE[0]);
  const peutAugmenter =
    (indexActuel !== -1 && indexActuel < NIVEAUX_TAILLE.length - 1) ||
    (indexActuel === -1 && taille < NIVEAUX_TAILLE[NIVEAUX_TAILLE.length - 1]);

  const pourcentage = Math.round((taille / TAILLE_DEFAUT) * 100);

  return (
    <aside
      aria-label="Accessibilité et affichage"
      className="no-print fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 p-1 shadow-lg shadow-slate-900/10 backdrop-blur transition-all dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/40 sm:bottom-5 sm:left-5 sm:p-1.5"
    >
      {/* Bascule Mode Sombre / Mode Clair */}
      <button
        type="button"
        onClick={basculerTheme}
        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:size-9"
        aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
        title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {theme === 'dark' ? (
          <Sun size={17} className="text-amber-400" />
        ) : (
          <Moon size={17} className="text-slate-700 dark:text-slate-200" />
        )}
      </button>

      <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

      {/* Bouton - : réduire la police */}
      <button
        type="button"
        onClick={reduirePolice}
        disabled={!peutReduire}
        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:size-9"
        aria-label="Réduire la taille de police"
        title="Réduire la taille de police (-)"
      >
        <Minus size={16} />
      </button>

      {/* Indicateur de zoom / remise à 100% */}
      <button
        type="button"
        onClick={reinitialiserPolice}
        className="flex h-7 min-w-8 items-center justify-center rounded-full px-1.5 font-mono text-xs font-semibold tabular-nums text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={`Taille actuelle ${pourcentage}%, cliquer pour réinitialiser à 100%`}
        title={`Taille actuelle : ${pourcentage}% (cliquer pour réinitialiser)`}
      >
        {pourcentage}%
      </button>

      {/* Bouton + : augmenter la police */}
      <button
        type="button"
        onClick={augmenterPolice}
        disabled={!peutAugmenter}
        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:size-9"
        aria-label="Augmenter la taille de police"
        title="Augmenter la taille de police (+)"
      >
        <Plus size={16} />
      </button>
    </aside>
  );
}

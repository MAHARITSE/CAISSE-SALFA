import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ServerCog } from 'lucide-react';
import { MODE_API } from '../utils/api';

/**
 * Dernier filet de sécurité de l'affichage.
 *
 * Si un écran lève malgré tout une erreur (une donnée inattendue venue du
 * serveur, par exemple), l'application ne reste pas bloquée sur une page
 * blanche : elle explique ce qui s'est passé, dit où vivent les données et
 * permet de recharger. Le message s'adapte au mode — en version serveur, les
 * données sont dans MySQL et recharger ne perd rien ; hors serveur, il ne faut
 * surtout pas effacer les données du site.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { erreur: Error | null }
> {
  state: { erreur: Error | null } = { erreur: null };

  static getDerivedStateFromError(erreur: Error) {
    return { erreur };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur d’affichage CAISSE SALFA', error, info.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="card space-y-4 p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">L’affichage a rencontré un problème</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {MODE_API
                  ? 'Une donnée reçue du serveur n’a pas pu être affichée. Vos écritures restent dans la base MySQL : recharger ne supprime rien.'
                  : 'Rechargez l’application pour réessayer. Cette action ne supprime pas les données enregistrées dans le navigateur. Évitez d’effacer les données du site.'}
              </p>
            </div>
          </div>

          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">Détail technique</summary>
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{this.state.erreur.name} : {this.state.erreur.message}</p>
            {MODE_API && <p className="mt-2 leading-relaxed">
              Ce détail aide à retrouver la cause. L’onglet « Réseau » du navigateur et le diagnostic du serveur donnent la réponse complète.
            </p>}
          </details>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} />Recharger l’application
            </button>
            {MODE_API && <a className="btn-secondary" href="api/index.php?action=verifier" target="_blank" rel="noreferrer">
              <ServerCog size={16} />Ouvrir le diagnostic du serveur
            </a>}
          </div>

          {MODE_API && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Si le message revient, videz le cache du navigateur (Ctrl+F5) puis rechargez. En dernier recours, un administrateur peut restaurer la dernière sauvegarde depuis « Données & sauvegardes ».
          </p>}
        </div>
      </main>
    );
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() { return { erreur: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Erreur d’affichage CAISSE SALFA', error, info.componentStack); }
  render() {
    if (this.state.erreur) return <main className="mx-auto max-w-lg p-8"><div className="card space-y-4 p-8"><h1 className="text-xl font-bold text-slate-900">L’affichage a rencontré un problème</h1><p className="text-sm leading-relaxed text-slate-600">Rechargez l’application pour réessayer. Cette action ne supprime pas les données enregistrées dans le navigateur. Évitez d’effacer les données du site.</p><button className="btn-primary" onClick={() => window.location.reload()}>Recharger l’application</button></div></main>;
    return this.props.children;
  }
}

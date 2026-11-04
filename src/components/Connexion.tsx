import { useState, type FormEvent } from 'react';
import { AlertTriangle, HeartPulse, KeyRound, Loader2, LogIn } from 'lucide-react';
import type { EtatSession } from '../utils/api';
import { connexion } from '../utils/api';

interface Props {
  erreurInitiale?: string | null;
  onConnecte: (etat: EtatSession) => void;
}

/** Écran de connexion de la version WAMP : le serveur PHP vérifie le mot de passe. */
export function Connexion({ erreurInitiale, onConnecte }: Props) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim() || !motDePasse) { setErreur('Saisissez votre identifiant et votre mot de passe.'); return; }
    setEnCours(true); setErreur('');
    try {
      const etat = await connexion(identifiant.trim(), motDePasse);
      if (!etat.connecte) { setErreur('Connexion refusée. Vérifiez vos identifiants.'); return; }
      onConnecte(etat);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"><HeartPulse size={24} /></span>
        <div><p className="text-lg font-extrabold tracking-tight text-brand-950">SALFA</p><p className="text-[10px] tracking-[0.16em] text-slate-400">GESTION DE CAISSE</p></div>
      </div>
      <form onSubmit={envoyer} className="card space-y-4 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-base font-bold"><LogIn size={18} className="text-brand-700" />Connexion à la caisse</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Utilisez le compte créé lors de l’installation. La session se ferme automatiquement après 30 minutes d’inactivité.</p>
        </div>
        <div>
          <label className="label" htmlFor="identifiant">Identifiant</label>
          <input id="identifiant" className="field" autoComplete="username" value={identifiant} onChange={e => setIdentifiant(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="label" htmlFor="mot-de-passe">Mot de passe</label>
          <input id="mot-de-passe" type="password" className="field" autoComplete="current-password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} required />
        </div>
        {(erreur || erreurInitiale) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur || erreurInitiale}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={enCours}>
          {enCours ? <><Loader2 size={16} className="animate-spin" />Vérification…</> : <><KeyRound size={16} />Se connecter</>}
        </button>
        <p className="text-center text-[11px] text-slate-400">Mot de passe oublié ? Utilisez <code className="rounded bg-slate-100 px-1">outils\creer-admin.bat</code> sur le serveur.</p>
      </form>
    </div>
  </div>;
}

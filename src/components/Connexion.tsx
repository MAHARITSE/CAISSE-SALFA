import { useState, type FormEvent } from 'react';
import { AlertTriangle, BookOpen, Eye, EyeOff, HeartPulse, KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import type { EtatSession } from '../utils/api';
import { MODE_API, connexion } from '../utils/api';
import { verifierConnexionLocale, COMPTES_DEMO } from '../utils/utilisateurs';
import { libelleRole, type Role } from '../utils/roles';

/**
 * Écran d'ouverture : l'application ne s'ouvre qu'une fois un compte reconnu.
 *
 * Deux vérifications, jamais mélangées :
 *  - sur WAMP, le serveur PHP compare le mot de passe à son hachage MySQL ;
 *  - en local (démonstration, tests), le compte vient du stockage du navigateur.
 *
 * Le mot de passe ne quitte jamais cet écran autrement que par le formulaire.
 */
export function Connexion({ erreurInitiale, onConnecte }: {
  erreurInitiale?: string | null;
  onConnecte: (etat: EtatSession) => void;
}) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim() || !motDePasse) {
      setErreur('Saisissez votre identifiant et votre mot de passe.');
      return;
    }
    setEnCours(true);
    setErreur('');
    try {
      if (MODE_API) {
        const etat = await connexion(identifiant.trim(), motDePasse);
        if (!etat.connecte) {
          setErreur('Connexion refusée. Vérifiez vos identifiants.');
          return;
        }
        onConnecte(etat);
        return;
      }
      // Hors serveur : le compte local fait foi.
      const compte = await verifierConnexionLocale(identifiant, motDePasse);
      if (!compte) {
        setErreur('Connexion refusée. Vérifiez vos identifiants.');
        return;
      }
      onConnecte({
        connecte: true,
        utilisateur: { id: compte.id, identifiant: compte.identifiant, nomComplet: compte.nomComplet, role: compte.role },
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  }

  /** Remplissage rapide des comptes de démonstration (hors serveur seulement). */
  const remplir = (compte: typeof COMPTES_DEMO[number]) => {
    setIdentifiant(compte.identifiant);
    setMotDePasse(compte.motDePasse);
    setErreur('');
  };

  return <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
    {/* Volet gauche : l'identité de la caisse. */}
    <aside className="relative flex flex-col justify-between overflow-hidden bg-brand-950 px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-700/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-brand-800/40 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><HeartPulse size={24} /></span>
        <div>
          <p className="text-lg font-extrabold tracking-tight">SALFA</p>
          <p className="text-[10px] tracking-[0.16em] text-white/50">GESTION DE CAISSE</p>
        </div>
      </div>

      <div className="relative mt-10 space-y-4 lg:mt-0">
        <h1 className="text-2xl font-bold leading-tight lg:text-3xl">La caisse de l’hôpital,<br />à portée de main.</h1>
        <p className="max-w-sm text-sm leading-relaxed text-white/70">
          Livre journal, bordereaux imprimables, analyse et clôtures : chaque mouvement de la caisse est tracé,
          signé et retrouvable.
        </p>
        <ul className="space-y-2 pt-2 text-xs text-white/70">
          {[
            ['Livre journal', 'Recettes et dépenses, poste par poste'],
            ['Bordereaux officiels', 'Demande d’engagement et autorisation de recettes'],
            ['Analyse de la caisse', 'Soldes, catégories et périodes'],
          ].map(([titre, detail]) => <li key={titre} className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-white/50" />
            <span><span className="font-semibold text-white/90">{titre}</span> — {detail}</span>
          </li>)}
        </ul>
      </div>

      <p className="relative mt-10 text-[11px] text-white/40 lg:mt-0">
        Hôpitaly Loterana Toliary Tanambao — BP : 99
      </p>
    </aside>

    {/* Volet droit : le formulaire. */}
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 lg:hidden">
          <p className="text-lg font-extrabold tracking-tight text-brand-950">SALFA</p>
          <p className="text-[10px] tracking-[0.16em] text-slate-400">GESTION DE CAISSE</p>
        </div>

        <form onSubmit={envoyer} className="card space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><LogIn size={18} className="text-brand-700" />Connexion à la caisse</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Ouvrez la session avec votre compte : chaque rôle retrouve ses pages.</p>
          </div>

          <div>
            <label className="label" htmlFor="identifiant">Identifiant</label>
            <input
              id="identifiant"
              className="field"
              autoComplete="username"
              autoFocus
              required
              value={identifiant}
              onChange={e => { setIdentifiant(e.target.value); setErreur(''); }}
            />
          </div>

          <div>
            <label className="label" htmlFor="mot-de-passe">Mot de passe</label>
            <div className="relative">
              <input
                id="mot-de-passe"
                type={afficher ? 'text' : 'password'}
                className="field pr-10"
                autoComplete="current-password"
                required
                value={motDePasse}
                onChange={e => { setMotDePasse(e.target.value); setErreur(''); }}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                title={afficher ? 'Masquer' : 'Afficher'}
                onClick={() => setAfficher(v => !v)}
              >{afficher ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>

          {(erreur || erreurInitiale) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur || erreurInitiale}
          </p>}

          <button type="submit" className="btn-primary w-full justify-center" disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="animate-spin" />Vérification…</> : <><KeyRound size={16} />Se connecter</>}
          </button>

          {MODE_API
            ? <p className="text-center text-[11px] leading-relaxed text-slate-400">
              Mot de passe oublié ? Utilisez <code className="rounded bg-slate-100 px-1">outils\creer-admin.bat</code> sur le serveur.
            </p>
            : <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <BookOpen size={12} />Comptes de démonstration
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500">Cliquez un rôle pour remplir le formulaire, puis « Se connecter ».</p>
              <div className="grid gap-1.5">
                {COMPTES_DEMO.map(compte => <button
                  key={compte.identifiant}
                  type="button"
                  onClick={() => remplir(compte)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="font-semibold text-slate-700">{libelleRole(compte.role as Role)}</span>
                  <span className="font-mono text-[10px] text-slate-500">{compte.identifiant} · {compte.motDePasse}</span>
                </button>)}
              </div>
            </div>}
        </form>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
          {MODE_API
            ? 'Session fermée automatiquement après 30 minutes d’inactivité.'
            : 'Mode démonstration : les données restent dans ce navigateur.'}
        </p>
      </div>
    </main>
  </div>;
}

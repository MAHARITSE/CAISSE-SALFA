import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, BookOpen, Eye, EyeOff, HeartPulse, KeyRound, Loader2, LogIn, RefreshCw, ServerCog } from 'lucide-react';
import type { EtatSession } from '../utils/api';
import { ErreurApi, MODE_API, connexion, sante } from '../utils/api';
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
  /**
   * État du serveur PHP, testé dès l'affichage de l'écran : sur un paquet
   * fraîchement recopié, l'API répond « non installé » et aucun compte ne peut
   * fonctionner. Mieux vaut le dire avec les étapes de l'installation que de
   * laisser l'utilisateur essayer des mots de passe qui ne peuvent pas aboutir.
   */
  const [serveur, setServeur] = useState<'inconnu' | 'pret' | 'non_installe' | 'injoignable'>('inconnu');
  const [verification, setVerification] = useState(false);

  const verifierServeur = useCallback(async () => {
    if (!MODE_API) return;
    setVerification(true);
    try {
      await sante();
      setServeur('pret');
    } catch (e) {
      setServeur(e instanceof ErreurApi && e.code === 'non_installe' ? 'non_installe' : 'injoignable');
    } finally {
      setVerification(false);
    }
  }, []);

  useEffect(() => { void verifierServeur(); }, [verifierServeur]);

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
      if (e instanceof ErreurApi && e.code === 'non_installe') {
        // Le panneau d'installation ci-dessous explique quoi faire : pas de
        // deuxième message d'erreur en rouge par-dessus.
        setServeur('non_installe');
        setErreur('');
        return;
      }
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

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 transition-colors dark:bg-slate-950">
    <div className="w-full max-w-md">
      {/* La carte seule : rien à côté, l'attention reste sur la connexion. */}
      <form onSubmit={envoyer} className="card space-y-4 p-7">
        {/* L'identité de la caisse, la même que dans la barre d'en-tête. */}
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm dark:bg-brand-600"><HeartPulse size={23} strokeWidth={2} /></span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-none tracking-tight text-brand-950 dark:text-brand-300">SALFA</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Caisse principale · Gestion de caisse</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><LogIn size={20} className="text-brand-700 dark:text-brand-400" />Connexion à la caisse</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Ouvrez la session avec votre compte : chaque rôle retrouve ses pages.</p>
        </div>

        {MODE_API && (serveur === 'non_installe' || serveur === 'injoignable') && <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-semibold">
            <ServerCog size={17} className="shrink-0" />
            {serveur === 'non_installe' ? 'Serveur pas encore installé' : 'Serveur injoignable'}
          </p>
          {serveur === 'non_installe' ? <>
            <p className="mt-1.5 leading-relaxed">
              La page s’affiche, mais l’API PHP n’a pas encore sa configuration MySQL :
              aucun compte ne peut se connecter avant l’installation, qui prend une minute.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
              <li>Cliquez sur « Ouvrir l’installation » ci-dessous.</li>
              <li>Indiquez les accès MySQL (sur WAMP : <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">root</code>, mot de passe vide) et le compte administrateur.</li>
              <li>Revenez sur cet écran et cliquez sur « Réessayer ».</li>
            </ol>
          </> : <p className="mt-1.5 leading-relaxed">
            Aucune réponse de <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">api/index.php</code>.
            Vérifiez qu’Apache et MySQL sont démarrés dans WAMP, que le dossier <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">api/</code>
            est complet, puis réessayez.
          </p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {serveur === 'non_installe' && <a className="btn-primary !py-1.5 !text-xs" href="installer.php">Ouvrir l’installation</a>}
            <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => void verifierServeur()} disabled={verification}>
              {verification ? <><Loader2 size={14} className="animate-spin" />Vérification…</> : <><RefreshCw size={14} />Réessayer</>}
            </button>
            <a
              className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
              href="api/index.php?action=verifier"
              target="_blank"
              rel="noreferrer"
            >Ouvrir le diagnostic du serveur</a>
          </div>
        </div>}

        <div>
          <label className="label" htmlFor="identifiant">Identifiant</label>
          <input
            id="identifiant"
            className="field"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
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
              name="mot-de-passe"
              spellCheck={false}
              required
              value={motDePasse}
              onChange={e => { setMotDePasse(e.target.value); setErreur(''); }}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
              aria-label={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              title={afficher ? 'Masquer' : 'Afficher'}
              onClick={() => setAfficher(v => !v)}
            >{afficher ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </div>

        {(erreur || erreurInitiale) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />{erreur || erreurInitiale}
        </p>}

        <button type="submit" className="btn-primary w-full justify-center !py-2.5 text-sm" disabled={enCours}>
          {enCours ? <><Loader2 size={18} className="animate-spin" />Vérification…</> : <><KeyRound size={18} />Se connecter</>}
        </button>

        {MODE_API
          ? <p className="text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            Mot de passe oublié ? Un administrateur peut le réinitialiser depuis l’onglet « Administration ».
          </p>
          : <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <BookOpen size={14} />Comptes de démonstration
            </p>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">Cliquez un rôle pour remplir le formulaire, puis « Se connecter ».</p>
            <div className="grid gap-2">
              {COMPTES_DEMO.map(compte => <button
                key={compte.identifiant}
                type="button"
                onClick={() => remplir(compte)}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:bg-slate-700 sm:text-sm"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">{libelleRole(compte.role as Role)}</span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{compte.identifiant} · {compte.motDePasse}</span>
              </button>)}
            </div>
          </div>}
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {MODE_API
          ? 'Session fermée automatiquement après 30 minutes d’inactivité.'
          : 'Mode démonstration : les données restent dans ce navigateur.'}
        <br />Le navigateur ne mémorise pas le mot de passe.
      </p>
    </div>
  </div>;
}

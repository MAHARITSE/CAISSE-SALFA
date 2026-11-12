import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Database, Eye, EyeOff, HeartPulse, KeyRound, Loader2, LogIn, RefreshCw, ServerCog } from 'lucide-react';
import type { EtatSession } from '../utils/api';
import { ErreurApi, MODE_API, configurerServeur, connexion, sante, type AccesMysql } from '../utils/api';
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
export function Connexion({ erreurInitiale, motif, onConnecte }: {
  erreurInitiale?: string | null;
  /** Pourquoi la session précédente s'est fermée (expiration, révocation…). */
  motif?: string;
  onConnecte: (etat: EtatSession) => void;
}) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  /**
   * État du serveur PHP, testé dès l'affichage de l'écran.
   *
   * Le dossier se copie dans `www` : le premier appel crée la configuration, la
   * base, les tables et les comptes de départ. Deux cas seulement demandent une
   * intervention, et ils n'ont rien d'une installation :
   *  - « configurer » : MySQL répond mais refuse l'accès par défaut de WAMP
   *    (mot de passe personnalisé, port 3307) — on demande les accès MySQL ;
   *  - « injoignable » : Apache ou MySQL n'est pas démarré.
   */
  const [serveur, setServeur] = useState<'inconnu' | 'pret' | 'a_configurer' | 'injoignable'>('inconnu');
  /** Accès MySQL saisis dans le panneau, quand l'accès par défaut échoue. */
  const [acces, setAcces] = useState<AccesMysql>({ hote: '127.0.0.1', port: 3306, base: 'caisse_salfa', utilisateur: 'root', motDePasse: '' });
  const [configuration, setConfiguration] = useState<{ enCours: boolean; erreur: string; fait: string }>({ enCours: false, erreur: '', fait: '' });
  const [verification, setVerification] = useState(false);

  const verifierServeur = useCallback(async () => {
    if (!MODE_API) return;
    setVerification(true);
    try {
      await sante();
      setServeur('pret');
    } catch (e) {
      // 503 : la base ou la configuration manque encore. Les codes MySQL
      // distinguent un accès refusé (à saisir) d'un serveur éteint.
      const code = e instanceof ErreurApi ? e.code : '';
      const aSaisir = ['mysql_injoignable', 'base_non_creee', 'base_absente', 'base_indisponible', 'config_non_inscriptible', 'tables_non_creees'];
      setServeur(aSaisir.includes(code) ? 'a_configurer' : 'injoignable');
    } finally {
      setVerification(false);
    }
  }, []);

  useEffect(() => { void verifierServeur(); }, [verifierServeur]);

  /**
   * Prépare le serveur avec les accès MySQL saisis : base, tables et comptes.
   *
   * Simple bouton, jamais un `<form>` : le panneau vit à l'intérieur du
   * formulaire de connexion, et un formulaire imbriqué est invalide en HTML.
   */
  async function preparerServeur() {
    setConfiguration({ enCours: true, erreur: '', fait: '' });
    try {
      const resultat = await configurerServeur({ ...acces, utilisateur: acces.utilisateur.trim() || 'root' });
      setConfiguration({ enCours: false, erreur: '', fait: resultat.message });
      setServeur('pret');
    } catch (err) {
      setConfiguration({ enCours: false, erreur: err instanceof Error ? err.message : 'Préparation du serveur impossible.', fait: '' });
    }
  }

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
      if (e instanceof ErreurApi && ['mysql_injoignable', 'base_non_creee', 'base_absente'].includes(e.code)) {
        // Le panneau des accès MySQL ci-dessous explique quoi faire : pas de
        // deuxième message d'erreur en rouge par-dessus.
        setServeur('a_configurer');
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

        {MODE_API && (serveur === 'a_configurer' || serveur === 'injoignable') && <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-semibold">
            <ServerCog size={17} className="shrink-0" />
            {serveur === 'a_configurer' ? 'Connexion MySQL à préciser' : 'Serveur injoignable'}
          </p>

          {serveur === 'a_configurer' && <>
            <p className="mt-1.5 leading-relaxed">
              La base et les comptes se créent seuls, mais MySQL n’a pas accepté l’accès
              par défaut de WampServer. Indiquez les accès une fois : le serveur prépare
              ensuite sa base, ses tables et ses comptes de départ.
            </p>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold">
                  Hôte
                  <input className="field mt-1 !py-1.5 !text-xs" value={acces.hote} spellCheck={false}
                    onChange={e => setAcces(a => ({ ...a, hote: e.target.value }))} />
                </label>
                <label className="block text-xs font-semibold">
                  Port
                  <input className="field mt-1 !py-1.5 !text-xs" inputMode="numeric" value={acces.port}
                    onChange={e => setAcces(a => ({ ...a, port: Number(e.target.value.replace(/\D/g, '')) || 3306 }))} />
                </label>
                <label className="block text-xs font-semibold">
                  Base
                  <input className="field mt-1 !py-1.5 !text-xs" value={acces.base} spellCheck={false}
                    onChange={e => setAcces(a => ({ ...a, base: e.target.value }))} />
                </label>
                <label className="block text-xs font-semibold">
                  Utilisateur
                  <input className="field mt-1 !py-1.5 !text-xs" value={acces.utilisateur} spellCheck={false}
                    onChange={e => setAcces(a => ({ ...a, utilisateur: e.target.value }))} />
                </label>
              </div>
              <label className="block text-xs font-semibold">
                Mot de passe MySQL <span className="font-normal">(vide sur un WampServer standard)</span>
                <input className="field mt-1 !py-1.5 !text-xs" type="password" autoComplete="off" value={acces.motDePasse}
                  onChange={e => setAcces(a => ({ ...a, motDePasse: e.target.value }))} />
              </label>
              {configuration.erreur && <p role="alert" className="rounded-lg bg-rose-100/80 p-2 text-xs text-rose-900 dark:bg-rose-950/60 dark:text-rose-200">{configuration.erreur}</p>}
              <button type="button" className="btn-primary w-full justify-center !py-1.5 !text-xs" onClick={() => void preparerServeur()} disabled={configuration.enCours}>
                {configuration.enCours ? <><Loader2 size={14} className="animate-spin" />Préparation…</> : <><Database size={14} />Préparer le serveur</>}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed opacity-90">
              Le compte <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">admin</code> (mot de passe
              <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">admin123</code>) est créé à cette étape.
            </p>
          </>}

          {serveur === 'injoignable' && <p className="mt-1.5 leading-relaxed">
            Aucune réponse de <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">api/index.php</code>.
            Vérifiez qu’Apache et MySQL sont démarrés dans WampServer (icône verte) et que le dossier
            <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">api/</code> a bien été copié à côté de
            <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">index.html</code>, puis réessayez.
          </p>}

          <div className="mt-3 flex flex-wrap items-center gap-3">
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

        {/* Le serveur vient d'être préparé : la confirmation survit à la
            fermeture du panneau, pour que l'utilisateur sache qu'il peut saisir
            ses identifiants. */}
        {MODE_API && serveur === 'pret' && configuration.fait && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />{configuration.fait} Connectez-vous avec le compte
          <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/60">admin</code>.
        </p>}

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

        {motif && !erreur && !erreurInitiale && <p role="status" className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          <RefreshCw size={17} className="mt-0.5 shrink-0" />{motif}
        </p>}

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
          ? 'Session fermée automatiquement après 1 heure d’inactivité.'
          : 'Mode démonstration : les données restent dans ce navigateur.'}
        <br />Le navigateur ne mémorise pas le mot de passe.
      </p>
    </div>
  </div>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, CalendarCheck, CalendarClock, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Database, Download, Eye, EyeOff, HeartPulse, KeyRound, LogOut, Plus, Printer, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Settings2, X } from 'lucide-react';
import type { Ecriture, FiltresJournal, Sens } from './types';
import { useLivre } from './hooks/useLivre';
import { calculerJournal, changerSoldeInitial, clotureAutorisee, cloturerExercice, enregistrerCategories, enregistrerEntete, enregistrerEcriture, enregistrerMasques, filtrerJournal, prochainNumero, restaurerEcriture, soldeCloture, soldeOuverture, supprimerEcriture, totaliser } from './utils/ledger';
import { anneeCourante, dateFr, decalerMois, formatAr, libelleMois, moisCourant } from './utils/format';

import { exporterLivreCsv } from './utils/export';
import { exporterArchiveExercice, exporterSauvegarde, exporterSecours } from './utils/backup';
import { Synthese } from './components/Synthese';
import { LivreJournal, type LivreJournalHandle } from './components/LivreJournal';
import { SaisieEcriture } from './components/SaisieEcriture';
import { GestionMasquesModal } from './components/GestionMasquesModal';
import { GestionCategoriesModal } from './components/GestionCategoriesModal';
import { Analyse } from './components/Analyse';
import { DonneesSauvegardes } from './components/DonneesSauvegardes';
import { Confirmation } from './components/Confirmation';
import { Exercices } from './components/Exercices';
import { Connexion } from './components/Connexion';
import { Administration } from './components/Administration';
import { ChangerMotDePasse } from './components/ChangerMotDePasse';
import { EnteteBordereauModal } from './components/EnteteBordereauModal';
import { ControlesFlottants } from './components/ControlesFlottants';
import { MODE_API, deconnexion as deconnexionApi, mutations, sante as santeApi, session as sessionApi, type EtatSession } from './utils/api';
import { enteteModifie, numeroDocument, type EnteteDocument } from './utils/entete';
import { retenirSessionLocale } from './utils/utilisateurs';
import { libelleRole, ongletsAutorises, peutAdministrer, peutModifierSoldeOuverture, peutSaisir, type OngletApplication, type Role } from './utils/roles';
import { VERSION_APPLICATION } from './utils/version';

type Onglet = OngletApplication;

export function App() {
  const { livre, erreur, avertissement, messageSync, muter, muterEnLigne, recharger, rechargerApi, restaurer, chargementApi } = useLivre();
  const journalRef = useRef<LivreJournalHandle>(null);
  /**
   * Hauteur réelle de la barre d'en-tête. La barre de filtres s'y accroche :
   * une valeur fixe se désaligne dès que la navigation passe sur deux lignes
   * (téléphone) ou que la taille de police change.
   */
  const enteteRef = useRef<HTMLElement | null>(null);
  const [hauteurEntete, setHauteurEntete] = useState(0);
  // L'application s'ouvre toujours sur la page de connexion : aucun écran de
  // caisse n'est visible avant qu'un compte soit reconnu.
  const [session, setSession] = useState<EtatSession | null>(null);
  /** Chacun change son propre mot de passe : la modale vit au-dessus du shell. */
  const [motDePasseOuvert, setMotDePasseOuvert] = useState(false);
  const [verificationSession, setVerificationSession] = useState(MODE_API);
  /** Version annoncée par api/sante.php, affichée en mode serveur. */
  const [versionApi, setVersionApi] = useState<string | null>(null);

  // Au démarrage en mode serveur : vérifier la session puis charger le livre MySQL.
  useEffect(() => {
    if (!MODE_API) return;
    let actif = true;
    sessionApi()
      .then(etat => {
        if (!actif) return;
        setSession(etat);
        if (etat.connecte) rechargerApi();
      })
      .catch(() => { if (actif) setSession({ connecte: false, utilisateur: null }); })
      .finally(() => { if (actif) setVerificationSession(false); });
    return () => { actif = false; };
  }, [rechargerApi]);
  useEffect(() => {
    if (!MODE_API || !session?.connecte) return;
    let actif = true;
    santeApi()
      .then(etat => { if (actif) setVersionApi(etat.versionApi); })
      .catch(() => { /* le diagnostic du livre suffit à signaler un serveur muet */ });
    return () => { actif = false; };
  }, [session]);

  const [onglet, setOnglet] = useState<Onglet>('journal');
  const [mois, setMois] = useState(() => {
    const es = livre.ecritures;
    return es.length && !es.some(e => e.date.startsWith(moisCourant())) ? [...es].sort((a, b) => a.date.localeCompare(b.date))[es.length - 1].date.slice(0, 7) : moisCourant();
  });
  const [filtres, setFiltres] = useState<Omit<FiltresJournal, 'mois' | 'toutAfficher'>>({ sens: 'TOUS', categorie: '', recherche: '' });
  const [toutAfficher, setToutAfficher] = useState(false);
  const [saisie, setSaisie] = useState<{ sens: Sens; edition: Ecriture | null } | null>(null);
  const [masquesOuverts, setMasquesOuverts] = useState(false);
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false);
  // L'en-tête se modifie depuis Administration : le livre journal n'en porte plus l'accès.
  const [enteteOuverte, setEnteteOuverte] = useState(false);
  const [afficherSynthese, setAfficherSynthese] = useState(() => {
    try {
      const s = localStorage.getItem('salfa_afficher_synthese');
      return s === null ? true : s === 'true';
    } catch {
      return true;
    }
  });

  function basculerSynthese() {
    setAfficherSynthese(prev => {
      const suivant = !prev;
      try {
        localStorage.setItem('salfa_afficher_synthese', String(suivant));
      } catch (_) {}
      return suivant;
    });
  }
  /**
   * Le livre journal garde l'en-tête de son premier rendu. La clé change dès
   * que l'en-tête est personnalisé : le composant repart alors des valeurs
   * enregistrées, sans quoi le bordereau imprimé montrerait l'ancien papier.
   */
  const cleEntete = enteteModifie(livre.entetes) ? 'personnalise' : 'livre';
  const [aSupprimer, setASupprimer] = useState<Ecriture | null>(null);
  const [derniereSupprimee, setDerniereSupprimee] = useState<Ecriture | null>(null);
  const [notification, setNotification] = useState('');
  const [clotureOuverte, setClotureOuverte] = useState(false);

  useEffect(() => {
    const entete = enteteRef.current;
    if (!entete) return;
    const mesurer = () => setHauteurEntete(entete.offsetHeight);
    mesurer();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', mesurer);
      return () => window.removeEventListener('resize', mesurer);
    }
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(entete);
    return () => observateur.disconnect();
  }, [session]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(''), 7000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  // Un livre ancien peut n'avoir aucun exercice tant que la normalisation n'a pas été enregistrée.
  const exercice = livre.parametres.exercice ?? anneeCourante();
  const journal = useMemo(() => calculerJournal(livre), [livre]);
  const duMois = useMemo(() => toutAfficher ? journal : journal.filter(e => e.date.startsWith(mois)), [journal, mois, toutAfficher]);
  const lignes = useMemo(() => filtrerJournal(journal, { ...filtres, mois, toutAfficher }), [journal, filtres, mois, toutAfficher]);
  const ouverture = useMemo(() => soldeOuverture(journal, mois, toutAfficher, livre.parametres.soldeInitial), [journal, mois, toutAfficher, livre.parametres.soldeInitial]);
  const totauxPeriode = totaliser(duMois);
  const totauxSelection = totaliser(lignes);
  const soldeFin = duMois.length ? duMois[duMois.length - 1].solde : ouverture;
  const periode = toutAfficher ? 'Toutes périodes' : libelleMois(mois);
  const soldeFinExercice = useMemo(() => soldeCloture(livre), [livre]);
  const cloturePossible = clotureAutorisee(exercice);
  const aCloturer = cloturePossible && anneeCourante() > exercice;
  const filtreActif = filtres.sens !== 'TOUS' || Boolean(filtres.categorie || filtres.recherche.trim());
  const suggestionsLibelle = useMemo(() => [...new Set(livre.ecritures.map(e => e.libelle))].slice(-60), [livre.ecritures]);
  const suggestionsTiers = useMemo(() => [...new Set(livre.ecritures.map(e => e.tiers).filter((t): t is string => Boolean(t)))].slice(-60), [livre.ecritures]);
  const categories = [...new Set([...livre.categories.recette, ...livre.categories.depense, ...livre.ecritures.map(e => e.categorie)])];
  const modifierFiltre = (champ: keyof typeof filtres, valeur: string) => setFiltres(f => ({ ...f, [champ]: valeur }));
  const reinitialiser = () => setFiltres({ sens: 'TOUS', categorie: '', recherche: '' });

  async function enregistrer(ecriture: Ecriture) {
    const edition = livre.ecritures.some(e => e.id === ecriture.id);
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.ecriture(revision, ecriture))
      : muter(d => enregistrerEcriture(d, ecriture));
    if (!reussi) return false;
    setSaisie(null); setDerniereSupprimee(null); setMois(ecriture.date.slice(0, 7)); setToutAfficher(false); reinitialiser();
    const document = numeroDocument(ecriture.numero);
    setNotification(edition
      ? 'Modification enregistrée. Les soldes ont été recalculés.'
      : `Écriture enregistrée avec son numéro définitif${document ? ` et son document ${document}` : ''}.`);
    // Le bordereau imprimable s'ouvre aussitôt : l'utilisateur n'a plus à le rechercher dans le journal.
    ouvrirBordereauApresEnregistrement(ecriture);
    return true;
  }
  async function confirmerSuppression() {
    if (!aSupprimer) return;
    const cible = aSupprimer;
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.supprimer(revision, cible.id))
      : muter(d => supprimerEcriture(d, cible.id));
    if (reussi) {
      setASupprimer(null); setDerniereSupprimee(cible);
      setNotification(`Écriture ${cible.numero} supprimée. Vous pouvez annuler cette suppression.`);
    }
  }
  async function annulerSuppression() {
    if (!derniereSupprimee) return;
    const cible = derniereSupprimee;
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.restaurerEcriture(revision, cible))
      : muter(d => restaurerEcriture(d, cible));
    if (reussi) {
      setNotification(`Écriture ${cible.numero} restaurée.`); setDerniereSupprimee(null);
    }
  }
  async function restaurerLivre(importe: Parameters<typeof restaurer>[0]) {
    try {
      if (erreur) exporterSecours(); else exporterSauvegarde(livre);
      await restaurer(importe);
      setDerniereSupprimee(null); setSaisie(null); setASupprimer(null); reinitialiser(); setToutAfficher(true);
      setNotification(MODE_API ? 'Sauvegarde restaurée sur le serveur.' : 'Sauvegarde restaurée et enregistrée localement.');
      return true;
    } catch { return false; }
  }
  /**
   * Ouvre le bordereau d'une écriture qui vient d'être enregistrée.
   * Le numéro définitif et le solde sont relus dans le livre mis à jour.
   */
  function ouvrirBordereauApresEnregistrement(ecriture: Ecriture) {
    const cible = journal.find(e => e.id === ecriture.id) ?? (ecriture.lignesDetail?.length ? { ...ecriture, solde: ecriture.montant } : null);
    if (cible) journalRef.current?.ouvrirBordereau(cible);
  }

  async function enregistrerCategoriesSaisie(sens: 'RECETTE' | 'DEPENSE', liste: string[]) {
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.categories(revision, sens, liste))
      : muter(d => enregistrerCategories(d, sens, liste));
    if (reussi) setNotification(`Catégories de ${sens === 'RECETTE' ? 'recettes' : 'dépenses'} enregistrées (${liste.length}).`);
    return reussi;
  }

  /**
   * L'en-tête est commun aux deux documents : une seule écriture suffit, et
   * elle vaut pour l'engagement de dépense comme pour l'autorisation de
   * recettes. Écrire deux fois de suite ferait échouer le contrôle de
   * révision du second appel, d'où la mention « modifié dans un autre onglet ».
   */
  async function enregistrerEnteteDocument(entete: EnteteDocument) {
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.entete(revision, 'depense', entete))
      : muter(d => enregistrerEntete(d, 'depense', entete));
    if (reussi) setNotification('En-tête enregistré. Les deux bordereaux l’utiliseront.');
  }
  async function changerSolde(montant: number) {
    if (MODE_API) return muterEnLigne(revision => mutations.soldeInitial(revision, montant));
    return muter(d => changerSoldeInitial(d, montant));
  }
  function ouvrirCloture() {
    if (!cloturePossible) {
      setNotification(`L’exercice ${exercice} ne peut être clôturé qu’à partir du 1er janvier ${exercice + 1}. Continuez la saisie jusqu’à la fin de l’année.`);
      return;
    }
    setClotureOuverte(true);
  }
  async function confirmerCloture() {
    const annee = exercice;
    // Double garde : aucune clôture d'une année encore en cours, même si le dialogue était forcé.
    if (!cloturePossible) { setClotureOuverte(false); return false; }
    const archive = cloturerExercice(livre, new Date().toISOString()).exercicesClotures.find(c => c.annee === annee);
    try { exporterSauvegarde(livre, `avant_cloture_${annee}`); }
    catch { setNotification('La clôture est annulée : la sauvegarde préalable a échoué. Exportez le livre puis réessayez.'); return false; }
    const reussi = MODE_API
      ? await muterEnLigne(revision => mutations.cloture(revision, archive))
      : muter(d => cloturerExercice(d));
    if (!reussi) return false;
    setClotureOuverte(false); setDerniereSupprimee(null); setSaisie(null); setToutAfficher(false);
    setMois(moisCourant()); setFiltres({ sens: 'TOUS', categorie: '', recherche: '' });
    setNotification(`Exercice ${annee} clôturé. L’exercice ${annee + 1} est ouvert avec le solde reporté de ${formatAr(archive?.soldeCloture ?? 0)}.`);
    return true;
  }
  function telechargerArchive(annee: number) {
    const archive = livre.exercicesClotures.find(c => c.annee === annee);
    if (!archive) { setNotification('Cet exercice clôturé est introuvable dans le livre.'); return; }
    try { exporterArchiveExercice(archive); setNotification(`Archive de l’exercice ${annee} téléchargée.`); }
    catch { setNotification('Le téléchargement de l’archive a échoué.'); }
  }
  async function deconnecter() {
    if (MODE_API) {
      try { await deconnexionApi(); } catch { /* la session est fermée côté serveur au plus tard par expiration */ }
    }
    retenirSessionLocale(null);
    setSession({ connecte: false, utilisateur: null });
    setNotification('');
  }
  function rechargerLivre() {
    if (recharger()) { setDerniereSupprimee(null); setNotification(MODE_API ? 'Livre rechargé depuis le serveur.' : 'Livre rechargé depuis le stockage local.'); }
  }

  // Le rôle décide de tout ce qui s'ouvre : pages, réglages et saisie.
  const role: Role = (session?.utilisateur?.role ?? 'admin') as Role;
  const autorises = ongletsAutorises(role);
  const saisieOuverte = peutSaisir(role);
  const administre = peutAdministrer(role);
  const soldeModifiable = peutModifierSoldeOuverture(role);
  const navigation = [
    { id: 'journal' as const, label: 'Livre journal', labelCourt: 'Journal', icone: BookOpen },
    { id: 'analyse' as const, label: 'Analyse de la caisse', labelCourt: 'Analyse', icone: ChartNoAxesCombined },
    { id: 'exercices' as const, label: 'Exercices & clôtures', labelCourt: 'Exercices', icone: CalendarCheck },
    { id: 'donnees' as const, label: 'Données & sauvegardes', labelCourt: 'Données', icone: Database },
    { id: 'administration' as const, label: 'Administration', labelCourt: 'Admin', icone: Settings2 },
  ].filter(n => autorises.includes(n.id));
  const titrePage = onglet === 'journal' ? 'Livre de caisse'
    : onglet === 'analyse' ? 'Analyse de la caisse'
    : onglet === 'exercices' ? 'Exercices & clôtures'
    : onglet === 'administration' ? 'Administration'
    : 'Données & sauvegardes';
  const sousTitrePage = onglet === 'journal' ? 'Chaque mouvement compte. Gardez une trace claire de votre trésorerie.'
    : onglet === 'analyse' ? 'Comprenez vos recettes et vos dépenses, période par période.'
    : onglet === 'exercices' ? 'La caisse se clôture chaque année : l’exercice en cours reste court, les précédents sont archivés.'
    : onglet === 'administration' ? 'Les réglages de la caisse et les personnes qui y accèdent, chacune à sa place.'
    : 'Protégez votre historique et gardez la maîtrise de vos données.';

  // Le titre de l'onglet du navigateur suit la page ouverte.
  useEffect(() => {
    document.title = `${titrePage} · Caisse SALFA`;
  }, [titrePage]);

  if (MODE_API && verificationSession) {
    return <>
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Vérification de la session…</div>
      <ControlesFlottants />
    </>;
  }
  if (!session || !session.connecte) {
    return <>
      <Connexion erreurInitiale={MODE_API ? erreur : null} onConnecte={etat => {
        setSession(etat);
        if (etat.utilisateur) retenirSessionLocale({ id: String(etat.utilisateur.id) });
        if (MODE_API) rechargerApi();
      }} />
      <ControlesFlottants />
    </>;
  }
  if (MODE_API && chargementApi && !livre.parametres.exercice) {
    return <>
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Chargement du livre…</div>
      <ControlesFlottants />
    </>;
  }

  return <div className="app-shell min-h-screen transition-colors dark:bg-slate-950">
    <div>
      <a href="#contenu" className="lien-evitement no-print">Aller au contenu principal</a>
      <header ref={enteteRef} id="entete" className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"><HeartPulse size={24} strokeWidth={2} /></span>
            <div><p className="text-xl font-extrabold tracking-tight text-brand-950 dark:text-brand-300">SALFA</p><p className="text-xs tracking-[0.14em] text-slate-400 dark:text-slate-500">GESTION DE CAISSE</p></div>
            <div className="ml-2 hidden border-l border-slate-200 pl-4 sm:block dark:border-slate-800"><p className="text-xs text-slate-400 dark:text-slate-500">Caisse principale</p><p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Exercice {exercice}</p></div>
          </div>
          <div className="flex items-center gap-3"><span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium md:inline-flex ${erreur ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}><span className={`size-2 rounded-full ${erreur ? 'bg-rose-500' : 'bg-emerald-500'}`} />{erreur ? (MODE_API ? 'Serveur à vérifier' : 'Stockage à vérifier') : MODE_API ? `Serveur MySQL${livre.revision ? ` · révision ${livre.revision}` : ''}` : livre.revision ? 'Enregistré localement' : 'Stockage local prêt'}</span><span className="hidden text-xs text-slate-500 dark:text-slate-400 lg:inline">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span>{session?.utilisateur ? <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.utilisateur.nomComplet}</p><p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{libelleRole(session.utilisateur.role)}</p></div><span className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title={session.utilisateur.nomComplet}>{initiales(session.utilisateur.nomComplet)}</span><button className="icon-button" aria-label="Changer mon mot de passe" title="Changer mon mot de passe" onClick={() => setMotDePasseOuvert(true)}><KeyRound size={16} /></button><button className="icon-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={deconnecter}><LogOut size={16} /></button></div> : <span className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="Caisse SALFA">CS</span>}</div>
        </div>
        <nav className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 sm:px-5 dark:border-slate-800" aria-label="Navigation principale">{navigation.map(n => <button key={n.id} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3.5 sm:py-2.5 sm:text-sm ${onglet === n.id ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/60 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`} aria-current={onglet === n.id ? 'page' : undefined} aria-label={n.label} onClick={() => setOnglet(n.id)}><n.icone size={16} /><span className="sm:hidden">{n.labelCourt}</span><span className="hidden sm:inline">{n.label}</span></button>)}</nav>
      </header>
      <main id="contenu" tabIndex={-1} className="mx-auto max-w-[1680px] space-y-5 px-4 pb-20 pt-6 outline-none sm:px-7 sm:pb-20 sm:pt-7">
        <div className="no-print flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{titrePage}</h1><p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{sousTitrePage}</p></div>{onglet === 'journal' && <div className="flex flex-wrap gap-2"><button type="button" className={`btn-secondary ${!afficherSynthese ? '!border-slate-300 dark:!border-slate-700' : ''}`} onClick={basculerSynthese} aria-expanded={afficherSynthese} aria-label={afficherSynthese ? 'Masquer la synthèse' : 'Afficher la synthèse'} title={afficherSynthese ? 'Masquer les cartes de synthèse' : 'Afficher les cartes de synthèse'}>{afficherSynthese ? <EyeOff size={16} /> : <Eye size={16} />}<span>{afficherSynthese ? 'Masquer la synthèse' : 'Afficher la synthèse'}</span></button><button className="btn-secondary" disabled={Boolean(erreur)} onClick={() => { try { exporterLivreCsv(lignes, { periode, soldeOuverture: ouverture, ...totauxSelection, soldeFin, selection: filtreActif }); setNotification('Export CSV téléchargé. Les montants détaillés ne sont pas comptés deux fois.'); } catch { setNotification('L’export a échoué. Réessayez ou utilisez la sauvegarde JSON.'); } }}><Download size={16} />Exporter CSV</button><button className="btn-secondary" disabled={Boolean(erreur)} onClick={() => window.print()}><Printer size={16} />Imprimer</button></div>}</div>
        {erreur && <div role="alert" className="no-print rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/40"><div className="flex items-start gap-3"><AlertTriangle size={22} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" /><div className="space-y-3"><p className="text-sm leading-relaxed text-rose-900 dark:text-rose-200">{erreur}</p><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={rechargerLivre}><RefreshCw size={15} />Recharger</button><button className="btn-secondary" onClick={() => setOnglet('donnees')}><Database size={15} />Données & sauvegardes</button></div></div></div></div>}
        {avertissement && !erreur && <div className="no-print flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{avertissement}</div>}
        {messageSync && !erreur && <div role="status" className="no-print flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"><RefreshCw size={18} className="shrink-0" />{messageSync}</div>}
        {aCloturer && !erreur && onglet !== 'exercices' && <div role="alert" className="no-print flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/80 dark:bg-amber-950/40"><div className="flex items-start gap-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200"><CalendarClock size={20} className="mt-0.5 shrink-0" /><div><p className="font-semibold">L’exercice {exercice} doit être clôturé.</p><p className="mt-1">La nouvelle année a commencé : les saisies restent bloquées sur l’exercice {exercice}. Clôturez-le pour ouvrir {exercice + 1} avec le solde reporté de {formatAr(soldeFinExercice)}.</p></div></div><button className="btn-primary" onClick={ouvrirCloture}><CalendarCheck size={16} />Clôturer l’exercice {exercice}</button></div>}

        {onglet === 'journal' && <>
          {!erreur && afficherSynthese && <Synthese soldeInitial={livre.parametres.soldeInitial} exercice={exercice} reportPrecedent={livre.parametres.reportPrecedent} cloturePossible={cloturePossible} onCloturer={ouvrirCloture} onSoldeInitial={changerSolde} peutModifierSolde={soldeModifiable} recettes={totauxPeriode.recettes} depenses={totauxPeriode.depenses} soldeFin={soldeFin} periode={periode} nombreEcritures={duMois.length} erreurExterne={erreur} />}
          <div className="no-print z-10 py-1 bg-slate-100/80 backdrop-blur-md dark:bg-slate-950/80 sm:sticky" style={{ top: hauteurEntete }}><section className="card space-y-3 p-4 border border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900" aria-label="Période, filtres et nouvelles écritures"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><button className="icon-button" aria-label="Mois précédent" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, -1))}><ChevronLeft size={16} /></button><input type="month" className="w-40 bg-transparent px-2 py-2 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200" aria-label="Mois affiché" value={mois} min="1900-01" max="9999-12" onChange={e => { if (e.target.value) { setMois(e.target.value); setToutAfficher(false); } }} /><button className="icon-button" aria-label="Mois suivant" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, 1))}><ChevronRight size={16} /></button></div><button className={`btn-secondary ${toutAfficher ? '!border-brand-700 !bg-brand-50 !text-brand-800 dark:!border-brand-500 dark:!bg-brand-950/80 dark:!text-brand-300' : ''}`} aria-pressed={toutAfficher} onClick={() => setToutAfficher(v => !v)}>Tout afficher</button>{derniereSupprimee && <button className="btn-secondary" onClick={annulerSuppression} disabled={Boolean(erreur)}><RotateCcw size={15} />Annuler la suppression</button>}</div>{saisieOuverte
              ? <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={Boolean(erreur)} onClick={() => setSaisie({ sens: 'RECETTE', edition: null })}><Plus size={16} />Nouvelle recette</button><button className="btn-danger" disabled={Boolean(erreur)} onClick={() => setSaisie({ sens: 'DEPENSE', edition: null })}><Plus size={16} />Nouvelle dépense</button></div>
              : <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">Consultation seule : votre rôle ne saisit pas d’écriture.</p>}</div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><div className="segmented" aria-label="Filtrer par type">{(['TOUS', 'RECETTE', 'DEPENSE'] as const).map(s => <button key={s} aria-pressed={filtres.sens === s} onClick={() => modifierFiltre('sens', s)}>{s === 'TOUS' ? 'Tous' : s === 'RECETTE' ? 'Recettes' : 'Dépenses'}</button>)}</div><select className="field !w-auto max-w-56 !py-2 !text-sm" aria-label="Filtrer par catégorie" value={filtres.categorie} onChange={e => modifierFiltre('categorie', e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><div className="relative min-w-44 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input type="search" className="field !py-2 !pl-9 !text-sm" aria-label="Rechercher dans le journal" placeholder="Rechercher une pièce, un libellé, un tiers…" value={filtres.recherche} onChange={e => modifierFiltre('recherche', e.target.value)} /></div>{filtreActif && <button className="icon-button" title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres" onClick={reinitialiser}><X size={16} /></button>}<span className="hidden items-center gap-1 text-xs text-slate-400 dark:text-slate-500 xl:flex"><SlidersHorizontal size={14} />{filtreActif ? 'Filtres actifs' : 'Aucun filtre'}</span></div>
          </section></div>
          {!erreur ? <LivreJournal key={cleEntete} lignes={lignes} soldeOuverture={ouverture} periode={periode} recettes={totauxSelection.recettes} depenses={totauxSelection.depenses} soldeFin={soldeFin} filtreActif={filtreActif} enEditionId={saisie?.edition?.id ?? null} onEditer={e => setSaisie({ sens: e.sens, edition: e })} onSupprimer={id => setASupprimer(livre.ecritures.find(e => e.id === id) ?? null)} onReinitialiser={reinitialiser} entetes={livre.entetes} onEnregistrerEntete={enregistrerEnteteDocument} onNouvelleEcriture={saisieOuverte ? sens => setSaisie({ sens, edition: null }) : undefined} ref={journalRef} /> : <section className="card p-12 text-center text-sm text-slate-500 dark:text-slate-400"><Database size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />Le livre n’est pas affiché tant que le stockage n’a pas été récupéré.</section>}
        </>}
        {onglet === 'analyse' && (erreur ? <p className="card p-8 text-sm text-slate-500 dark:text-slate-400">Récupérez le stockage pour afficher les statistiques.</p> : <><div className="no-print flex flex-wrap items-center gap-2"><div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><button className="icon-button" aria-label="Mois précédent" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, -1))}><ChevronLeft size={16} /></button><input type="month" className="w-40 bg-transparent px-2 py-2 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200" aria-label="Mois de l’analyse" min="1900-01" max="9999-12" value={mois} onChange={e => { if (e.target.value) { setMois(e.target.value); setToutAfficher(false); } }} /><button className="icon-button" aria-label="Mois suivant" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, 1))}><ChevronRight size={16} /></button></div><button className={`btn-secondary ${toutAfficher ? '!border-brand-700 !bg-brand-50 !text-brand-800 dark:!border-brand-500 dark:!bg-brand-950/80 dark:!text-brand-300' : ''}`} aria-pressed={toutAfficher} onClick={() => setToutAfficher(v => !v)}>Toutes périodes</button></div><Synthese soldeInitial={livre.parametres.soldeInitial} exercice={exercice} reportPrecedent={livre.parametres.reportPrecedent} cloturePossible={cloturePossible} onCloturer={ouvrirCloture} onSoldeInitial={changerSolde} peutModifierSolde={soldeModifiable} recettes={totauxPeriode.recettes} depenses={totauxPeriode.depenses} soldeFin={soldeFin} periode={periode} nombreEcritures={duMois.length} erreurExterne={erreur} /><Analyse lignes={duMois} periode={periode} /></>)}
        {onglet === 'exercices' && (erreur ? <p className="card p-8 text-sm text-slate-500 dark:text-slate-400">Récupérez le stockage pour consulter les exercices.</p> : <Exercices livre={livre} onCloturer={ouvrirCloture} onTelechargerArchive={telechargerArchive} />)}
        {onglet === 'donnees' && <DonneesSauvegardes livre={livre} administrateur={administre} erreur={erreur} onRestaurer={restaurerLivre} onRecharger={rechargerLivre} />}
        {onglet === 'administration' && (administre
          ? <Administration
            nombreModeles={livre.masques.length}
            onOuvrirModeles={() => setMasquesOuverts(true)}
            onOuvrirCategories={() => setCategoriesOuvertes(true)}
            onOuvrirEntete={() => setEnteteOuverte(true)}
            compteCourant={session?.utilisateur ? { identifiant: session.utilisateur.identifiant } : null}
          />
          : <section className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400"><ShieldCheck size={30} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />Cette page est réservée à l’administrateur.</section>)}
        <footer className="no-print flex flex-wrap items-center justify-between gap-2 pb-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <p className="flex flex-wrap items-center gap-1.5">
            CAISSE SALFA
            <span className="badge badge-neutral !px-1.5 !py-0 font-mono text-[10px] tabular-nums" title={`Version de l’application : ${VERSION_APPLICATION}`}>v{VERSION_APPLICATION}</span>
            · Montants en ariary (MGA) · Exercice {exercice}
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={14} />
            {MODE_API
              ? `Données MySQL sur le serveur WAMP${versionApi ? ` · API ${versionApi}` : ''} — sauvegarde hebdomadaire conseillée.`
              : 'Données locales — pensez à sauvegarder après chaque session.'}
          </p>
          {MODE_API && versionApi && versionApi !== VERSION_APPLICATION && <p role="alert" className="flex w-full items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle size={13} className="shrink-0" />
            Paquet incomplet : l’API {versionApi} ne correspond pas à l’interface {VERSION_APPLICATION}. Recopiez index.html, assets/ et api/ depuis le même paquet.
          </p>}
        </footer>
      </main>
    </div>

    {saisie && <SaisieEcriture key={saisie.edition?.id ?? `nouveau-${saisie.sens}`} ecritureEnEdition={saisie.edition} sensInitial={saisie.sens} exercice={exercice} numeroSuivant={(sens, date) => Number(date.slice(0, 4)) === exercice ? prochainNumero(livre, sens, date) : null} suggestionsLibelle={suggestionsLibelle} suggestionsTiers={suggestionsTiers} masques={livre.masques} categories={livre.categories} onOuvrirGestionCategories={() => setCategoriesOuvertes(true)} erreurExterne={erreur} onOuvrirGestionMasques={() => setMasquesOuverts(true)} onEnregistrer={enregistrer} onFermer={() => setSaisie(null)} />}
    {categoriesOuvertes && <GestionCategoriesModal categories={livre.categories} erreurExterne={erreur} onEnregistrer={enregistrerCategoriesSaisie} onFermer={() => setCategoriesOuvertes(false)} />}
    {enteteOuverte && <EnteteBordereauModal
      entetes={livre.entetes}
      onEnregistrer={entete => { void enregistrerEnteteDocument(entete); setEnteteOuverte(false); }}
      onFermer={() => setEnteteOuverte(false)}
    />}
    {motDePasseOuvert && session?.utilisateur && <ChangerMotDePasse
      utilisateur={session.utilisateur.identifiant}
      onFermer={() => setMotDePasseOuvert(false)}
      onFait={message => { setMotDePasseOuvert(false); setNotification(message); }}
    />}
    {masquesOuverts && <GestionMasquesModal masques={livre.masques} erreurExterne={erreur} onSauvegarderMasques={m => MODE_API ? muterEnLigne(revision => mutations.masques(revision, m)) : Promise.resolve(muter(d => enregistrerMasques(d, m)))} onFermer={() => setMasquesOuverts(false)} />}
    {clotureOuverte && <Confirmation titre={`Clôturer l’exercice ${exercice} ?`} libelleConfirmer={`Clôturer ${exercice} et ouvrir ${exercice + 1}`} onAnnuler={() => setClotureOuverte(false)} onConfirmer={confirmerCloture}>
      <p className="mb-4">La clôture fige définitivement les {livre.ecritures.length} écriture(s) de {exercice} dans une archive. Le livre repart à zéro pour {exercice + 1} avec le solde reporté, et les écritures de l’année ne peuvent plus être modifiées.</p>
      <dl className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"><div className="flex justify-between gap-3"><dt>Solde d’ouverture {exercice}</dt><dd className="tabular-nums">{formatAr(livre.parametres.soldeInitial)}</dd></div><div className="flex justify-between gap-3"><dt>Recettes de l’exercice</dt><dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatAr(totaliser(livre.ecritures).recettes)}</dd></div><div className="flex justify-between gap-3"><dt>Dépenses de l’exercice</dt><dd className="tabular-nums text-rose-700 dark:text-rose-400">{formatAr(totaliser(livre.ecritures).depenses)}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold dark:border-slate-700"><dt>Solde reporté sur {exercice + 1}</dt><dd className="tabular-nums">{formatAr(soldeFinExercice)}</dd></div></dl>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">Une sauvegarde JSON complète est téléchargée avant la clôture. L’archive peut aussi être exportée séparément depuis l’onglet Exercices.</p>
    </Confirmation>}
    {aSupprimer && <Confirmation titre="Supprimer cette écriture ?" danger libelleConfirmer="Supprimer l’écriture" onAnnuler={() => setASupprimer(null)} onConfirmer={confirmerSuppression}><p className="mb-4">Cette opération retire la pièce du livre et recalcule les soldes. Vous pourrez annuler la dernière suppression depuis le journal.</p><dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"><div className="flex justify-between gap-3"><dt>Numéro</dt><dd className="font-mono font-semibold">{aSupprimer.numero}</dd></div><div className="flex justify-between gap-3"><dt>Date</dt><dd>{dateFr(aSupprimer.date)}</dd></div><div className="flex justify-between gap-3"><dt>Libellé</dt><dd className="max-w-52 break-words text-right font-semibold">{aSupprimer.libelle}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-700"><dt>Montant</dt><dd className={`font-bold ${aSupprimer.sens === 'RECETTE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatAr(aSupprimer.montant)}</dd></div></dl>{erreur && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-400">{erreur}</p>}</Confirmation>}
    {notification && <div role="status" aria-live="polite" className="no-print fixed bottom-20 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:max-w-md"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"><Check size={16} /></span><div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200"><p>{notification}</p>{derniereSupprimee && <button className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-400" onClick={annulerSuppression}><RotateCcw size={13} />Annuler la suppression</button>}</div><button className="icon-button -mr-1 -mt-1" aria-label="Fermer la notification" onClick={() => setNotification('')}><X size={15} /></button></div>}
    <ControlesFlottants />
  </div>;
}
function initiales(nom: string): string {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map(m => m[0]?.toUpperCase() ?? '').join('') || 'CS';
}

export default App;

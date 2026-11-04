import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CalendarCheck, CalendarClock, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Database, Download, HeartPulse, Layers, Plus, Printer, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import type { Ecriture, FiltresJournal, Sens } from './types';
import { useLivre } from './hooks/useLivre';
import { calculerJournal, changerSoldeInitial, clotureAutorisee, cloturerExercice, enregistrerEcriture, enregistrerMasques, filtrerJournal, prochainNumero, restaurerEcriture, soldeCloture, soldeOuverture, supprimerEcriture, totaliser } from './utils/ledger';
import { anneeCourante, dateFr, decalerMois, formatAr, libelleMois, moisCourant } from './utils/format';
import { CATEGORIES_DEPENSE, CATEGORIES_RECETTE } from './utils/constants';
import { exporterLivreCsv } from './utils/export';
import { exporterArchiveExercice, exporterSauvegarde, exporterSecours } from './utils/backup';
import { Synthese } from './components/Synthese';
import { LivreJournal } from './components/LivreJournal';
import { SaisieEcriture } from './components/SaisieEcriture';
import { GestionMasquesModal } from './components/GestionMasquesModal';
import { Analyse } from './components/Analyse';
import { DonneesSauvegardes } from './components/DonneesSauvegardes';
import { Confirmation } from './components/Confirmation';
import { Exercices } from './components/Exercices';

type Onglet = 'journal' | 'analyse' | 'exercices' | 'donnees';

export function App() {
  const { livre, erreur, avertissement, messageSync, muter, recharger, restaurer } = useLivre();
  const [onglet, setOnglet] = useState<Onglet>('journal');
  const [mois, setMois] = useState(() => {
    const es = livre.ecritures;
    return es.length && !es.some(e => e.date.startsWith(moisCourant())) ? [...es].sort((a, b) => a.date.localeCompare(b.date))[es.length - 1].date.slice(0, 7) : moisCourant();
  });
  const [filtres, setFiltres] = useState<Omit<FiltresJournal, 'mois' | 'toutAfficher'>>({ sens: 'TOUS', categorie: '', recherche: '' });
  const [toutAfficher, setToutAfficher] = useState(false);
  const [saisie, setSaisie] = useState<{ sens: Sens; edition: Ecriture | null } | null>(null);
  const [masquesOuverts, setMasquesOuverts] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Ecriture | null>(null);
  const [derniereSupprimee, setDerniereSupprimee] = useState<Ecriture | null>(null);
  const [notification, setNotification] = useState('');
  const [clotureOuverte, setClotureOuverte] = useState(false);

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
  const categories = [...new Set([...CATEGORIES_RECETTE, ...CATEGORIES_DEPENSE, ...livre.ecritures.map(e => e.categorie)])];
  const modifierFiltre = (champ: keyof typeof filtres, valeur: string) => setFiltres(f => ({ ...f, [champ]: valeur }));
  const reinitialiser = () => setFiltres({ sens: 'TOUS', categorie: '', recherche: '' });

  function enregistrer(ecriture: Ecriture) {
    const edition = livre.ecritures.some(e => e.id === ecriture.id);
    if (!muter(d => enregistrerEcriture(d, ecriture))) return false;
    setSaisie(null); setDerniereSupprimee(null); setMois(ecriture.date.slice(0, 7)); setToutAfficher(false); reinitialiser();
    setNotification(edition ? 'Modification enregistrée. Les soldes ont été recalculés.' : 'Écriture enregistrée avec son numéro définitif.');
    return true;
  }
  function confirmerSuppression() {
    if (!aSupprimer) return;
    const cible = aSupprimer;
    if (muter(d => supprimerEcriture(d, cible.id))) {
      setASupprimer(null); setDerniereSupprimee(cible);
      setNotification(`Écriture ${cible.numero} supprimée. Vous pouvez annuler cette suppression.`);
    }
  }
  function annulerSuppression() {
    if (!derniereSupprimee) return;
    if (muter(d => restaurerEcriture(d, derniereSupprimee))) {
      setNotification(`Écriture ${derniereSupprimee.numero} restaurée.`); setDerniereSupprimee(null);
    }
  }
  function restaurerLivre(importe: Parameters<typeof restaurer>[0]) {
    try {
      if (erreur) exporterSecours(); else exporterSauvegarde(livre);
      restaurer(importe);
      setDerniereSupprimee(null); setSaisie(null); setASupprimer(null); reinitialiser(); setToutAfficher(true);
      setNotification('Sauvegarde restaurée et enregistrée localement.');
      return true;
    } catch { return false; }
  }
  function ouvrirCloture() {
    if (!cloturePossible) {
      setNotification(`L’exercice ${exercice} ne peut être clôturé qu’à partir du 1er janvier ${exercice + 1}. Continuez la saisie jusqu’à la fin de l’année.`);
      return;
    }
    setClotureOuverte(true);
  }
  function confirmerCloture() {
    const annee = exercice;
    // Double garde : aucune clôture d'une année encore en cours, même si le dialogue était forcé.
    if (!cloturePossible) { setClotureOuverte(false); return false; }
    const archive = cloturerExercice(livre, new Date().toISOString()).exercicesClotures.find(c => c.annee === annee);
    try { exporterSauvegarde(livre, `avant_cloture_${annee}`); }
    catch { setNotification('La clôture est annulée : la sauvegarde préalable a échoué. Exportez le livre puis réessayez.'); return false; }
    if (!muter(d => cloturerExercice(d))) return false;
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
  function rechargerLivre() {
    if (recharger()) { setDerniereSupprimee(null); setNotification('Livre rechargé depuis le stockage local.'); }
  }

  const navigation = [
    { id: 'journal' as const, label: 'Livre journal', labelCourt: 'Journal', icone: BookOpen },
    { id: 'analyse' as const, label: 'Analyse de la caisse', labelCourt: 'Analyse', icone: ChartNoAxesCombined },
    { id: 'exercices' as const, label: 'Exercices & clôtures', labelCourt: 'Exercices', icone: CalendarCheck },
    { id: 'donnees' as const, label: 'Données & sauvegardes', labelCourt: 'Données', icone: Database },
  ];
  const titrePage = onglet === 'journal' ? 'Livre de caisse' : onglet === 'analyse' ? 'Analyse de la caisse' : onglet === 'exercices' ? 'Exercices & clôtures' : 'Données & sauvegardes';
  const sousTitrePage = onglet === 'journal' ? 'Chaque mouvement compte. Gardez une trace claire de votre trésorerie.' : onglet === 'analyse' ? 'Comprenez vos recettes et vos dépenses, période par période.' : onglet === 'exercices' ? 'La caisse se clôture chaque année : l’exercice en cours reste court, les précédents sont archivés.' : 'Protégez votre historique et gardez la maîtrise de vos données.';

  return <div className="app-shell min-h-screen">
    <div>
      <header id="entete" className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"><HeartPulse size={23} strokeWidth={2} /></span>
            <div><p className="text-lg font-extrabold tracking-tight text-brand-950">SALFA</p><p className="text-[10px] tracking-[0.16em] text-slate-400">GESTION DE CAISSE</p></div>
            <div className="ml-2 hidden border-l border-slate-200 pl-4 sm:block"><p className="text-[11px] text-slate-400">Caisse principale</p><p className="mt-0.5 text-xs font-medium text-slate-600">Exercice {exercice}</p></div>
          </div>
          <div className="flex items-center gap-3"><span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium md:inline-flex ${erreur ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}><span className={`size-1.5 rounded-full ${erreur ? 'bg-rose-500' : 'bg-emerald-500'}`} />{erreur ? 'Stockage à vérifier' : livre.revision ? 'Enregistré localement' : 'Stockage local prêt'}</span><span className="hidden text-[11px] text-slate-500 lg:inline">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><span className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600" title="Caisse SALFA">CS</span></div>
        </div>
        <nav className="flex flex-wrap gap-1 border-t border-slate-100 px-3 py-2 sm:px-5" aria-label="Navigation principale">{navigation.map(n => <button key={n.id} className={`flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs ${onglet === n.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`} aria-current={onglet === n.id ? 'page' : undefined} aria-label={n.label} onClick={() => setOnglet(n.id)}><n.icone size={15} /><span className="sm:hidden">{n.labelCourt}</span><span className="hidden sm:inline">{n.label}</span></button>)}<button className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs" aria-label="Modèles de saisie" onClick={() => setMasquesOuverts(true)} disabled={Boolean(erreur)}><Layers size={15} /><span className="sm:hidden">Modèles</span><span className="hidden sm:inline">Modèles de saisie</span></button></nav>
      </header>
      <main className="mx-auto max-w-[1680px] space-y-5 px-4 py-6 sm:px-7 sm:py-7">
        <div className="no-print flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{titrePage}</h1><p className="mt-1.5 text-xs leading-relaxed text-slate-500">{sousTitrePage}</p></div>{onglet === 'journal' && <div className="flex gap-2"><button className="btn-secondary" disabled={Boolean(erreur)} onClick={() => { try { exporterLivreCsv(lignes, { periode, soldeOuverture: ouverture, ...totauxSelection, soldeFin, selection: filtreActif }); setNotification('Export CSV téléchargé. Les montants détaillés ne sont pas comptés deux fois.'); } catch { setNotification('L’export a échoué. Réessayez ou utilisez la sauvegarde JSON.'); } }}><Download size={15} />Exporter CSV</button><button className="btn-secondary" disabled={Boolean(erreur)} onClick={() => window.print()}><Printer size={15} />Imprimer</button></div>}</div>
        {erreur && <div role="alert" className="no-print rounded-xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600" /><div className="space-y-3"><p className="text-xs leading-relaxed text-rose-900">{erreur}</p><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={rechargerLivre}><RefreshCw size={14} />Recharger</button><button className="btn-secondary" onClick={() => setOnglet('donnees')}><Database size={14} />Données & sauvegardes</button></div></div></div></div>}
        {avertissement && !erreur && <div className="no-print flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{avertissement}</div>}
        {messageSync && !erreur && <div role="status" className="no-print flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"><RefreshCw size={16} className="shrink-0" />{messageSync}</div>}
        {aCloturer && !erreur && onglet !== 'exercices' && <div role="alert" className="no-print flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-2 text-xs leading-relaxed text-amber-900"><CalendarClock size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">L’exercice {exercice} doit être clôturé.</p><p className="mt-1">La nouvelle année a commencé : les saisies restent bloquées sur l’exercice {exercice}. Clôturez-le pour ouvrir {exercice + 1} avec le solde reporté de {formatAr(soldeFinExercice)}.</p></div></div><button className="btn-primary" onClick={ouvrirCloture}><CalendarCheck size={15} />Clôturer l’exercice {exercice}</button></div>}

        {onglet === 'journal' && <>
          {!erreur && <Synthese soldeInitial={livre.parametres.soldeInitial} exercice={exercice} reportPrecedent={livre.parametres.reportPrecedent} cloturePossible={cloturePossible} onCloturer={ouvrirCloture} onSoldeInitial={v => muter(d => changerSoldeInitial(d, v))} recettes={totauxPeriode.recettes} depenses={totauxPeriode.depenses} soldeFin={soldeFin} periode={periode} nombreEcritures={duMois.length} erreurExterne={erreur} />}
          <section className="no-print card space-y-3 p-4" aria-label="Période, filtres et nouvelles écritures"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><div className="flex items-center rounded-lg border border-slate-200 bg-white"><button className="icon-button" aria-label="Mois précédent" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, -1))}><ChevronLeft size={16} /></button><input type="month" className="w-36 bg-transparent px-1 py-2 text-xs font-semibold text-slate-700 outline-none" aria-label="Mois affiché" value={mois} min="1900-01" max="9999-12" onChange={e => { if (e.target.value) { setMois(e.target.value); setToutAfficher(false); } }} /><button className="icon-button" aria-label="Mois suivant" disabled={toutAfficher} onClick={() => setMois(decalerMois(mois, 1))}><ChevronRight size={16} /></button></div><button className={`btn-secondary ${toutAfficher ? '!border-brand-700 !bg-brand-50 !text-brand-800' : ''}`} aria-pressed={toutAfficher} onClick={() => setToutAfficher(v => !v)}>Tout afficher</button>{derniereSupprimee && <button className="btn-secondary" onClick={annulerSuppression} disabled={Boolean(erreur)}><RotateCcw size={14} />Annuler la suppression</button>}</div><div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={Boolean(erreur)} onClick={() => setSaisie({ sens: 'RECETTE', edition: null })}><Plus size={16} />Nouvelle recette</button><button className="btn-danger" disabled={Boolean(erreur)} onClick={() => setSaisie({ sens: 'DEPENSE', edition: null })}><Plus size={16} />Nouvelle dépense</button></div></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"><div className="segmented" aria-label="Filtrer par type">{(['TOUS', 'RECETTE', 'DEPENSE'] as const).map(s => <button key={s} aria-pressed={filtres.sens === s} onClick={() => modifierFiltre('sens', s)}>{s === 'TOUS' ? 'Tous' : s === 'RECETTE' ? 'Recettes' : 'Dépenses'}</button>)}</div><select className="field !w-auto max-w-48 !py-2 !text-xs" aria-label="Filtrer par catégorie" value={filtres.categorie} onChange={e => modifierFiltre('categorie', e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><div className="relative min-w-44 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" /><input type="search" className="field !py-2 !pl-9 !text-xs" aria-label="Rechercher dans le journal" placeholder="Rechercher une pièce, un libellé, un tiers…" value={filtres.recherche} onChange={e => modifierFiltre('recherche', e.target.value)} /></div>{filtreActif && <button className="icon-button" title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres" onClick={reinitialiser}><X size={16} /></button>}<span className="hidden items-center gap-1 text-[10px] text-slate-400 xl:flex"><SlidersHorizontal size={13} />{filtreActif ? 'Filtres actifs' : 'Aucun filtre'}</span></div>
          </section>
          {!erreur ? <LivreJournal lignes={lignes} soldeOuverture={ouverture} periode={periode} recettes={totauxSelection.recettes} depenses={totauxSelection.depenses} soldeFin={soldeFin} filtreActif={filtreActif} enEditionId={saisie?.edition?.id ?? null} onEditer={e => setSaisie({ sens: e.sens, edition: e })} onSupprimer={id => setASupprimer(livre.ecritures.find(e => e.id === id) ?? null)} onReinitialiser={reinitialiser} /> : <section className="card p-12 text-center text-sm text-slate-500"><Database size={32} className="mx-auto mb-3 text-slate-300" />Le livre n’est pas affiché tant que le stockage n’a pas été récupéré.</section>}
        </>}
        {onglet === 'analyse' && (erreur ? <p className="card p-8 text-sm text-slate-500">Récupérez le stockage pour afficher les statistiques.</p> : <><div className="no-print flex flex-wrap items-center gap-2"><input type="month" className="field !w-44" aria-label="Mois de l’analyse" value={mois} onChange={e => { if (e.target.value) { setMois(e.target.value); setToutAfficher(false); } }} /><button className="btn-secondary" aria-pressed={toutAfficher} onClick={() => setToutAfficher(v => !v)}>Toutes périodes</button></div><Synthese soldeInitial={livre.parametres.soldeInitial} exercice={exercice} reportPrecedent={livre.parametres.reportPrecedent} cloturePossible={cloturePossible} onCloturer={ouvrirCloture} onSoldeInitial={v => muter(d => changerSoldeInitial(d, v))} recettes={totauxPeriode.recettes} depenses={totauxPeriode.depenses} soldeFin={soldeFin} periode={periode} nombreEcritures={duMois.length} erreurExterne={erreur} /><Analyse lignes={duMois} periode={periode} /></>)}
        {onglet === 'exercices' && (erreur ? <p className="card p-8 text-sm text-slate-500">Récupérez le stockage pour consulter les exercices.</p> : <Exercices livre={livre} onCloturer={ouvrirCloture} onTelechargerArchive={telechargerArchive} />)}
        {onglet === 'donnees' && <DonneesSauvegardes livre={livre} erreur={erreur} onRestaurer={restaurerLivre} onRecharger={rechargerLivre} />}
        <footer className="no-print flex flex-wrap items-center justify-between gap-2 pb-2 pt-2 text-[10px] text-slate-400"><p>CAISSE SALFA · Montants en ariary (MGA) · Exercice {exercice}</p><p className="flex items-center gap-1"><ShieldCheck size={12} />Données locales — pensez à sauvegarder après chaque session.</p></footer>
      </main>
    </div>

    {saisie && <SaisieEcriture key={saisie.edition?.id ?? `nouveau-${saisie.sens}`} ecritureEnEdition={saisie.edition} sensInitial={saisie.sens} exercice={exercice} numeroSuivant={(sens, date) => Number(date.slice(0, 4)) === exercice ? prochainNumero(livre, sens, date) : null} suggestionsLibelle={suggestionsLibelle} suggestionsTiers={suggestionsTiers} masques={livre.masques} erreurExterne={erreur} onOuvrirGestionMasques={() => setMasquesOuverts(true)} onEnregistrer={enregistrer} onFermer={() => setSaisie(null)} />}
    {masquesOuverts && <GestionMasquesModal masques={livre.masques} erreurExterne={erreur} onSauvegarderMasques={m => muter(d => enregistrerMasques(d, m))} onFermer={() => setMasquesOuverts(false)} />}
    {clotureOuverte && <Confirmation titre={`Clôturer l’exercice ${exercice} ?`} libelleConfirmer={`Clôturer ${exercice} et ouvrir ${exercice + 1}`} onAnnuler={() => setClotureOuverte(false)} onConfirmer={confirmerCloture}>
      <p className="mb-4">La clôture fige définitivement les {livre.ecritures.length} écriture(s) de {exercice} dans une archive. Le livre repart à zéro pour {exercice + 1} avec le solde reporté, et les écritures de l’année ne peuvent plus être modifiées.</p>
      <dl className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><dt>Solde d’ouverture {exercice}</dt><dd className="tabular-nums">{formatAr(livre.parametres.soldeInitial)}</dd></div><div className="flex justify-between gap-3"><dt>Recettes de l’exercice</dt><dd className="tabular-nums text-emerald-700">{formatAr(totaliser(livre.ecritures).recettes)}</dd></div><div className="flex justify-between gap-3"><dt>Dépenses de l’exercice</dt><dd className="tabular-nums text-rose-700">{formatAr(totaliser(livre.ecritures).depenses)}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold"><dt>Solde reporté sur {exercice + 1}</dt><dd className="tabular-nums">{formatAr(soldeFinExercice)}</dd></div></dl>
      <p className="text-xs leading-relaxed text-slate-600">Une sauvegarde JSON complète est téléchargée avant la clôture. L’archive peut aussi être exportée séparément depuis l’onglet Exercices.</p>
    </Confirmation>}
    {aSupprimer && <Confirmation titre="Supprimer cette écriture ?" danger libelleConfirmer="Supprimer l’écriture" onAnnuler={() => setASupprimer(null)} onConfirmer={confirmerSuppression}><p className="mb-4">Cette opération retire la pièce du livre et recalcule les soldes. Vous pourrez annuler la dernière suppression depuis le journal.</p><dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><dt>Numéro</dt><dd className="font-mono font-semibold">{aSupprimer.numero}</dd></div><div className="flex justify-between gap-3"><dt>Date</dt><dd>{dateFr(aSupprimer.date)}</dd></div><div className="flex justify-between gap-3"><dt>Libellé</dt><dd className="max-w-52 break-words text-right font-semibold">{aSupprimer.libelle}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt>Montant</dt><dd className={`font-bold ${aSupprimer.sens === 'RECETTE' ? 'text-emerald-700' : 'text-rose-700'}`}>{formatAr(aSupprimer.montant)}</dd></div></dl>{erreur && <p role="alert" className="mt-3 text-xs text-rose-700">{erreur}</p>}</Confirmation>}
    {notification && <div role="status" className="no-print fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:max-w-md"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Check size={16} /></span><div className="text-xs leading-relaxed text-slate-700"><p>{notification}</p>{derniereSupprimee && <button className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" onClick={annulerSuppression}><RotateCcw size={13} />Annuler la suppression</button>}</div><button className="icon-button -mr-1 -mt-1" aria-label="Fermer la notification" onClick={() => setNotification('')}><X size={15} /></button></div>}
  </div>;
}
export default App;

import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Wallet, Landmark, Pencil, Save } from 'lucide-react';
import { formatAr, parserMontant } from '../utils/format';
import { formaterSaisieMontant } from './ChampMontant';
import { Modale } from './Modale';

interface SyntheseProps {
  soldeInitial: number;
  exercice: number;
  exerciceOuvert?: number;
  exercicesDisponibles?: Array<{ annee: number; cloture: boolean }>;
  onChangerExercice?: (annee: number) => void;
  reportPrecedent: { annee: number; solde: number } | null;
  /** La clôture n'est proposée qu'une fois l'année révolue. */
  cloturePossible: boolean;
  onCloturer: () => void;
  onSoldeInitial: (montant: number) => boolean | Promise<boolean>;
  /** Seul l'administrateur corrige le solde d'ouverture. */
  peutModifierSolde?: boolean;
  recettes: number;
  depenses: number;
  soldeFin: number;
  periode: string;
  nombreEcritures: number;
  erreurExterne?: string | null;
}

export function Synthese({ soldeInitial, exercice, exerciceOuvert, exercicesDisponibles, onChangerExercice, reportPrecedent, cloturePossible, onCloturer, onSoldeInitial, peutModifierSolde = false, recettes, depenses, soldeFin, periode, nombreEcritures, erreurExterne }: SyntheseProps) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const id = useId();
  const net = recettes - depenses;
  const enArchive = exerciceOuvert !== undefined && exercice !== exerciceOuvert;
  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const montant = parserMontant(valeur, true);
    if (montant === null) { setErreur('Saisissez un montant entier en ariary ; un solde négatif est autorisé.'); return; }
    setEnCours(true);
    try {
      if (await onSoldeInitial(montant)) { setEdition(false); setErreur(''); }
      else setErreur('Le solde n’a pas été enregistré.');
    } finally { setEnCours(false); }
  }
  return <>
    <section className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Synthèse de ${periode}`}>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Recettes de la période</span><span className="summary-icon bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"><ArrowDownLeft size={19} /></span></div><p className="summary-value text-emerald-700 dark:text-emerald-400">{formatAr(recettes)}</p><p className="summary-note">Encaissements · {periode}</p></article>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Dépenses de la période</span><span className="summary-icon bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"><ArrowUpRight size={19} /></span></div><p className="summary-value text-rose-700 dark:text-rose-400">{formatAr(depenses)}</p><p className="summary-note">Décaissements · {periode}</p></article>
      <article className="summary-card border-brand-200/80 bg-brand-50/40 dark:border-brand-900/60 dark:bg-brand-950/40"><div className="flex items-center justify-between"><span className="summary-label">Solde en fin de période</span><span className="summary-icon bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"><Wallet size={19} /></span></div><p className={`summary-value ${soldeFin < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-brand-900 dark:text-brand-200'}`}>{formatAr(soldeFin)}</p><p className="summary-note">{nombreEcritures} écriture(s) · mouvement net <span className={net < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>{net > 0 ? '+' : ''}{formatAr(net)}</span></p></article>
      <article className="summary-card"><div className="flex items-center justify-between gap-2">
          {peutModifierSolde && exercicesDisponibles && exercicesDisponibles.length > 1 && onChangerExercice
            ? <div className="flex flex-wrap items-center gap-1.5">
                <span className="summary-label">Solde d’ouverture ·</span>
                <select
                  aria-label="Sélectionner l’exercice"
                  value={exercice}
                  onChange={e => onChangerExercice(Number(e.target.value))}
                  className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-brand-800 outline-none hover:border-brand-400 focus:border-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-300"
                >
                  {exercicesDisponibles.map(ex => <option key={ex.annee} value={ex.annee}>exercice {ex.annee}{ex.cloture ? ' (clôturé)' : ''}</option>)}
                </select>
              </div>
            : <span className="summary-label">Solde d’ouverture · exercice {exercice}</span>}
          <span className="summary-icon bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"><Landmark size={19} /></span></div><div className="flex items-center justify-between gap-2"><p className="summary-value">{formatAr(soldeInitial)}</p>
          {enArchive
            ? <span className="badge badge-neutral" title="Exercice clôturé en consultation">Clôturé</span>
            : peutModifierSolde
              ? <button className="icon-button" aria-label="Modifier le solde d’ouverture du livre" title="Modifier le solde initial" onClick={() => { setValeur(formaterSaisieMontant(String(soldeInitial), true)); setErreur(''); setEdition(true); }}><Pencil size={15} /></button>
              : <span className="badge badge-neutral" title="Seul l’administrateur modifie le solde d’ouverture">Lecture seule</span>}</div><p className="summary-note">{enArchive ? `Solde d’ouverture archivé de l’exercice ${exercice}` : reportPrecedent ? `Report de la clôture ${reportPrecedent.annee} : ${formatAr(reportPrecedent.solde)}` : 'Report antérieur à l’historique conservé'}</p>
        {!enArchive && cloturePossible && peutModifierSolde && <button className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 hover:underline sm:text-sm" onClick={onCloturer}><CalendarCheck size={14} />Clôturer l’exercice {exercice}</button>}</article>
    </section>
    {edition && <Modale titre="Solde d’ouverture du livre" sousTitre="Ce montant sert de point de départ à tous les calculs." icone={<Landmark size={22} />} largeur="petite" onFermer={() => setEdition(false)} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdition(false)}>Annuler</button><button className="btn-primary" type="submit" form={id} disabled={enCours}><Save size={16} />{enCours ? 'Enregistrement…' : 'Enregistrer'}</button></div>}><form id={id} onSubmit={enregistrer} className="space-y-4"><div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3.5 text-sm leading-relaxed text-amber-900 dark:text-amber-200">Il s’agit du solde précédant la première écriture du livre, et non du solde d’ouverture du mois affiché. Le modifier recalcule tous les soldes. Les écritures ne changent pas.</div><div><label className="label" htmlFor={id}>Solde initial (Ar)</label><input id={id} className="field text-xl font-bold tabular-nums" inputMode="numeric" value={valeur} onChange={e => setValeur(formaterSaisieMontant(e.target.value, true))} autoFocus required /><p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]">Entier uniquement. Vous pouvez saisir un montant négatif, par exemple -50000.</p></div>{(erreur || erreurExterne) && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{erreur} {erreurExterne}</p>}</form></Modale>}
  </>;
}

import { useId, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Wallet, Landmark, Pencil, Save } from 'lucide-react';
import { formatAr, parserMontant } from '../utils/format';
import { Modale } from './Modale';

interface SyntheseProps {
  soldeInitial: number;
  exercice: number;
  reportPrecedent: { annee: number; solde: number } | null;
  onCloturer: () => void;
  onSoldeInitial: (montant: number) => boolean;
  recettes: number;
  depenses: number;
  soldeFin: number;
  periode: string;
  nombreEcritures: number;
  erreurExterne?: string | null;
}

export function Synthese({ soldeInitial, exercice, reportPrecedent, onCloturer, onSoldeInitial, recettes, depenses, soldeFin, periode, nombreEcritures, erreurExterne }: SyntheseProps) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState('');
  const id = useId();
  const net = recettes - depenses;
  function enregistrer(e: FormEvent) {
    e.preventDefault();
    const montant = parserMontant(valeur, true);
    if (montant === null) { setErreur('Saisissez un montant entier en ariary ; un solde négatif est autorisé.'); return; }
    if (onSoldeInitial(montant)) { setEdition(false); setErreur(''); }
    else setErreur('Le solde n’a pas été enregistré.');
  }
  return <>
    <section className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Synthèse de ${periode}`}>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Recettes de la période</span><span className="summary-icon bg-emerald-50 text-emerald-600"><ArrowDownLeft size={19} /></span></div><p className="summary-value text-emerald-700">{formatAr(recettes)}</p><p className="summary-note">Encaissements · {periode}</p></article>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Dépenses de la période</span><span className="summary-icon bg-rose-50 text-rose-600"><ArrowUpRight size={19} /></span></div><p className="summary-value text-rose-700">{formatAr(depenses)}</p><p className="summary-note">Décaissements · {periode}</p></article>
      <article className="summary-card border-brand-200/80 bg-brand-50/40"><div className="flex items-center justify-between"><span className="summary-label">Solde de clôture</span><span className="summary-icon bg-brand-100 text-brand-700"><Wallet size={19} /></span></div><p className={`summary-value ${soldeFin < 0 ? 'text-rose-700' : 'text-brand-900'}`}>{formatAr(soldeFin)}</p><p className="summary-note">{nombreEcritures} écriture(s) · mouvement net <span className={net < 0 ? 'text-rose-700' : 'text-emerald-700'}>{net > 0 ? '+' : ''}{formatAr(net)}</span></p></article>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Solde d’ouverture · exercice {exercice}</span><span className="summary-icon bg-slate-100 text-slate-500"><Landmark size={19} /></span></div><div className="flex items-center justify-between gap-2"><p className="summary-value">{formatAr(soldeInitial)}</p><button className="icon-button" aria-label="Modifier le solde d’ouverture du livre" title="Modifier le solde initial" onClick={() => { setValeur(String(soldeInitial)); setErreur(''); setEdition(true); }}><Pencil size={15} /></button></div><p className="summary-note">{reportPrecedent ? `Report de la clôture ${reportPrecedent.annee} : ${formatAr(reportPrecedent.solde)}` : 'Report antérieur à l’historique conservé'}</p>
        <button className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:underline" onClick={onCloturer}><CalendarCheck size={13} />Clôturer l’exercice {exercice}</button></article>
    </section>
    {edition && <Modale titre="Solde d’ouverture du livre" sousTitre="Ce montant sert de point de départ à tous les calculs." icone={<Landmark size={21} />} largeur="petite" onFermer={() => setEdition(false)} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdition(false)}>Annuler</button><button className="btn-primary" type="submit" form={id}><Save size={16} />Enregistrer</button></div>}><form id={id} onSubmit={enregistrer} className="space-y-4"><div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Il s’agit du solde précédant la première écriture du livre, et non du solde d’ouverture du mois affiché. Le modifier recalcule tous les soldes. Les écritures ne changent pas.</div><div><label className="label" htmlFor={id}>Solde initial (Ar)</label><input id={id} className="field text-lg font-semibold tabular-nums" inputMode="numeric" value={valeur} onChange={e => setValeur(e.target.value)} autoFocus required /><p className="mt-1 text-[11px] text-slate-500">Entier uniquement. Vous pouvez saisir un montant négatif, par exemple -50000.</p></div>{(erreur || erreurExterne) && <p role="alert" className="text-xs text-rose-700">{erreur} {erreurExterne}</p>}</form></Modale>}
  </>;
}

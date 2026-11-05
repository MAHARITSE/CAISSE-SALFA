import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, Info } from 'lucide-react';
import type { Ecriture, Sens } from '../types';
import { analyseCategories, totaliser } from '../utils/ledger';
import { formatAr, nombre } from '../utils/format';

function Repartition({ lignes, sens }: { lignes: Ecriture[]; sens: Sens }) {
  const { total, categories } = analyseCategories(lignes, sens);
  const recette = sens === 'RECETTE';
  return <section className="card p-5"><div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2">{recette ? <ArrowDownLeft size={20} className="text-emerald-600 dark:text-emerald-400" /> : <ArrowUpRight size={20} className="text-rose-600 dark:text-rose-400" />}<h3 className="text-base font-bold">{recette ? 'Origine des recettes' : 'Répartition des dépenses'}</h3></div><span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{formatAr(total)}</span></div>
    {!categories.length ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Aucun mouvement sur cette période.</p> : <div className="space-y-5">{categories.map(c => <div key={c.nom}><div className="mb-2 flex items-baseline justify-between gap-3 text-sm"><span className="font-medium text-slate-700 dark:text-slate-300">{c.nom}<span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{c.nombre} pièce(s)</span></span><span className="shrink-0 font-semibold tabular-nums">{formatAr(c.montant)} <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">{c.part.toFixed(1).replace('.', ',')} %</span></span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${c.nom} : ${c.part.toFixed(1)} %`}><div className={`h-full rounded-full ${recette ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${c.part}%` }} /></div></div>)}</div>}
  </section>;
}

export function Analyse({ lignes, periode }: { lignes: Ecriture[]; periode: string }) {
  const { recettes, depenses } = totaliser(lignes);
  const ratio = recettes > 0 ? depenses / recettes * 100 : null;
  return <div className="space-y-5">
    <div className="flex items-start gap-2.5 rounded-lg border border-brand-100 bg-brand-50/60 p-3.5 text-sm leading-relaxed text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/50 dark:text-brand-200"><Info size={18} className="mt-0.5 shrink-0" /><p>Analyse de la période complète : <strong>{periode}</strong>. Les filtres de recherche du journal ne réduisent pas ces statistiques. Les montants sont en ariary ; tous les mouvements sont encaissés ou décaissés en espèces.</p></div>
    <div className="grid gap-5 xl:grid-cols-2"><Repartition lignes={lignes} sens="DEPENSE" /><Repartition lignes={lignes} sens="RECETTE" /></div>
    <div className="card flex items-center gap-4 p-5"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300"><ChartNoAxesCombined size={24} /></div><div><h3 className="text-base font-semibold">Dépenses / recettes</h3><p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{ratio === null ? 'Aucune recette sur cette période : le ratio ne peut pas être calculé.' : `Les dépenses représentent ${nombre(Math.round(ratio))} % des recettes encaissées sur la période. Ce ratio ne tient pas compte du solde d’ouverture.`}</p></div></div>
  </div>;
}

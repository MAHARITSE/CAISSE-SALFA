import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CreditCard, Info } from 'lucide-react';
import type { Ecriture, Sens } from '../types';
import { analyseCategories, totaliser } from '../utils/ledger';
import { formatAr, nombre } from '../utils/format';

function Repartition({ lignes, sens }: { lignes: Ecriture[]; sens: Sens }) {
  const { total, categories } = analyseCategories(lignes, sens);
  const recette = sens === 'RECETTE';
  return <section className="card p-5"><div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2">{recette ? <ArrowDownLeft size={18} className="text-emerald-600" /> : <ArrowUpRight size={18} className="text-rose-600" />}<h3 className="text-sm font-bold">{recette ? 'Origine des recettes' : 'Répartition des dépenses'}</h3></div><span className="text-xs font-semibold text-slate-500">{formatAr(total)}</span></div>
    {!categories.length ? <p className="py-12 text-center text-xs text-slate-500">Aucun mouvement sur cette période.</p> : <div className="space-y-5">{categories.map(c => <div key={c.nom}><div className="mb-2 flex items-baseline justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{c.nom}<span className="ml-2 text-[10px] text-slate-400">{c.nombre} pièce(s)</span></span><span className="shrink-0 font-semibold tabular-nums">{formatAr(c.montant)} <span className="ml-1 font-normal text-slate-400">{c.part.toFixed(1).replace('.', ',')} %</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${c.nom} : ${c.part.toFixed(1)} %`}><div className={`h-full rounded-full ${recette ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${c.part}%` }} /></div></div>)}</div>}
  </section>;
}

export function Analyse({ lignes, periode }: { lignes: Ecriture[]; periode: string }) {
  const { recettes, depenses } = totaliser(lignes);
  const modes = new Map<string, { recettes: number; depenses: number; nombre: number }>();
  for (const e of lignes) {
    const mode = e.mode || 'Non précisé';
    const courant = modes.get(mode) ?? { recettes: 0, depenses: 0, nombre: 0 };
    courant[e.sens === 'RECETTE' ? 'recettes' : 'depenses'] += e.montant;
    courant.nombre++;
    modes.set(mode, courant);
  }
  const ratio = recettes > 0 ? depenses / recettes * 100 : null;
  return <div className="space-y-5">
    <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-xs text-brand-900"><Info size={16} className="mt-0.5 shrink-0" /><p>Analyse de la période complète : <strong>{periode}</strong>. Les filtres de recherche du journal ne réduisent pas ces statistiques. Les montants sont en ariary.</p></div>
    <div className="grid gap-5 xl:grid-cols-2"><Repartition lignes={lignes} sens="DEPENSE" /><Repartition lignes={lignes} sens="RECETTE" /></div>
    <section className="card overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><CreditCard size={18} className="text-brand-700" /><h3 className="text-sm font-bold">Mouvements par mode de paiement</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-5 py-3">Mode</th><th className="px-5 py-3 text-right">Pièces</th><th className="px-5 py-3 text-right">Recettes</th><th className="px-5 py-3 text-right">Dépenses</th><th className="px-5 py-3 text-right">Mouvement net</th></tr></thead><tbody>{[...modes.entries()].map(([mode, t]) => <tr key={mode} className="border-t border-slate-100"><td className="px-5 py-3 font-medium">{mode}</td><td className="px-5 py-3 text-right text-slate-500">{t.nombre}</td><td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatAr(t.recettes)}</td><td className="px-5 py-3 text-right tabular-nums text-rose-700">{formatAr(t.depenses)}</td><td className="px-5 py-3 text-right font-semibold tabular-nums">{formatAr(t.recettes - t.depenses)}</td></tr>)}{!modes.size && <tr><td colSpan={5} className="p-10 text-center text-slate-500">Aucun mouvement à analyser.</td></tr>}</tbody></table></div></section>
    <div className="card flex items-center gap-4 p-5"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ChartNoAxesCombined size={22} /></div><div><h3 className="text-sm font-semibold">Dépenses / recettes</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{ratio === null ? 'Aucune recette sur cette période : le ratio ne peut pas être calculé.' : `Les dépenses représentent ${nombre(Math.round(ratio))} % des recettes encaissées sur la période. Ce ratio ne tient pas compte du solde d’ouverture.`}</p></div></div>
  </div>;
}

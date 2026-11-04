import { CalendarCheck, CalendarClock, Download, FileText, Info, ShieldCheck } from 'lucide-react';
import type { Sauvegarde } from '../types';
import { anneeCourante, formatAr, horodatageFr, libelleExercice } from '../utils/format';
import { clotureAutorisee } from '../utils/ledger';

interface Props {
  livre: Sauvegarde;
  onCloturer: () => void;
  onTelechargerArchive: (annee: number) => void;
}

/** La caisse se clôture chaque année : un exercice en cours, des archives figées. */
export function Exercices({ livre, onCloturer, onTelechargerArchive }: Props) {
  const { soldeInitial, reportPrecedent } = livre.parametres;
  const exercice = livre.parametres.exercice ?? anneeCourante();
  const cloturePossible = clotureAutorisee(exercice);
  const archives = [...livre.exercicesClotures].sort((a, b) => b.annee - a.annee);
  return <div className="space-y-5">
    <section className="card overflow-hidden" aria-label="Exercice en cours">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="summary-icon bg-brand-50 text-brand-700"><CalendarClock size={19} /></span>
          <div>
            <h2 className="text-sm font-bold">Exercice en cours · {exercice}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Seules les écritures de {exercice} peuvent être saisies. La clôture ouvre l’année suivante et archive celle-ci.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button className="btn-primary" onClick={onCloturer} disabled={!cloturePossible} title={cloturePossible ? undefined : `Clôture possible à partir du 1er janvier ${exercice + 1}`}><CalendarCheck size={16} />Clôturer l’exercice {exercice}</button>
          {!cloturePossible && <p className="flex items-center gap-1 text-[11px] text-slate-500"><Info size={12} />Clôture possible à partir du 1er janvier {exercice + 1}, une fois l’année révolue.</p>}
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-5">
        <div><p className="summary-label">Écritures de l’exercice</p><p className="summary-value">{livre.ecritures.length}</p></div>
        <div><p className="summary-label">Solde d’ouverture</p><p className="summary-value">{formatAr(soldeInitial)}</p></div>
        <div><p className="summary-label">Report de la clôture</p><p className="mt-3 text-xs font-semibold text-slate-700">{reportPrecedent ? `${libelleExercice(reportPrecedent.annee)} · ${formatAr(reportPrecedent.solde)}` : 'Aucun exercice clôturé pour l’instant'}</p></div>
        <div><p className="summary-label">Clôture</p><p className={`mt-3 text-xs font-semibold ${cloturePossible ? 'text-brand-700' : 'text-slate-600'}`}>{cloturePossible ? `Autorisée : ${exercice} est révolu` : `À partir du 1er janvier ${exercice + 1}`}</p></div>
        <div><p className="summary-label">Exercices archivés</p><p className="summary-value">{archives.length}</p></div>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-relaxed text-slate-500">Une sauvegarde JSON de l’exercice en cours est téléchargée automatiquement avant chaque clôture. Les écritures clôturées restent consultables et exportables ci-dessous, mais ne comptent plus dans les soldes courants.</p>
    </section>

    <section className="card overflow-hidden" aria-label="Exercices clôturés">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><ShieldCheck size={18} className="text-brand-700" /><div><h2 className="text-sm font-bold">Exercices clôturés</h2><p className="mt-0.5 text-[11px] text-slate-500">Archives figées : elles ne peuvent plus être modifiées.</p></div></div>
      {!archives.length ? <div className="px-5 py-12 text-center"><FileText size={30} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-slate-700">Aucun exercice clôturé</p><p className="mt-1 text-xs text-slate-500">Le livre continue jusqu’à la première clôture. {cloturePossible ? `Clôturez ${exercice} pour démarrer ${exercice + 1} avec le solde reporté.` : `La clôture de ${exercice} sera possible à partir du 1er janvier ${exercice + 1}, pour démarrer ${exercice + 1} avec le solde reporté.`}</p></div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Exercice</th><th className="px-3 py-3 font-semibold">Clôturé le</th><th className="px-3 py-3 text-right font-semibold">Écritures</th><th className="px-3 py-3 text-right font-semibold">Recettes</th><th className="px-3 py-3 text-right font-semibold">Dépenses</th><th className="px-3 py-3 text-right font-semibold">Solde reporté</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{archives.map(a => <tr key={a.annee} className="border-t border-slate-100">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{a.annee}</td>
              <td className="px-3 py-3.5 text-slate-500">{horodatageFr(a.clotureLe)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-slate-600">{a.ecritures.length}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-emerald-700">{formatAr(a.recettes)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-rose-700">{formatAr(a.depenses)}</td>
              <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{formatAr(a.soldeCloture)}</td>
              <td className="px-5 py-3.5 text-right"><button className="btn-secondary !py-1.5 !text-[11px]" onClick={() => onTelechargerArchive(a.annee)} aria-label={`Télécharger l’archive ${a.annee}`}><Download size={13} />Archive JSON</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  </div>;
}

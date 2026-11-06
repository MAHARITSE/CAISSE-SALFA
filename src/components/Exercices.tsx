import { BookOpen, CalendarCheck, CalendarClock, Download, FileText, Info, ShieldCheck } from 'lucide-react';
import type { Sauvegarde } from '../types';
import { anneeCourante, formatAr, montantAffiche, horodatageFr, libelleExercice } from '../utils/format';
import { clotureAutorisee } from '../utils/ledger';

interface Props {
  livre: Sauvegarde;
  administrateur?: boolean;
  exerciceActif?: number;
  onCloturer: () => void;
  onTelechargerArchive: (annee: number) => void;
  onOuvrirExercice?: (annee: number) => void;
}

/** La caisse se clôture chaque année : un exercice en cours, des archives figées. */
export function Exercices({ livre, administrateur = false, exerciceActif, onCloturer, onTelechargerArchive, onOuvrirExercice }: Props) {
  const { soldeInitial, reportPrecedent } = livre.parametres;
  const exercice = livre.parametres.exercice ?? anneeCourante();
  const cloturePossible = clotureAutorisee(exercice);
  const archives = [...livre.exercicesClotures].sort((a, b) => b.annee - a.annee);
  return <div className="space-y-5">
    <section className="card overflow-hidden" aria-label="Exercice en cours">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="summary-icon bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300"><CalendarClock size={20} /></span>
          <div>
            <h2 className="text-base font-bold">Exercice en cours · {exercice}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Seules les écritures de {exercice} peuvent être saisies. La clôture ouvre l’année suivante et archive celle-ci.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button className="btn-primary" onClick={onCloturer} disabled={!cloturePossible} title={cloturePossible ? undefined : `Clôture possible à partir du 1er janvier ${exercice + 1}`}><CalendarCheck size={16} />Clôturer l’exercice {exercice}</button>
          {!cloturePossible && <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Info size={13} />Clôture possible à partir du 1er janvier {exercice + 1}, une fois l’année révolue.</p>}
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-5">
        <div><p className="summary-label">Écritures de l’exercice</p><p className="summary-value">{livre.ecritures.length}</p></div>
        <div><p className="summary-label">Solde d’ouverture</p><p className="summary-value">{formatAr(soldeInitial)}</p></div>
        <div><p className="summary-label">Report de la clôture</p><p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{reportPrecedent ? `${libelleExercice(reportPrecedent.annee)} · ${formatAr(reportPrecedent.solde)}` : 'Aucun exercice clôturé pour l’instant'}</p></div>
        <div><p className="summary-label">Clôture</p><p className={`mt-3 text-sm font-semibold ${cloturePossible ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}>{cloturePossible ? `Autorisée : ${exercice} est révolu` : `À partir du 1er janvier ${exercice + 1}`}</p></div>
        <div><p className="summary-label">Exercices archivés</p><p className="summary-value">{archives.length}</p></div>
      </div>
      <p className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">Une sauvegarde JSON de l’exercice en cours est téléchargée automatiquement avant chaque clôture. Les écritures clôturées restent consultables et exportables ci-dessous, mais ne comptent plus dans les soldes courants.</p>
    </section>

    <section className="card overflow-hidden" aria-label="Exercices clôturés">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 px-5 py-4"><ShieldCheck size={20} className="text-brand-700 dark:text-brand-300" /><div><h2 className="text-base font-bold">Exercices clôturés</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Archives figées : elles ne peuvent plus être modifiées.</p></div></div>
      {!archives.length ? <div className="px-5 py-12 text-center"><FileText size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p className="text-base font-semibold text-slate-700 dark:text-slate-300">Aucun exercice clôturé</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Le livre continue jusqu’à la première clôture. {cloturePossible ? `Clôturez ${exercice} pour démarrer ${exercice + 1} avec le solde reporté.` : `La clôture de ${exercice} sera possible à partir du 1er janvier ${exercice + 1}, pour démarrer ${exercice + 1} avec le solde reporté.`}</p></div> : (
        <div className="overflow-x-auto">
          <p className="px-5 py-2 text-xs text-slate-500 dark:text-slate-400">Montants en ariary</p>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400"><tr><th className="px-5 py-3 font-semibold">Exercice</th><th className="px-3 py-3 font-semibold">Clôturé le</th><th className="px-3 py-3 text-right font-semibold">Écritures</th><th className="px-3 py-3 text-right font-semibold">Recettes</th><th className="px-3 py-3 text-right font-semibold">Dépenses</th><th className="px-3 py-3 text-right font-semibold">Solde reporté</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{archives.map(a => <tr key={a.annee} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{a.annee}</td>
              <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">{horodatageFr(a.clotureLe)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{a.ecritures.length}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{montantAffiche(a.recettes)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">{montantAffiche(a.depenses)}</td>
              <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{montantAffiche(a.soldeCloture)}</td>
              <td className="px-5 py-3.5 text-right">
                <div className="inline-flex flex-wrap justify-end gap-2">
                  {administrateur && onOuvrirExercice && (
                    <button
                      type="button"
                      className={`btn-secondary !py-1.5 !text-xs ${exerciceActif === a.annee ? '!border-brand-600 !bg-brand-50 !text-brand-800 dark:!border-brand-500 dark:!bg-brand-950/60 dark:!text-brand-300' : ''}`}
                      onClick={() => onOuvrirExercice(a.annee)}
                      aria-label={`Ouvrir l’exercice ${a.annee}`}
                    >
                      <BookOpen size={14} />{exerciceActif === a.annee ? `Exercice ${a.annee} affiché` : `Ouvrir l’exercice ${a.annee}`}
                    </button>
                  )}
                  <button className="btn-secondary !py-1.5 !text-xs" onClick={() => onTelechargerArchive(a.annee)} aria-label={`Télécharger l’archive ${a.annee}`}><Download size={14} />Archive JSON</button>
                </div>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  </div>;
}

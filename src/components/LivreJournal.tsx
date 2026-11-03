import React from 'react';
import { Ecriture, LigneJournal } from '../types';
import { dateFr, formatAr } from '../utils/format';

interface LivreJournalProps {
  lignes: LigneJournal[];
  soldeOuverture: number;
  periode: string;
  recettes: number;
  depenses: number;
  soldeFin: number;
  enEditionId: string | null;
  onEditer: (ecriture: Ecriture) => void;
  onSupprimer: (id: string) => void;
}

export const LivreJournal: React.FC<LivreJournalProps> = ({
  lignes,
  soldeOuverture,
  periode,
  recettes,
  depenses,
  soldeFin,
  enEditionId,
  onEditer,
  onSupprimer,
}) => (
  <section id="journal" className="rounded-lg border border-slate-200 bg-white overflow-hidden">
    <div className="print-only px-4 pt-4 pb-2">
      <p className="text-base font-bold">CAISSE SALFA — Livre journal des recettes et dépenses</p>
      <p className="text-xs">Période : {periode}</p>
    </div>

    <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 border-b border-slate-100">
      <h2 className="text-sm font-semibold text-slate-800">Livre journal</h2>
      <span className="text-xs text-slate-500">
        {periode} · {lignes.length} écriture(s)
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">N°</th>
            <th className="px-3 py-2 font-medium">Libellé</th>
            <th className="px-3 py-2 font-medium">Catégorie</th>
            <th className="px-3 py-2 font-medium">Mode</th>
            <th className="px-3 py-2 font-medium text-right">Recette</th>
            <th className="px-3 py-2 font-medium text-right">Dépense</th>
            <th className="px-3 py-2 font-medium text-right">Solde</th>
            <th className="px-3 py-2 no-print w-14" />
          </tr>
        </thead>

        <tbody>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <td className="px-3 py-2 text-xs text-slate-500" colSpan={5}>
              Report à nouveau
            </td>
            <td className="px-3 py-2 text-right text-slate-300">—</td>
            <td className="px-3 py-2 text-right text-slate-300">—</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">
              {formatAr(soldeOuverture)}
            </td>
            <td className="px-3 py-2 no-print" />
          </tr>

          {lignes.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                Aucune écriture pour cette période.
              </td>
            </tr>
          ) : (
            lignes.map(ligne => (
              <tr
                key={ligne.id}
                className={`border-b border-slate-50 last:border-0 ${
                  enEditionId === ligne.id ? 'bg-amber-50' : 'hover:bg-slate-50/70'
                }`}
              >
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{dateFr(ligne.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-500">{ligne.numero}</td>
                <td className="px-3 py-2 text-slate-900">
                  <span className="block">{ligne.libelle}</span>
                  {ligne.tiers || ligne.reference || ligne.observation ? (
                    <span className="block text-[11px] text-slate-500">
                      {[ligne.tiers, ligne.reference, ligne.observation].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  {ligne.categorie === ligne.libelle ? '' : ligne.categorie}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{ligne.mode}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700">
                  {ligne.sens === 'RECETTE' ? formatAr(ligne.montant) : ''}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-rose-700">
                  {ligne.sens === 'DEPENSE' ? formatAr(ligne.montant) : ''}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-slate-900">
                  {formatAr(ligne.solde)}
                </td>
                <td className="px-2 py-2 no-print">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEditer(ligne)}
                      title="Modifier"
                      aria-label={`Modifier ${ligne.numero}`}
                      className="w-6 h-6 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 text-xs"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => onSupprimer(ligne.id)}
                      title="Supprimer"
                      aria-label={`Supprimer ${ligne.numero}`}
                      className="w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>

        <tfoot>
          <tr className="bg-slate-100 border-t border-slate-200">
            <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-slate-700">
              Totaux de la période
            </td>
            <td className="px-3 py-2 text-right font-semibold text-emerald-800 whitespace-nowrap">
              {formatAr(recettes)}
            </td>
            <td className="px-3 py-2 text-right font-semibold text-rose-800 whitespace-nowrap">
              {formatAr(depenses)}
            </td>
            <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{formatAr(soldeFin)}</td>
            <td className="px-3 py-2 no-print" />
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
);

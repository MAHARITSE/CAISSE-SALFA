import React from 'react';
import { Depense } from '../types';
import { formatAr } from '../utils/format';

interface JournalProps {
  depenses: Depense[];
}

const dateFr = (iso: string): string => {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
};

/** Journal des dépenses — lecture seule. */
export const Journal: React.FC<JournalProps> = ({ depenses }) => {
  const total = depenses.reduce((somme, d) => somme + d.montant, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between gap-3 p-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Journal des dépenses</h2>
        <span className="text-xs text-slate-500">
          {depenses.length} ligne(s) · <strong className="text-slate-900">{formatAr(total)}</strong>
        </span>
      </div>

      {depenses.length === 0 ? (
        <p className="p-6 text-sm text-slate-500 text-center">Aucune dépense enregistrée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">N°</th>
                <th className="px-4 py-2 font-medium">Libellé</th>
                <th className="px-4 py-2 font-medium">Catégorie</th>
                <th className="px-4 py-2 font-medium">Bénéficiaire</th>
                <th className="px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {depenses.map(d => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">{dateFr(d.date)}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-slate-500">{d.numero}</td>
                  <td className="px-4 py-2 text-slate-900">{d.libelle}</td>
                  <td className="px-4 py-2 text-slate-600">{d.categorie}</td>
                  <td className="px-4 py-2 text-slate-600">{d.beneficiaire}</td>
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{d.modePaiement}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap font-medium text-slate-900">
                    {formatAr(d.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-slate-700">
                  Total
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                  {formatAr(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
};

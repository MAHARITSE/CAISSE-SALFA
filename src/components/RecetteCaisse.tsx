import React, { useMemo, useState } from 'react';
import { BordereauRecette, LigneBordereau } from '../types';
import { CATEGORIES_RECETTE } from '../utils/storage';
import { aujourdHui, formatAr } from '../utils/format';
import { numberToWordsMGA } from '../utils/numberToWords';

interface RecetteCaisseProps {
  onEnregistrer: (bordereau: BordereauRecette) => void;
}

interface LigneSaisie {
  reference: string;
  montant: string;
  observation: string;
}

const ligneVide = (): LigneSaisie => ({ reference: '', montant: '', observation: '' });

const viderTout = (): Record<string, LigneSaisie> =>
  Object.fromEntries(CATEGORIES_RECETTE.map(c => [c, ligneVide()]));

const champCellule =
  'w-full bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:bg-amber-50 rounded';

/** Modèle de saisie du bordereau papier « RECETTE CAISSE ». */
export const RecetteCaisse: React.FC<RecetteCaisseProps> = ({ onEnregistrer }) => {
  const [date, setDate] = useState(aujourdHui());
  const [pourCompteDe, setPourCompteDe] = useState('');
  const [lignes, setLignes] = useState<Record<string, LigneSaisie>>(viderTout);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const total = useMemo(
    () => CATEGORIES_RECETTE.reduce((somme, c) => somme + (Number(lignes[c]?.montant) || 0), 0),
    [lignes],
  );

  const modifier = (categorie: string, champ: keyof LigneSaisie, valeur: string) => {
    setLignes(anciennes => ({ ...anciennes, [categorie]: { ...anciennes[categorie], [champ]: valeur } }));
    setErreur('');
  };

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    const remplies: LigneBordereau[] = CATEGORIES_RECETTE.map(categorie => ({
      categorie,
      reference: lignes[categorie]?.reference.trim() ?? '',
      montant: Number(lignes[categorie]?.montant) || 0,
      observation: lignes[categorie]?.observation.trim() ?? '',
    })).filter(l => l.montant > 0);

    if (remplies.length === 0) {
      setErreur('Saisissez au moins un montant sur le bordereau.');
      return;
    }

    onEnregistrer({ date, pourCompteDe: pourCompteDe.trim(), lignes: remplies });
    setLignes(viderTout());
    setMessage(`Recette enregistrée : ${remplies.length} ligne(s), total ${formatAr(total)}.`);
    setErreur('');
  };

  return (
    <form onSubmit={enregistrer} className="rounded-lg border border-slate-200 bg-white">
      <div className="print-only px-4 pt-3">
        <p className="text-base font-bold uppercase tracking-wide">Recette caisse</p>
        <p className="text-xs">
          Date : {date} — P/c de : {pourCompteDe || '—'}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3 no-print">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Recette caisse</h2>
          <p className="text-[11px] text-slate-500">
            Un montant par ligne du bordereau ; seules les lignes renseignées seront enregistrées.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-500 mb-1">Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              required
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-500 mb-1">P/c de</span>
            <input
              type="text"
              value={pourCompteDe}
              onChange={e => setPourCompteDe(e.target.value)}
              placeholder="Ex : LYDIA"
              className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-600">
              <th className="w-10 border-r border-slate-200 px-2 py-2 font-semibold">n°</th>
              <th className="border-r border-slate-200 px-2 py-2 font-semibold">Désignation</th>
              <th className="w-32 border-r border-slate-200 px-2 py-2 font-semibold">Référence</th>
              <th className="w-40 border-r border-slate-200 px-2 py-2 text-right font-semibold">Montant</th>
              <th className="w-52 px-2 py-2 font-semibold">Observation</th>
            </tr>
          </thead>

          <tbody>
            {CATEGORIES_RECETTE.map((categorie, index) => (
              <tr key={categorie} className="border-b border-slate-200">
                <td className="border-r border-slate-200 px-2 py-1 text-center text-xs text-slate-500">{index + 1}</td>
                <td className="border-r border-slate-200 px-2 py-1 font-medium uppercase tracking-wide text-slate-800">
                  {categorie}
                </td>
                <td className="border-r border-slate-200 px-1 py-1">
                  <input
                    type="text"
                    className={champCellule}
                    value={lignes[categorie]?.reference ?? ''}
                    onChange={e => modifier(categorie, 'reference', e.target.value)}
                    placeholder="n° pièce"
                    aria-label={`Référence ${categorie}`}
                  />
                </td>
                <td className="border-r border-slate-200 px-1 py-1">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className={`${champCellule} text-right`}
                    value={lignes[categorie]?.montant ?? ''}
                    onChange={e => modifier(categorie, 'montant', e.target.value)}
                    placeholder="0"
                    aria-label={`Montant ${categorie}`}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    className={champCellule}
                    value={lignes[categorie]?.observation ?? ''}
                    onChange={e => modifier(categorie, 'observation', e.target.value)}
                    aria-label={`Observation ${categorie}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-400 bg-slate-50">
              <td colSpan={3} className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                Total des recettes
              </td>
              <td className="px-2 py-2 text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                {formatAr(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 px-4 py-3 border-t border-slate-100">
        <p className="text-[11px] italic text-slate-600">
          Arrêtée la recette à la somme totale de{' '}
          <span className="font-semibold uppercase not-italic text-slate-800">
            {total > 0 ? numberToWordsMGA(total) : 'zéro Ariary'}
          </span>
        </p>

        {erreur ? (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erreur}</p>
        ) : message ? (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{message}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => {
              setLignes(viderTout());
              setErreur('');
              setMessage('');
            }}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Vider le bordereau
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
          >
            Enregistrer la recette
          </button>
        </div>
      </div>
    </form>
  );
};

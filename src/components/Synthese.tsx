import React, { useEffect, useState } from 'react';
import { formatAr } from '../utils/format';

interface SyntheseProps {
  soldeInitial: number;
  onSoldeInitial: (montant: number) => void;
  recettes: number;
  depenses: number;
  soldeFin: number;
  periode: string;
}

const carte = 'rounded-lg border border-slate-200 bg-white p-3';
const titre = 'text-[11px] uppercase tracking-wide text-slate-500';

export const Synthese: React.FC<SyntheseProps> = ({
  soldeInitial,
  onSoldeInitial,
  recettes,
  depenses,
  soldeFin,
  periode,
}) => {
  const [editionSolde, setEditionSolde] = useState(false);
  const [valeur, setValeur] = useState(String(soldeInitial));

  useEffect(() => {
    setValeur(String(soldeInitial));
  }, [soldeInitial]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={carte}>
        <p className={titre}>Recettes · {periode}</p>
        <p className="mt-1 text-lg font-semibold text-emerald-700">{formatAr(recettes)}</p>
      </div>

      <div className={carte}>
        <p className={titre}>Dépenses · {periode}</p>
        <p className="mt-1 text-lg font-semibold text-rose-700">{formatAr(depenses)}</p>
      </div>

      <div className={carte}>
        <p className={titre}>Solde de trésorerie</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{formatAr(soldeFin)}</p>
      </div>

      <div className={carte}>
        <div className="flex items-center justify-between gap-2">
          <p className={titre}>Solde d ouverture</p>
          {editionSolde ? null : (
            <button
              type="button"
              onClick={() => setEditionSolde(true)}
              className="text-[11px] text-slate-500 hover:text-slate-900 underline"
            >
              modifier
            </button>
          )}
        </div>

        {editionSolde ? (
          <form
            className="mt-1 flex items-center gap-1"
            onSubmit={e => {
              e.preventDefault();
              onSoldeInitial(Number(valeur) || 0);
              setEditionSolde(false);
            }}
          >
            <input
              type="number"
              autoFocus
              value={valeur}
              onChange={e => setValeur(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <button type="submit" className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
              OK
            </button>
          </form>
        ) : (
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatAr(soldeInitial)}</p>
        )}
      </div>
    </div>
  );
};

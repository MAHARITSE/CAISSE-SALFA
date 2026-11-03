import React from 'react';
import { MasqueDepense } from '../types';
import { formatAr } from '../utils/format';

interface MasqueDepensesProps {
  masques: MasqueDepense[];
  appliqueId: string | null;
  onAppliquer: (masque: MasqueDepense) => void;
  onSupprimer: (id: string) => void;
  onAjouterDepuisSaisie: () => void;
  peutAjouter: boolean;
}

/** Liste plate des dépenses types : un clic pré-remplit la saisie. */
export const MasqueDepenses: React.FC<MasqueDepensesProps> = ({
  masques,
  appliqueId,
  onAppliquer,
  onSupprimer,
  onAjouterDepuisSaisie,
  peutAjouter,
}) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 className="text-sm font-semibold text-slate-800">Masque de saisie</h2>
      <button
        type="button"
        onClick={onAjouterDepuisSaisie}
        disabled={!peutAjouter}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-500"
      >
        + Ajouter la saisie au masque
      </button>
    </div>

    {masques.length === 0 ? (
      <p className="text-xs text-slate-500 py-2">
        Le masque est vide. Remplissez la saisie puis cliquez sur « Ajouter la saisie au masque ».
      </p>
    ) : (
      <ul className="divide-y divide-slate-100">
        {masques.map(m => (
          <li key={m.id} className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => onAppliquer(m)}
              className={`flex-1 min-w-0 text-left px-2 py-1.5 rounded-md ${
                appliqueId === m.id ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm text-slate-800 truncate">{m.designation}</span>
              <span className="block text-[11px] text-slate-500 truncate">
                {m.categorie} · {m.beneficiaire || 'sans bénéficiaire'} · {formatAr(m.montant)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSupprimer(m.id)}
              title="Retirer du masque"
              aria-label={`Retirer ${m.designation} du masque`}
              className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-lg leading-none"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    )}

    <p className="text-[11px] text-slate-400 mt-3">
      Cliquez une ligne pour pré-remplir la saisie. « × » retire la dépense du masque.
    </p>
  </section>
);

import React from 'react';
import { MasqueDepense, MasqueEnteteConfig } from '../types';
import { formatCurrencyMGA } from '../utils/numberToWords';
import { MasqueEnteteView } from './MasqueEntete';
import { LayoutList, Printer, Settings2, Sparkles, Tag, User } from 'lucide-react';

interface MasqueSaisiePanelProps {
  masques: MasqueDepense[];
  entete: MasqueEnteteConfig;
  masqueAppliqueId: string | null;
  onAppliquer: (masque: MasqueDepense) => void;
  onOuvrirGestion: () => void;
  onOuvrirEntete: () => void;
  onOuvrirImpression: () => void;
}

/**
 * Bandeau « masque de saisie des dépenses » inséré dans l'écran de saisie :
 * on appelle une dépense du masque, on gère les dépenses du masque,
 * on modifie l'entête et on imprime le document.
 */
export const MasqueSaisiePanel: React.FC<MasqueSaisiePanelProps> = ({
  masques,
  entete,
  masqueAppliqueId,
  onAppliquer,
  onOuvrirGestion,
  onOuvrirEntete,
  onOuvrirImpression,
}) => {
  const actifs = masques.filter(m => m.actif);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
            MDEP_MASQUE_SAISIE
          </span>
          <h3 className="text-sm font-bold mt-1 flex items-center gap-1.5">
            <LayoutList className="w-4 h-4 text-teal-400" />
            Masque de saisie des dépenses
          </h3>
          <p className="text-[11px] text-slate-300">
            Appelez une dépense du masque pour pré-remplir la saisie, ou décidez d y verser la dépense en cours.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onOuvrirGestion}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            Gérer les masques
          </button>
          <button
            type="button"
            onClick={onOuvrirEntete}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold flex items-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5 text-teal-300" />
            Entête
          </button>
          <button
            type="button"
            onClick={onOuvrirImpression}
            className="px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11px] font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer le masque
          </button>
        </div>
      </div>

      <div className="p-5 grid lg:grid-cols-[1fr_260px] gap-5">
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
              Appeler une dépense du masque
            </span>
            <select
              value={masqueAppliqueId ?? ''}
              onChange={e => {
                const m = actifs.find(x => x.id === e.target.value);
                if (m) onAppliquer(m);
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">-- Choisir une dépense du masque --</option>
              {actifs.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.designation} ({formatCurrencyMGA(m.montantDefaut || 0)})
                </option>
              ))}
            </select>
          </label>

          {actifs.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3">
              Le masque ne contient aucune dépense active. Utilisez « Gérer les masques » pour en ajouter, ou cochez
              l option de mémorisation au moment d enregistrer une dépense.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actifs.slice(0, 8).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onAppliquer(m)}
                  className={`text-left px-3 py-2 rounded-xl border transition-all ${
                    masqueAppliqueId === m.id
                      ? 'border-teal-500 bg-teal-50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-800 max-w-40 truncate">{m.designation}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" />
                      {m.categorie}
                    </span>
                    {m.beneficiaire ? (
                      <span className="flex items-center gap-0.5 truncate max-w-24">
                        <User className="w-2.5 h-2.5" />
                        {m.beneficiaire}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-teal-700 mt-0.5">
                    {formatCurrencyMGA(m.montantDefaut || 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1 pb-1">
            Entête du document
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <MasqueEnteteView config={entete} compact />
          </div>
          <button
            type="button"
            onClick={onOuvrirEntete}
            className="mt-2 w-full text-[10px] font-semibold text-teal-700 hover:text-teal-900 underline"
          >
            Modifier l entête
          </button>
        </div>
      </div>
    </div>
  );
};

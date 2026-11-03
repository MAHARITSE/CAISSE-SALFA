import React, { useEffect, useMemo, useState } from 'react';
import { CaisseTransaction, MasqueDepense, MasqueEnteteConfig, User } from '../types';
import { formatCurrencyMGA, numberToWordsMGA } from '../utils/numberToWords';
import { MasqueEnteteView } from './MasqueEntete';
import { FileText, Printer, X, Eye } from 'lucide-react';

interface MasqueDepensePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  entete: MasqueEnteteConfig;
  masques: MasqueDepense[];
  transactions: CaisseTransaction[];
  currentUser: User;
}

type ModeDocument = 'rempli' | 'vierge';

/**
 * Document imprimable du masque de saisie des dépenses.
 * Utilise l'entête configuré (MasqueEnteteModal) et se rabat sur #printable-section,
 * comme les autres impressions de CAISSE SALFA.
 */
export const MasqueDepensePrintModal: React.FC<MasqueDepensePrintModalProps> = ({
  isOpen,
  onClose,
  entete,
  masques,
  transactions,
  currentUser,
}) => {
  const [mode, setMode] = useState<ModeDocument>('rempli');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inclus, setInclus] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMode('rempli');
      setDate(new Date().toISOString().slice(0, 10));
      setInclus(masques.filter(m => m.actif).map(m => m.id));
    }
  }, [isOpen, masques]);

  const lignesRemplies = useMemo(
    () => masques.filter(m => inclus.includes(m.id)),
    [masques, inclus],
  );

  const totalMasque = lignesRemplies.reduce((sum, m) => sum + (Number(m.montantDefaut) || 0), 0);

  const depensesJour = useMemo(
    () => transactions.filter(t => t.type === 'DEPENSE' && t.date === date),
    [transactions, date],
  );

  if (!isOpen) return null;

  const nbLignes = mode === 'rempli' ? lignesRemplies.length : Math.max(1, entete.nbLignesVierges);

  const toggle = (id: string) => {
    setInclus(old => (old.includes(id) ? old.filter(x => x !== id) : [...old, id]));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="bg-slate-900 text-white p-4 px-6 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold">Aperçu — Masque de saisie des dépenses</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimer le masque
            </button>
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Réglages d'impression */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                Type de document
              </span>
              <div className="flex bg-white rounded-xl border border-slate-300 p-1">
                <button
                  type="button"
                  onClick={() => setMode('rempli')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'rempli' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Masque rempli
                </button>
                <button
                  type="button"
                  onClick={() => setMode('vierge')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'vierge' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Feuille vierge
                </button>
              </div>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </label>

            <div className="text-xs text-slate-500 flex items-center gap-1.5 pb-1.5">
              <Eye className="w-4 h-4 text-teal-600" />
              {depensesJour.length} dépense(s) saisie(s) ce jour — total{' '}
              <strong className="text-slate-800">
                {formatCurrencyMGA(depensesJour.reduce((s, t) => s + t.montant, 0))}
              </strong>
            </div>
          </div>

          {mode === 'rempli' ? (
            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                Dépenses à faire figurer sur le document
              </span>
              <div className="flex flex-wrap gap-2">
                {masques.length === 0 ? (
                  <span className="text-xs text-slate-500">
                    Aucune dépense dans le masque : ajoutez-en depuis « Gérer les masques ».
                  </span>
                ) : (
                  masques.map(m => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        inclus.includes(m.id)
                          ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={inclus.includes(m.id)}
                        onChange={() => toggle(m.id)}
                        className="accent-teal-600"
                      />
                      {m.designation || m.code}
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Feuille de {entete.nbLignesVierges} lignes à remplir à la main puis à saisir dans l application.
            </p>
          )}
        </div>

        {/* Zone imprimable */}
        <div id="printable-section" className="p-8 text-slate-900 bg-white text-xs space-y-4">
          <MasqueEnteteView config={entete} />

          <div className="border-t-2 border-b-2 border-slate-800 py-2 text-center">
            <div className="text-sm font-extrabold uppercase tracking-wide">
              {entete.titreDocument || 'MASQUE DE SAISIE DES DEPENSES'}
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              Date : {date} — Caissier : {currentUser.name}
            </div>
          </div>

          <table className="w-full border border-slate-400 border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1 w-8">N°</th>
                <th className="border border-slate-400 p-1 w-20">Code</th>
                <th className="border border-slate-400 p-1 text-left">Libellé de la dépense</th>
                <th className="border border-slate-400 p-1 text-left w-28">Catégorie</th>
                <th className="border border-slate-400 p-1 text-left w-32">Bénéficiaire</th>
                <th className="border border-slate-400 p-1 w-16">Mode</th>
                <th className="border border-slate-400 p-1 text-right w-24">Montant (Ar)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: nbLignes }).map((_, index) => {
                const ligne = mode === 'rempli' ? lignesRemplies[index] : undefined;
                return (
                  <tr key={index} className={index % 2 ? 'bg-slate-50/60' : ''}>
                    <td className="border border-slate-400 p-1 text-center">{index + 1}</td>
                    <td className="border border-slate-400 p-1 text-center font-mono">{ligne?.code ?? ''}</td>
                    <td className="border border-slate-400 p-1">
                      {ligne ? ligne.libelle : '\u00A0'}
                    </td>
                    <td className="border border-slate-400 p-1">{ligne?.categorie ?? ''}</td>
                    <td className="border border-slate-400 p-1">{ligne?.beneficiaire ?? ''}</td>
                    <td className="border border-slate-400 p-1 text-center">{ligne?.modePaiement ?? ''}</td>
                    <td className="border border-slate-400 p-1 text-right font-semibold">
                      {ligne ? formatCurrencyMGA(ligne.montantDefaut || 0) : ''}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-400 p-1 text-center" colSpan={6}>
                  TOTAL {mode === 'rempli' ? `(${lignesRemplies.length} ligne(s))` : ''}
                </td>
                <td className="border border-slate-400 p-1 text-right">
                  {mode === 'rempli' ? formatCurrencyMGA(totalMasque) : ''}
                </td>
              </tr>
            </tbody>
          </table>

          {mode === 'rempli' && totalMasque > 0 ? (
            <p className="text-[10px] italic">
              Arrêté le présent masque à la somme de : <strong>{numberToWordsMGA(totalMasque)}</strong>.
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-6 pt-6 text-center text-[10px]">
            <div>
              <div className="font-bold mb-10">Préparé par (Caissier)</div>
              <div className="border-t border-slate-400 pt-1">{currentUser.name}</div>
            </div>
            <div>
              <div className="font-bold mb-10">Vérifié par (Chef Comptable)</div>
              <div className="border-t border-slate-400 pt-1">Visa & Date</div>
            </div>
            <div>
              <div className="font-bold mb-10">Approuvé par (Direction)</div>
              <div className="border-t border-slate-400 pt-1">Signature & Sceau</div>
            </div>
          </div>

          <div className="border-t pt-3 flex items-start justify-between gap-4 text-[9px] text-slate-500">
            <span className="flex items-start gap-1">
              <FileText className="w-3 h-3 mt-0.5" />
              {entete.mentionPied}
            </span>
            <span className="shrink-0">
              Édité le {new Date().toLocaleDateString('fr-FR')} — CAISSE SALFA v25.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

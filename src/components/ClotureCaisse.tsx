import React, { useState } from 'react';
import type { CaisseTransaction, BilletageCount, ClotureCaisse as ClotureCaisseRecord, User } from '../types';
import { formatCurrencyMGA, numberToWordsMGA } from '../utils/numberToWords';
import { 
  Lock, 
  Coins, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  FileText, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';

interface ClotureCaisseProps {
  transactions: CaisseTransaction[];
  initialBalance: number;
  currentUser: User;
  onPrintClotureReport: (cloture: ClotureCaisseRecord) => void;
}

export const ClotureCaisseView: React.FC<ClotureCaisseProps> = ({
  transactions,
  initialBalance,
  currentUser,
  onPrintClotureReport
}) => {
  const [billetage, setBilletage] = useState<BilletageCount>({
    b20000: 0,
    b10000: 0,
    b5000: 0,
    b2000: 0,
    b1000: 0,
    pieces: 0
  });

  const [observations, setObservations] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Financial calculations
  const totalRecettes = transactions
    .filter(t => t.type === 'RECETTE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalDepenses = transactions
    .filter(t => t.type === 'DEPENSE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const soldeTheorique = initialBalance + totalRecettes - totalDepenses;

  // Compute physical total from billetage
  const total20k = billetage.b20000 * 20000;
  const total10k = billetage.b10000 * 10000;
  const total5k = billetage.b5000 * 5000;
  const total2k = billetage.b2000 * 2000;
  const total1k = billetage.b1000 * 1000;

  const soldePhysique = total20k + total10k + total5k + total2k + total1k + billetage.pieces;
  const ecart = soldePhysique - soldeTheorique;

  const handleBilletChange = (key: keyof BilletageCount, val: string) => {
    const parsed = parseInt(val, 10) || 0;
    setBilletage(prev => ({ ...prev, [key]: parsed < 0 ? 0 : parsed }));
  };

  const currentClotureRecord: ClotureCaisseRecord = {
    id: `clot-${new Date().toISOString().slice(0, 10)}`,
    dateCloture: new Date().toISOString().slice(0, 10),
    caissier: currentUser.name,
    soldeInitial: initialBalance,
    totalRecettes,
    totalDepenses,
    soldeTheorique,
    billetage,
    soldePhysique,
    ecart,
    observations: observations || (ecart === 0 ? 'Caisse conforme sans écart.' : `Écart constaté: ${ecart > 0 ? 'Excédent' : 'Manquant'} de ${formatCurrencyMGA(Math.abs(ecart))}`),
    statut: ecart === 0 ? 'Conforme' : 'Écart constaté'
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            CLOTURE.fic - Billetage & Audit
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Clôture Journalière & Comptage Billetage</h2>
          <p className="text-xs text-slate-300">
            Vérification du solde théorique de caisse et inventaire physique des coupures de billets en Ariary.
          </p>
        </div>

        <button
          onClick={() => onPrintClotureReport(currentClotureRecord)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <Printer className="w-4 h-4" />
          Imprimer Procès-Verbal
        </button>
      </div>

      {/* Financial Summary vs Physical Count */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Solde Théorique Calculé</div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrencyMGA(soldeTheorique)}</div>
          <div className="text-[11px] text-slate-500">
            Initial ({formatCurrencyMGA(initialBalance)}) + Recettes ({formatCurrencyMGA(totalRecettes)}) - Dépenses ({formatCurrencyMGA(totalDepenses)})
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Solde Physique Réel (Billetage)</div>
          <div className="text-2xl font-extrabold text-teal-600">{formatCurrencyMGA(soldePhysique)}</div>
          <div className="text-[11px] text-slate-500">
            Total des coupures comptées en caisse
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-xs space-y-1 ${
          ecart === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
          ecart > 0 ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            {ecart === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            Écart de Caisse
          </div>
          <div className="text-2xl font-extrabold">
            {ecart === 0 ? '0 Ar (Conforme)' : `${ecart > 0 ? '+' : ''}${formatCurrencyMGA(ecart)}`}
          </div>
          <div className="text-[11px] font-semibold">
            {ecart === 0 ? 'Caisse parfaitement équilibrée' : ecart > 0 ? 'Excédent constaté en caisse' : 'Manquant constaté en caisse'}
          </div>
        </div>
      </div>

      {/* Billetage Interactive Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Grille de Dénombrement des Billets (Billetage)</h3>
          </div>
          <button
            onClick={() => setBilletage({ b20000: 0, b10000: 0, b5000: 0, b2000: 0, b1000: 0, pieces: 0 })}
            className="text-xs text-slate-400 hover:text-slate-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Remettre à zéro
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Billet 20 000 Ar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">20 000 Ariary</div>
              <div className="text-[11px] text-slate-500 font-mono">Billet Bleu (Gouv. MG)</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.b20000 || ''}
                onChange={(e) => handleBilletChange('b20000', e.target.value)}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-28 text-right font-mono">
                = {formatCurrencyMGA(total20k)}
              </span>
            </div>
          </div>

          {/* Billet 10 000 Ar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">10 000 Ariary</div>
              <div className="text-[11px] text-slate-500 font-mono">Billet Rouge/Jaune</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.b10000 || ''}
                onChange={(e) => handleBilletChange('b10000', e.target.value)}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-28 text-right font-mono">
                = {formatCurrencyMGA(total10k)}
              </span>
            </div>
          </div>

          {/* Billet 5 000 Ar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">5 000 Ariary</div>
              <div className="text-[11px] text-slate-500 font-mono">Billet Violet</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.b5000 || ''}
                onChange={(e) => handleBilletChange('b5000', e.target.value)}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-28 text-right font-mono">
                = {formatCurrencyMGA(total5k)}
              </span>
            </div>
          </div>

          {/* Billet 2 000 Ar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">2 000 Ariary</div>
              <div className="text-[11px] text-slate-500 font-mono">Billet Vert</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.b2000 || ''}
                onChange={(e) => handleBilletChange('b2000', e.target.value)}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-28 text-right font-mono">
                = {formatCurrencyMGA(total2k)}
              </span>
            </div>
          </div>

          {/* Billet 1 000 Ar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">1 000 Ariary</div>
              <div className="text-[11px] text-slate-500 font-mono">Billet Marron</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.b1000 || ''}
                onChange={(e) => handleBilletChange('b1000', e.target.value)}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-28 text-right font-mono">
                = {formatCurrencyMGA(total1k)}
              </span>
            </div>
          </div>

          {/* Pièces et monnaies */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">Monnaies & Pièces</div>
              <div className="text-[11px] text-slate-500 font-mono">Pièces (500, 200, 100, 50 Ar)</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={billetage.pieces || ''}
                onChange={(e) => handleBilletChange('pieces', e.target.value)}
                placeholder="0"
                className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
              />
              <span className="text-xs font-bold text-slate-700 w-24 text-right font-mono">
                = {formatCurrencyMGA(billetage.pieces)}
              </span>
            </div>
          </div>
        </div>

        {/* Observations */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Observations du Caissier / Justifications éventuelles
          </label>
          <textarea
            rows={2}
            placeholder="Remarques relatives au comptage de caisse..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        {/* Action bar */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Clôture effectuée par: <strong>{currentUser.name}</strong> ({currentUser.role})</span>
          </div>

          <button
            onClick={() => {
              setIsSubmitted(true);
              alert('Procès-Verbal de clôture enregistré avec succès !');
            }}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-teal-400" />
            {isSubmitted ? 'Clôture Enregistrée ✓' : 'Valider & Clôturer la Caisse'}
          </button>
        </div>
      </div>
    </div>
  );
};

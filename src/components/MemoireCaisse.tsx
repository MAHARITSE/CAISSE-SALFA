import React, { useState } from 'react';
import { CaisseTransaction, FilterState } from '../types';
import { formatCurrencyMGA } from '../utils/numberToWords';
import { 
  FileText, 
  Search, 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  CreditCard, 
  Trash2, 
  Eye, 
  Plus, 
  SlidersHorizontal 
} from 'lucide-react';

interface MemoireCaisseProps {
  transactions: CaisseTransaction[];
  onDeleteTransaction: (id: string) => void;
  onShowReceipt: (tx: CaisseTransaction) => void;
  onNavigateTab: (tab: 'saisie') => void;
}

export const MemoireCaisse: React.FC<MemoireCaisseProps> = ({
  transactions,
  onDeleteTransaction,
  onShowReceipt,
  onNavigateTab
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    type: 'TOUS',
    categorie: '',
    modePaiement: '',
    dateDebut: '',
    dateFin: ''
  });

  const uniqueCategories = Array.from(new Set(transactions.map(t => t.categorie)));

  const filtered = transactions.filter(t => {
    if (filters.type !== 'TOUS' && t.type !== filters.type) return false;
    if (filters.categorie && t.categorie !== filters.categorie) return false;
    if (filters.modePaiement && t.modePaiement !== filters.modePaiement) return false;
    if (filters.dateDebut && t.date < filters.dateDebut) return false;
    if (filters.dateFin && t.date > filters.dateFin) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matchNum = t.numeroPiece.toLowerCase().includes(q);
      const matchLib = t.libelle.toLowerCase().includes(q);
      const matchBen = t.beneficiaire.toLowerCase().includes(q);
      if (!matchNum && !matchLib && !matchBen) return false;
    }
    return true;
  });

  const totalFilteredRecettes = filtered
    .filter(t => t.type === 'RECETTE')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalFilteredDepenses = filtered
    .filter(t => t.type === 'DEPENSE')
    .reduce((sum, t) => sum + t.montant, 0);

  const soldeFilteredNet = totalFilteredRecettes - totalFilteredDepenses;

  const exportCSV = () => {
    const headers = ['N Piece', 'Type', 'Date', 'Libelle', 'Montant (MGA)', 'Categorie', 'Beneficiaire', 'Mode Reglement', 'Statut'];
    const rows = filtered.map(t => [
      t.numeroPiece,
      t.type,
      t.date,
      `"${t.libelle.replace(/"/g, '""')}"`,
      t.montant,
      `"${t.categorie}"`,
      `"${t.beneficiaire.replace(/"/g, '""')}"`,
      t.modePaiement,
      t.statut
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `memoire_caisse_salfa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            FEN_MEMOIRE_DE_CAISSE
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Mémoire & Journal Général de Caisse</h2>
          <p className="text-xs text-slate-300">
            Historique complet des mouvements comptables, filtres multi-critères et exportation CSV/Excel.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exporter Journal (CSV)
          </button>

          <button
            onClick={() => onNavigateTab('saisie')}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Saisie
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-teal-800">
            <SlidersHorizontal className="w-4 h-4 text-teal-600" />
            Filtres du Journal Comptable
          </span>
          <button
            onClick={() => setFilters({
              searchQuery: '',
              type: 'TOUS',
              categorie: '',
              modePaiement: '',
              dateDebut: '',
              dateFin: ''
            })}
            className="text-slate-400 hover:text-slate-600 font-normal lowercase hover:underline"
          >
            réinitialiser filtres
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Search */}
          <div className="xl:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher pièce, libellé, tiers..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Type */}
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as FilterState['type'] })}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
          >
            <option value="TOUS">Tous les types</option>
            <option value="RECETTE">Encaissements (Recettes)</option>
            <option value="DEPENSE">Décaissements (Dépenses)</option>
          </select>

          {/* Categorie */}
          <select
            value={filters.categorie}
            onChange={(e) => setFilters({ ...filters, categorie: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
          >
            <option value="">Toutes catégories</option>
            {uniqueCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date Début */}
          <div>
            <input
              type="date"
              value={filters.dateDebut}
              onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Date Fin */}
          <div>
            <input
              type="date"
              value={filters.dateFin}
              onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Filter Summary Stats Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-4">
            <span className="text-slate-500 font-medium">
              Résultats: <strong className="text-slate-900">{filtered.length}</strong> ligne(s)
            </span>
            <span className="text-emerald-600 font-semibold">
              Total Encaissements: {formatCurrencyMGA(totalFilteredRecettes)}
            </span>
            <span className="text-rose-600 font-semibold">
              Total Décaissements: {formatCurrencyMGA(totalFilteredDepenses)}
            </span>
          </div>

          <div className="bg-slate-100 px-3 py-1 rounded-lg text-slate-800 font-bold">
            Flux Net Filtré: {formatCurrencyMGA(soldeFilteredNet)}
          </div>
        </div>
      </div>

      {/* Journal Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="p-3.5 pl-5">N° Pièce</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Libellé / Motif</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5">Bénéficiaire / Tiers</th>
                <th className="p-3.5">Règlement</th>
                <th className="p-3.5 text-right">Montant (MGA)</th>
                <th className="p-3.5 text-center pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length > 0 ? (
                filtered.map((t) => {
                  const isRecette = t.type === 'RECETTE';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-mono font-bold text-slate-900">
                        {t.numeroPiece}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isRecette ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-500 font-medium">
                        {t.date}
                      </td>
                      <td className="p-3.5 max-w-sm">
                        <div className="font-semibold text-slate-900 truncate" title={t.libelle}>
                          {t.libelle}
                        </div>
                        <div className="text-[10px] text-slate-400 italic truncate">
                          {t.montantEnLettres}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                          {t.categorie}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">
                        {t.beneficiaire}
                      </td>
                      <td className="p-3.5">
                        <span className="text-slate-600 text-[11px]">
                          {t.modePaiement}
                        </span>
                      </td>
                      <td className={`p-3.5 text-right font-bold whitespace-nowrap text-sm ${
                        isRecette ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isRecette ? '+' : '-'}{formatCurrencyMGA(t.montant)}
                      </td>
                      <td className="p-3.5 text-center pr-5 whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onShowReceipt(t)}
                            title="Voir Reçu de Caisse"
                            className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Confirmer la suppression de la pièce ${t.numeroPiece} ?`)) {
                                onDeleteTransaction(t.id);
                              }
                            }}
                            title="Supprimer la pièce"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Aucune transaction trouvée dans le mémoire de caisse.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

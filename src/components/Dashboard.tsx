import React, { useState } from 'react';
import { 
  CaisseTransaction, 
  DemandeFonds, 
  ActiveTab, 
  FilterState 
} from '../types';
import { formatCurrencyMGA } from '../utils/numberToWords';
import { 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Clock, 
  Lock, 
  Search, 
  SlidersHorizontal,
  FileCheck,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface DashboardProps {
  transactions: CaisseTransaction[];
  demandes: DemandeFonds[];
  initialBalance: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectTransactionReceipt: (tx: CaisseTransaction) => void;
}

const CATEGORY_COLORS = ['#0d9488', '#0284c7', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  demandes,
  initialBalance,
  onNavigateTab,
  onSelectTransactionReceipt
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    type: 'TOUS',
    categorie: '',
    modePaiement: '',
    dateDebut: '',
    dateFin: ''
  });

  // Calculate totals
  const totalRecettes = transactions
    .filter(t => t.type === 'RECETTE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalDepenses = transactions
    .filter(t => t.type === 'DEPENSE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const soldeActuel = initialBalance + totalRecettes - totalDepenses;

  const pendingDemandes = demandes.filter(d => d.statut === 'En attente');
  const pendingDemandesAmount = pendingDemandes.reduce((sum, d) => sum + d.montant, 0);

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    if (filters.type !== 'TOUS' && t.type !== filters.type) return false;
    if (filters.categorie && t.categorie !== filters.categorie) return false;
    if (filters.modePaiement && t.modePaiement !== filters.modePaiement) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matchNum = t.numeroPiece.toLowerCase().includes(q);
      const matchLib = t.libelle.toLowerCase().includes(q);
      const matchBen = t.beneficiaire.toLowerCase().includes(q);
      if (!matchNum && !matchLib && !matchBen) return false;
    }
    return true;
  });

  // Prepare chart data - Monthly comparison
  const monthlyData = [
    { name: 'Mai', Recettes: 12500000, Dépenses: 8400000 },
    { name: 'Juin', Recettes: 14200000, Dépenses: 9800000 },
    { name: 'Juillet', Recettes: 18500000, Dépenses: 11200000 },
    { name: 'Août (Enc.)', Recettes: totalRecettes, Dépenses: totalDepenses }
  ];

  // Prepare chart data - Category breakdown for expenses
  const categoryMap: { [key: string]: number } = {};
  transactions
    .filter(t => t.type === 'DEPENSE')
    .forEach(t => {
      categoryMap[t.categorie] = (categoryMap[t.categorie] || 0) + t.montant;
    });

  const categoryPieData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value
  }));

  const uniqueCategories = Array.from(new Set(transactions.map(t => t.categorie)));

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-teal-500/20 text-teal-300 text-xs px-2.5 py-1 rounded-full border border-teal-500/30 font-semibold">
              Module Principale - FEN_GESTION_DE_CAISSE
            </span>
            <span className="text-xs text-slate-400">
              Session Active
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Tableau de Bord Caisse SALFA</h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Aperçu en temps réel des encaissements, décaissements, solde disponible et état des demandes de caisse.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('saisie')}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Nouvelle Saisie
          </button>
          <button
            onClick={() => onNavigateTab('demandes')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all flex items-center gap-2"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            Demande de Caisse
          </button>
          <button
            onClick={() => onNavigateTab('cloture')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-teal-400" />
            Clôture
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde Caisse Espèces */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-teal-600" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Solde Espèces Actuel</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrencyMGA(soldeActuel)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Solde initial: {formatCurrencyMGA(initialBalance)}</span>
            <span className="text-teal-600 font-semibold text-[11px]">En Caisse</span>
          </div>
        </div>

        {/* Total Recettes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Encaissements</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrencyMGA(totalRecettes)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Recettes validées</span>
            <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Entrées
            </span>
          </div>
        </div>

        {/* Total Dépenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Dépenses</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600 tracking-tight">
            {formatCurrencyMGA(totalDepenses)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Décaissements validés</span>
            <span className="text-rose-600 font-semibold text-[11px]">Sorties</span>
          </div>
        </div>

        {/* Demandes de Caisse en attente */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Demandes en Attente</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 tracking-tight flex items-baseline gap-2">
            <span>{pendingDemandes.length}</span>
            <span className="text-xs text-slate-400 font-normal">demande(s)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Montant cumulé:</span>
            <span className="font-bold text-slate-700">{formatCurrencyMGA(pendingDemandesAmount)}</span>
          </div>
        </div>
      </div>

      {/* Analytics Visuals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - Recettes vs Dépenses */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Évolution Mensuelle Caisse</h3>
              <p className="text-xs text-slate-500">Comparatif des encaissements et décaissements (MGA)</p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Recettes
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Dépenses
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val / 1000000}M`}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrencyMGA(value), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Recettes" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Dépenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Expense categories */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Répartition des Dépenses</h3>
            <p className="text-xs text-slate-500">Par catégorie budgétaire</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                  >
                    {categoryPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [formatCurrencyMGA(value), '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Aucune donnée de dépense</div>
            )}
          </div>

          <div className="space-y-1.5 max-h-28 overflow-y-auto text-xs pr-1">
            {categoryPieData.map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} 
                  />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="font-semibold text-slate-900 shrink-0">{formatCurrencyMGA(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Transactions Log / REQ_CAISSE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Derniers Mouvements de Caisse</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-semibold">
                  {filteredTransactions.length} enregistrement(s)
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Requête REQ_CAISE_TRIEE - Liste filtrable des encaissements & décaissements
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('memoire')}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 hover:underline self-start sm:self-auto"
            >
              Voir le journal complet (Mémoire) →
            </button>
          </div>

          {/* Search Bar & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher pièce, libellé, tiers..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as FilterState['type'] })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="TOUS">Tous les types (Recettes & Dépenses)</option>
              <option value="RECETTE">Encaissements (Recettes)</option>
              <option value="DEPENSE">Décaissements (Dépenses)</option>
            </select>

            {/* Category Filter */}
            <select
              value={filters.categorie}
              onChange={(e) => setFilters({ ...filters, categorie: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="">Toutes les catégories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Payment Mode Filter */}
            <select
              value={filters.modePaiement}
              onChange={(e) => setFilters({ ...filters, modePaiement: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="">Tous les modes de règlement</option>
              <option value="Espèces">Espèces</option>
              <option value="Chèque">Chèque</option>
              <option value="Virement">Virement Bancaire</option>
              <option value="Mobile Money">Mobile Money</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="p-3.5 pl-5">N° Pièce</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Libellé / Motif</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5">Tiers / Bénéficiaire</th>
                <th className="p-3.5">Règlement</th>
                <th className="p-3.5 text-right">Montant (Ar)</th>
                <th className="p-3.5 text-center pr-5">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => {
                  const isRecette = t.type === 'RECETTE';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-mono font-semibold text-slate-900">
                        {t.numeroPiece}
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <div className="font-medium text-slate-900 truncate" title={t.libelle}>
                          {t.libelle}
                        </div>
                        <div className="text-[10px] text-slate-400 italic truncate">
                          {t.montantEnLettres}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200">
                          {t.categorie}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">
                        {t.beneficiaire}
                      </td>
                      <td className="p-3.5">
                        <span className="flex items-center gap-1 text-slate-600 text-[11px]">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {t.modePaiement}
                        </span>
                      </td>
                      <td className={`p-3.5 text-right font-bold whitespace-nowrap text-sm ${
                        isRecette ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isRecette ? '+' : '-'}{formatCurrencyMGA(t.montant)}
                      </td>
                      <td className="p-3.5 text-center pr-5 whitespace-nowrap">
                        <button
                          onClick={() => onSelectTransactionReceipt(t)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 mx-auto"
                        >
                          <FileCheck className="w-3 h-3 text-teal-600" />
                          Reçu
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Aucun mouvement de caisse trouvé pour ces critères de recherche.
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

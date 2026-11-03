import React from 'react';
import { User } from '../types';
import { 
  Building2, 
  UserCircle, 
  ShieldCheck, 
  Download, 
  Upload, 
  Calendar, 
  RefreshCw,
  Wallet
} from 'lucide-react';
import { exportFullDatabaseJSON, importFullDatabaseJSON } from '../utils/storage';

interface HeaderProps {
  currentUser: User;
  onOpenLoginModal: () => void;
  onDataRefresh: () => void;
  currentBalance: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenLoginModal,
  onDataRefresh,
  currentBalance
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const jsonStr = exportFullDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_caisse_salfa_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importFullDatabaseJSON(content);
        if (success) {
          alert('Base de données CAISSE SALFA restaurée avec succès !');
          onDataRefresh();
        } else {
          alert('Erreur lors de l importation du fichier JSON.');
        }
      }
    };
    reader.readAsText(file);
  };

  const formattedDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md font-bold text-xl tracking-wider">
            S
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CAISSE SALFA
              </h1>
              <span className="bg-teal-500/20 text-teal-300 text-xs px-2 py-0.5 rounded font-medium border border-teal-500/30">
                v25.0 Web
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              Sampan'i Asa Loterana momba ny Fahasalamana
            </p>
          </div>
        </div>

        {/* Center Live Balance Pill */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 rounded-full px-4 py-1.5">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400">Solde Caisse Espèces:</span>
          <span className="text-sm font-bold text-emerald-400">
            {new Intl.NumberFormat('fr-MG').format(currentBalance)} Ar
          </span>
        </div>

        {/* Right Info & Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
            <span className="capitalize">{formattedDate}</span>
          </div>

          {/* Backup / Restore */}
          <div className="flex items-center space-x-1 border-r border-slate-800 pr-3">
            <button
              onClick={handleExport}
              title="Sauvegarder la base de données (Export JSON)"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Sauvegarder</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Restaurer la base de données (Import JSON)"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
            >
              <Upload className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Restaurer</span>
            </button>
          </div>

          {/* User Badge */}
          <button
            onClick={onOpenLoginModal}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition-all text-xs"
          >
            <UserCircle className="w-5 h-5 text-teal-400" />
            <div className="text-left hidden sm:block">
              <div className="font-semibold text-white leading-none">{currentUser.name}</div>
              <div className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" />
                {currentUser.role}
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

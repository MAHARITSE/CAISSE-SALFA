import React from 'react';
import { ActiveTab } from '../types';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Clock, 
  Users, 
  Building, 
  Lock, 
  Printer,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  pendingDemandesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingDemandesCount
}) => {
  const menuItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Tableau de Bord',
      subLabel: 'Vue d ensemble caisse',
      icon: LayoutDashboard,
    },
    {
      id: 'saisie' as ActiveTab,
      label: 'Saisie de Caisse',
      subLabel: 'Recette & Dépense',
      icon: PlusCircle,
    },
    {
      id: 'memoire' as ActiveTab,
      label: 'Mémoire de Caisse',
      subLabel: 'Journal comptable',
      icon: FileText,
    },
    {
      id: 'demandes' as ActiveTab,
      label: 'Demandes de Fonds',
      subLabel: 'Avances & Validation',
      icon: Clock,
      badge: pendingDemandesCount > 0 ? pendingDemandesCount : null
    },
    {
      id: 'beneficiaires' as ActiveTab,
      label: 'Bénéficiaires & Tiers',
      subLabel: 'Fournisseurs & Agents',
      icon: Users,
    },
    {
      id: 'banque' as ActiveTab,
      label: 'Banque & Virements',
      subLabel: 'Comptes & Ordres',
      icon: Building,
    },
    {
      id: 'cloture' as ActiveTab,
      label: 'Clôture & Billetage',
      subLabel: 'Comptage physique',
      icon: Lock,
    },
    {
      id: 'rapports' as ActiveTab,
      label: 'États & Impression',
      subLabel: 'Rapports officiels',
      icon: Printer,
    },
  ];

  return (
    <aside className="w-full lg:w-64 bg-white border-r border-slate-200/80 shrink-0 flex flex-col justify-between">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Modules Caisse SALFA
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-teal-600 text-white font-medium shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <div className="truncate">
                    <div className="text-sm font-semibold truncate leading-tight">{item.label}</div>
                    <div className={`text-[11px] truncate ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>
                      {item.subLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-white translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'}`} />
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-900 space-y-1">
          <div className="font-semibold flex items-center gap-1 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mode En Ligne Local
          </div>
          <p className="text-[11px] text-emerald-700/90 leading-relaxed">
            Toutes les transactions sont synchronisées avec le registre local de caisse.
          </p>
        </div>
      </div>
    </aside>
  );
};

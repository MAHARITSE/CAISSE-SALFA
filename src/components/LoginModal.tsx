import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { X, ShieldCheck, UserCheck, KeyRound } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectUser: (user: User) => void;
}

const PRESET_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Andriamanitra Hasina',
    username: 'caissier.salfa',
    role: 'caissier'
  },
  {
    id: 'usr-2',
    name: 'Rasoanaivo Nirina',
    username: 'comptable.salfa',
    role: 'comptable'
  },
  {
    id: 'usr-3',
    name: 'Dr. Rakotonirina Alain',
    username: 'admin.salfa',
    role: 'administrateur'
  }
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [customName, setCustomName] = useState(currentUser.name);

  if (!isOpen) return null;

  const handleApply = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onSelectUser({
      id: `usr-custom-${Date.now()}`,
      name: customName.trim(),
      username: customName.toLowerCase().replace(/\s+/g, '.'),
      role: selectedRole
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Connexion Utilisateur</h3>
              <p className="text-xs text-slate-400">FEN_CONNEXION - Session SALFA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sélectionner un Profil Pré-configuré
            </label>
            <div className="space-y-2">
              {PRESET_USERS.map((usr) => {
                const isCurrent = currentUser.id === usr.id;
                return (
                  <button
                    key={usr.id}
                    onClick={() => handleApply(usr)}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'border-teal-600 bg-teal-50/60 text-teal-950 font-medium shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        usr.role === 'administrateur' ? 'bg-purple-100 text-purple-700' :
                        usr.role === 'comptable' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {usr.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{usr.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{usr.role} ({usr.username})</div>
                      </div>
                    </div>
                    {isCurrent && <UserCheck className="w-5 h-5 text-teal-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-semibold">Ou personnaliser</span>
            </div>
          </div>

          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom d utilisateur / Nom Complet
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: Raveloson Jean"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rôle & Privilèges
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="caissier">Caissier (Saisie & Mouvements)</option>
                <option value="comptable">Comptable (Virements & Clôture)</option>
                <option value="administrateur">Administrateur (Tous droits)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                Valider Session
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { DemandeFonds, UrgencyLevel, DemandeStatus, CaisseTransaction } from '../types';
import { formatCurrencyMGA, numberToWordsMGA } from '../utils/numberToWords';
import { 
  Clock, 
  PlusCircle, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  User, 
  Building, 
  Check, 
  X,
  ArrowRight
} from 'lucide-react';

interface DemandesFondsProps {
  demandes: DemandeFonds[];
  onAddDemande: (demande: DemandeFonds) => void;
  onUpdateDemandeStatus: (id: string, status: DemandeStatus, approvedBy?: string) => void;
  onConvertToTransaction: (demande: DemandeFonds) => void;
}

const DEPARTEMENTS = [
  'Direction Générale',
  'Service Pédiatrie',
  'Service Maternité & Chirurgie',
  'Service Pharmacie',
  'Laboratoire & Imagerie',
  'Consultations Externe',
  'Maintenance & Logistique',
  'Service Informatique'
];

export const DemandesFonds: React.FC<DemandesFondsProps> = ({
  demandes,
  onAddDemande,
  onUpdateDemandeStatus,
  onConvertToTransaction
}) => {
  const [showModal, setShowModal] = useState(false);
  const [demandeur, setDemandeur] = useState('');
  const [departement, setDepartement] = useState(DEPARTEMENTS[0]);
  const [motif, setMotif] = useState('');
  const [montantStr, setMontantStr] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Normale');

  const montantNum = parseFloat(montantStr) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demandeur.trim() || !motif.trim() || montantNum <= 0) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const year = new Date().getFullYear();
    const nextCode = `DEM-${year}-${(demandes.length + 1).toString().padStart(3, '0')}`;

    const newDem: DemandeFonds = {
      id: `dem-${Date.now()}`,
      codeDemande: nextCode,
      date: new Date().toISOString().slice(0, 10),
      demandeur: demandeur.trim(),
      departement,
      motif: motif.trim(),
      montant: montantNum,
      urgency,
      statut: 'En attente'
    };

    onAddDemande(newDem);
    setShowModal(false);

    // Reset
    setDemandeur('');
    setMotif('');
    setMontantStr('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            FEN_DEMANDE
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Gestion des Demandes de Caisse</h2>
          <p className="text-xs text-slate-300">
            Soumission, validation hiérarchique et décaissement des avances de fonds pour services SALFA.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Nouvelle Demande de Caisse
        </button>
      </div>

      {/* Demandes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demandes.length > 0 ? (
          demandes.map((dem) => {
            const isPending = dem.statut === 'En attente';
            const isApproved = dem.statut === 'Approuvé';
            const isSettled = dem.statut === 'Liquidé';
            const isRejected = dem.statut === 'Rejeté';

            return (
              <div
                key={dem.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {dem.codeDemande}
                    </span>

                    <div className="flex items-center space-x-1">
                      {dem.urgency === 'Très Urgente' && (
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          Très Urgente
                        </span>
                      )}
                      {dem.urgency === 'Urgente' && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Urgente
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        isSettled ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {dem.statut}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {formatCurrencyMGA(dem.montant)}
                    </div>
                    <div className="text-[11px] text-slate-400 italic leading-tight mt-0.5">
                      {numberToWordsMGA(dem.montant)}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      <span>{dem.demandeur}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dem.departement}</span>
                    </div>
                    <p className="text-slate-700 pt-1 line-clamp-2" title={dem.motif}>
                      <strong>Motif:</strong> {dem.motif}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">{dem.date}</span>

                  {isPending && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onUpdateDemandeStatus(dem.id, 'Rejeté')}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Rejeter
                      </button>
                      <button
                        onClick={() => onUpdateDemandeStatus(dem.id, 'Approuvé', 'Directeur Financier')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approuver
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => onConvertToTransaction(dem)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors flex items-center gap-1"
                    >
                      Décasser (Saisir)
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isSettled && (
                    <span className="text-purple-700 font-semibold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mouvement enregistré
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            Aucune demande de caisse enregistrée.
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Nouvelle Demande de Fonds</h3>
                <p className="text-xs text-slate-400">Demande d avance de trésorerie / petite caisse</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Demandeur (Nom complet & Qualité) *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Randrianarisoa Mireille"
                  value={demandeur}
                  onChange={(e) => setDemandeur(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Département / Service *
                  </label>
                  <select
                    value={departement}
                    onChange={(e) => setDepartement(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {DEPARTEMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Degré d Urgence
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Normale">Normale</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Très Urgente">Très Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Montant Sollicité (Ariary MGA) *
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="Ex: 850000"
                  value={montantStr}
                  onChange={(e) => setMontantStr(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
                {montantNum > 0 && (
                  <p className="text-[11px] text-teal-700 font-medium italic mt-1">
                    {numberToWordsMGA(montantNum)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motif & Justification de la dépense *
                </label>
                <textarea
                  rows={3}
                  placeholder="Expliquer la nécessité de la demande d avance..."
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  Soumettre la Demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

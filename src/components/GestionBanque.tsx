import React, { useState } from 'react';
import { CompteBancaire, OrdreVirement, Beneficiaire } from '../types';
import { formatCurrencyMGA, numberToWordsMGA } from '../utils/numberToWords';
import { 
  Building, 
  Building2, 
  PlusCircle, 
  CreditCard, 
  FileCheck, 
  ArrowRight, 
  X, 
  Check, 
  Printer, 
  Send 
} from 'lucide-react';

interface GestionBanqueProps {
  banques: CompteBancaire[];
  virements: OrdreVirement[];
  beneficiaires: Beneficiaire[];
  onAddBanque: (banque: CompteBancaire) => void;
  onAddVirement: (virement: OrdreVirement) => void;
  onPrintVirement: (virement: OrdreVirement) => void;
}

export const GestionBanque: React.FC<GestionBanqueProps> = ({
  banques,
  virements,
  beneficiaires,
  onAddBanque,
  onAddVirement,
  onPrintVirement
}) => {
  const [showVirementModal, setShowVirementModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // New Virement Form
  const [compteSourceId, setCompteSourceId] = useState(banques[0]?.id || '');
  const [beneficiaireId, setBeneficiaireId] = useState(beneficiaires[0]?.id || '');
  const [montantStr, setMontantStr] = useState('');
  const [motif, setMotif] = useState('');
  const [referencePaiement, setReferencePaiement] = useState('');

  // New Bank Account Form
  const [nomBanque, setNomBanque] = useState('');
  const [numeroCompte, setNumeroCompte] = useState('');
  const [titulaire, setTitulaire] = useState('SAMPAN I ASA LOTERANA MOMBA NY FAHASALAMA (SALFA)');
  const [soldeInitStr, setSoldeInitStr] = useState('');

  const montantNum = parseFloat(montantStr) || 0;

  const handleVirementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compteSourceId || !beneficiaireId || montantNum <= 0 || !motif.trim()) {
      alert('Veuillez remplir correctement tous les champs de l ordre de virement.');
      return;
    }

    const year = new Date().getFullYear();
    const nextCode = `VIR-${year}-${(virements.length + 1).toString().padStart(3, '0')}`;

    const newVir: OrdreVirement = {
      id: `vir-${Date.now()}`,
      codeVirement: nextCode,
      dateVirement: new Date().toISOString().slice(0, 10),
      compteSourceId,
      beneficiaireId,
      montant: montantNum,
      motif: motif.trim(),
      referencePaiement: referencePaiement.trim() || `REF-${Date.now().toString().slice(-6)}`,
      statut: 'Transmis'
    };

    onAddVirement(newVir);
    setShowVirementModal(false);

    // Reset
    setMontantStr('');
    setMotif('');
    setReferencePaiement('');
  };

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomBanque.trim() || !numeroCompte.trim()) return;

    const newBank: CompteBancaire = {
      id: `bank-${Date.now()}`,
      nomBanque: nomBanque.trim(),
      numeroCompte: numeroCompte.trim(),
      titulaire: titulaire.trim(),
      rib: numeroCompte.trim().slice(0, 15),
      soldeActuel: parseFloat(soldeInitStr) || 0,
      devise: 'MGA'
    };

    onAddBanque(newBank);
    setShowBankModal(false);

    setNomBanque('');
    setNumeroCompte('');
    setSoldeInitStr('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            FEN_Table_Mabanque & FEN_Fiche_Virement
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Comptes Bancaires & Ordres de Virement</h2>
          <p className="text-xs text-slate-300">
            Gestion des comptes bancaires de l institution et émission des ordres de virement bancaires officiels.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowBankModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-teal-400" />
            Nouveau Compte
          </button>
          <button
            onClick={() => setShowVirementModal(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Créer Ordre de Virement
          </button>
        </div>
      </div>

      {/* Bank Accounts Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Building className="w-4 h-4 text-teal-600" />
          Comptes Bancaires Actifs ({banques.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banques.map((b) => (
            <div
              key={b.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-teal-600" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Titulaire: {b.titulaire}</div>
                <h4 className="text-base font-bold text-slate-900">{b.nomBanque}</h4>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700">
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">N° de Compte / RIB</div>
                <div className="font-bold text-slate-900 mt-0.5">{b.numeroCompte}</div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs text-slate-500">Solde Disponible</span>
                <span className="text-lg font-extrabold text-emerald-600">
                  {formatCurrencyMGA(b.soldeActuel)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wire Transfers Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Registre des Ordres de Virement (ETAT_Ordre_de_virement)</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                {virements.length} ordre(s)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Historique des virements bancaires émis à destination des fournisseurs et bénéficiaires
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="p-3.5 pl-5">N° Ordre</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Compte Source</th>
                <th className="p-3.5">Bénéficiaire & RIB</th>
                <th className="p-3.5">Motif / Référence</th>
                <th className="p-3.5 text-right">Montant (MGA)</th>
                <th className="p-3.5 text-center">Statut</th>
                <th className="p-3.5 text-center pr-5">Imprimer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {virements.length > 0 ? (
                virements.map((v) => {
                  const srcBank = banques.find(b => b.id === v.compteSourceId);
                  const ben = beneficiaires.find(b => b.id === v.beneficiaireId);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-mono font-bold text-slate-900">
                        {v.codeVirement}
                      </td>
                      <td className="p-3.5 text-slate-500 font-medium">
                        {v.dateVirement}
                      </td>
                      <td className="p-3.5 font-medium max-w-xs truncate">
                        {srcBank ? srcBank.nomBanque : 'Compte Inconnu'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{ben ? ben.nom : 'Inconnu'}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{ben ? ben.rib : '-'}</div>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <div className="font-medium text-slate-800 truncate" title={v.motif}>{v.motif}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {v.referencePaiement}</div>
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                        {formatCurrencyMGA(v.montant)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {v.statut}
                        </span>
                      </td>
                      <td className="p-3.5 text-center pr-5">
                        <button
                          onClick={() => onPrintVirement(v)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-600" />
                          Ordre PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Aucun ordre de virement enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Wire Transfer Modal */}
      {showVirementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Émettre un Ordre de Virement Bancaire</h3>
                <p className="text-xs text-slate-400">FEN_Fiche_Virement - Salfa Banking</p>
              </div>
              <button onClick={() => setShowVirementModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVirementSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Compte Bancaire Source (SALFA) *
                </label>
                <select
                  value={compteSourceId}
                  onChange={(e) => setCompteSourceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                >
                  {banques.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nomBanque} (Solde: {formatCurrencyMGA(b.soldeActuel)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bénéficiaire du Virement *
                </label>
                <select
                  value={beneficiaireId}
                  onChange={(e) => setBeneficiaireId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                >
                  {beneficiaires.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nom} ({b.banque} - {b.rib})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Montant du Virement (Ariary MGA) *
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="Ex: 3400000"
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
                  Motif du Virement / Explication *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Règlement facture N° 2026-0811 équipement radiologie"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Référence interne de Paiement
                </label>
                <input
                  type="text"
                  placeholder="Ex: REF-MEDTECH-2026-08"
                  value={referencePaiement}
                  onChange={(e) => setReferencePaiement(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowVirementModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Générer Ordre de Virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Ajouter un Compte Bancaire</h3>
                <p className="text-xs text-slate-400">FEN_Fiche_Mabanque - Salfa Banking</p>
              </div>
              <button onClick={() => setShowBankModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBankSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom de la Banque & Libellé Compte *
                </label>
                <input
                  type="text"
                  placeholder="Ex: BNI MADAGASCAR - Compte Principal"
                  value={nomBanque}
                  onChange={(e) => setNomBanque(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  N° de Compte / RIB Complete *
                </label>
                <input
                  type="text"
                  placeholder="Ex: 00002 01001 12345678901 22"
                  value={numeroCompte}
                  onChange={(e) => setNumeroCompte(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Titulaire Officiel du Compte
                </label>
                <input
                  type="text"
                  value={titulaire}
                  onChange={(e) => setTitulaire(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Solde Initial (Ariary MGA)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 25000000"
                  value={soldeInitStr}
                  onChange={(e) => setSoldeInitStr(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4" />
                  Enregistrer Compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Beneficiaire, BeneficiaireType, CaisseTransaction } from '../types';
import { formatCurrencyMGA } from '../utils/numberToWords';
import { 
  Users, 
  PlusCircle, 
  Search, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  FileText, 
  X, 
  Check, 
  ArrowUpRight 
} from 'lucide-react';

interface BeneficiairesProps {
  beneficiaires: Beneficiaire[];
  transactions: CaisseTransaction[];
  onAddBeneficiaire: (beneficiaire: Beneficiaire) => void;
  onSelectForSaisie?: (nom: string) => void;
}

export const Beneficiaires: React.FC<BeneficiairesProps> = ({
  beneficiaires,
  transactions,
  onAddBeneficiaire,
  onSelectForSaisie
}) => {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('TOUS');
  const [showModal, setShowModal] = useState(false);
  const [selectedBenDetails, setSelectedBenDetails] = useState<Beneficiaire | null>(null);

  // Form states
  const [nom, setNom] = useState('');
  const [type, setType] = useState<BeneficiaireType>('Fournisseur');
  const [cinOuNif, setCinOuNif] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [banque, setBanque] = useState('BNI MADAGASCAR');
  const [rib, setRib] = useState('');

  const filtered = beneficiaires.filter(b => {
    if (selectedType !== 'TOUS' && b.type !== selectedType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchNom = b.nom.toLowerCase().includes(q);
      const matchCin = b.cinOuNif.toLowerCase().includes(q);
      const matchTel = b.telephone.toLowerCase().includes(q);
      if (!matchNom && !matchCin && !matchTel) return false;
    }
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;

    const newBen: Beneficiaire = {
      id: `ben-${Date.now()}`,
      nom: nom.trim(),
      type,
      cinOuNif: cinOuNif.trim() || 'N/A',
      telephone: telephone.trim() || 'N/A',
      email: email.trim() || 'N/A',
      adresse: adresse.trim() || 'Antananarivo, Madagascar',
      banque,
      rib: rib.trim() || 'N/A',
      soldeTotalTransact: 0,
      nombreTransactions: 0
    };

    onAddBeneficiaire(newBen);
    setShowModal(false);

    // Reset
    setNom('');
    setCinOuNif('');
    setTelephone('');
    setEmail('');
    setAdresse('');
    setRib('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            FEN_Table_Beneficiaires
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Répertoire des Bénéficiaires & Tiers</h2>
          <p className="text-xs text-slate-300">
            Gestion des fiches fournisseurs, membres du personnel, prestataires et partenaires SALFA.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Nouveau Bénéficiaire
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par nom, NIF/STAT, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto">
          {['TOUS', 'Fournisseur', 'Personnel', 'Organisme', 'Patient'].map(typeBtn => (
            <button
              key={typeBtn}
              onClick={() => setSelectedType(typeBtn)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                selectedType === typeBtn
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {typeBtn}
            </button>
          ))}
        </div>
      </div>

      {/* Beneficiaries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length > 0 ? (
          filtered.map((b) => {
            // Find transactions for this beneficiary
            const benTx = transactions.filter(t => t.beneficiaire.toLowerCase() === b.nom.toLowerCase());
            const totalTransacted = benTx.reduce((sum, t) => sum + t.montant, 0);

            return (
              <div
                key={b.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {b.type}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{b.nom}</h3>
                      <p className="text-xs text-slate-400 font-mono">CIN/NIF: {b.cinOuNif}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{b.telephone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{b.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate font-mono text-[11px]">{b.banque}: {b.rib}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Volume réglé</div>
                    <div className="font-bold text-slate-900">{formatCurrencyMGA(totalTransacted)}</div>
                  </div>

                  <button
                    onClick={() => setSelectedBenDetails(b)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors"
                  >
                    Fiche Détails
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            Aucun bénéficiaire correspondant dans le répertoire.
          </div>
        )}
      </div>

      {/* New Beneficiary Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Nouveau Bénéficiaire / Tiers</h3>
                <p className="text-xs text-slate-400">FEN_Fiche_Beneficiaires - Création de tiers</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom / Raison Sociale *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pharmacie Centrale Anosy"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type de Tiers
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as BeneficiaireType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Fournisseur">Fournisseur</option>
                    <option value="Personnel">Membres du Personnel</option>
                    <option value="Organisme">Organisme / Partenaire</option>
                    <option value="Patient">Patient / Client</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CIN / NIF & STAT
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2001984711"
                    value={cinOuNif}
                    onChange={(e) => setCinOuNif(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    placeholder="+261 34 00 000 00"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="contact@exemple.mg"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse physique
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lot II A 14 Analakely, Antananarivo"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Banque principale
                  </label>
                  <select
                    value={banque}
                    onChange={(e) => setBanque(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="BNI MADAGASCAR">BNI MADAGASCAR</option>
                    <option value="BANK OF AFRICA">BANK OF AFRICA (BOA)</option>
                    <option value="SOCIETE GENERALE MG">SOCIETE GENERALE MG</option>
                    <option value="MCB MADAGASCAR">MCB MADAGASCAR</option>
                    <option value="ACCESS BANK">ACCESS BANK</option>
                    <option value="AUTRE">AUTRE BANQUE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    RIB / N° de Compte
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 00002 01001 00012345678 45"
                    value={rib}
                    onChange={(e) => setRib(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
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
                  <Check className="w-4 h-4" />
                  Enregistrer le Bénéficiaire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal (FEN_Vision_Beneficiaires) */}
      {selectedBenDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider bg-teal-500/20 px-2 py-0.5 rounded">
                  FEN_Vision_Beneficiaires
                </span>
                <h3 className="text-base font-bold mt-1">{selectedBenDetails.nom}</h3>
              </div>
              <button onClick={() => setSelectedBenDetails(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 uppercase text-[10px] font-bold">Type Tiers</div>
                  <div className="font-bold text-slate-800 text-sm">{selectedBenDetails.type}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 uppercase text-[10px] font-bold">CIN / NIF-STAT</div>
                  <div className="font-mono font-bold text-slate-800 text-sm">{selectedBenDetails.cinOuNif}</div>
                </div>
              </div>

              <div className="space-y-2 text-xs border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-teal-600" />
                  <strong>Téléphone:</strong> {selectedBenDetails.telephone}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-teal-600" />
                  <strong>Email:</strong> {selectedBenDetails.email}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <strong>Adresse:</strong> {selectedBenDetails.adresse}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  <strong>Coordonnées Bancaires:</strong> {selectedBenDetails.banque} ({selectedBenDetails.rib})
                </div>
              </div>

              {/* Transactions History for this beneficiary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Mouvements enregistrés pour ce tiers
                </h4>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {transactions.filter(t => t.beneficiaire.toLowerCase() === selectedBenDetails.nom.toLowerCase()).map(t => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-mono font-bold">{t.numeroPiece} - {t.date}</div>
                        <div className="text-slate-500 text-[11px] truncate max-w-xs">{t.libelle}</div>
                      </div>
                      <div className="font-bold text-slate-900">{formatCurrencyMGA(t.montant)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedBenDetails(null)}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

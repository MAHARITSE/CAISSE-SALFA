import React, { useState, useEffect } from 'react';
import { 
  CaisseTransaction, 
  TransactionType, 
  PaymentMode, 
  Beneficiaire, 
  CompteBancaire 
} from '../types';
import { numberToWordsMGA, formatCurrencyMGA } from '../utils/numberToWords';
import { 
  PlusCircle, 
  MinusCircle, 
  CheckCircle2, 
  FileText, 
  Coins, 
  Building2, 
  CreditCard, 
  Calendar, 
  User, 
  Tag, 
  AlertCircle 
} from 'lucide-react';

interface SaisieCaisseProps {
  transactions: CaisseTransaction[];
  beneficiaires: Beneficiaire[];
  banques: CompteBancaire[];
  onAddTransaction: (transaction: CaisseTransaction) => void;
  onShowReceipt: (tx: CaisseTransaction) => void;
}

const CATEGORIES_RECETTE = [
  'Consultations & Soins',
  'Pharmacie & Médicaments',
  'Laboratoire & Analyses',
  'Hospitalisation & Maternité',
  'Subventions & Projets',
  'Vente Matériel Médical',
  'Divers Encaissements'
];

const CATEGORIES_DEPENSE = [
  'Pharmacie & Médicaments',
  'Fournitures de bureau',
  'Carburant & Transport',
  'Maintenance & Équipements',
  'Salaires & Primes',
  'Frais de mission',
  'Honoraires Médecins',
  'Consommables Médicaux',
  'Eau & Électricité',
  'Divers Décaissements'
];

export const SaisieCaisse: React.FC<SaisieCaisseProps> = ({
  transactions,
  beneficiaires,
  banques,
  onAddTransaction,
  onShowReceipt
}) => {
  const [type, setType] = useState<TransactionType>('RECETTE');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [libelle, setLibelle] = useState<string>('');
  const [montantStr, setMontantStr] = useState<string>('');
  const [categorie, setCategorie] = useState<string>('');
  const [beneficiaire, setBeneficiaire] = useState<string>('');
  const [modePaiement, setModePaiement] = useState<PaymentMode>('Espèces');
  const [compteBanqueId, setCompteBanqueId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Auto-generate voucher number
  const generateNumeroPiece = (txType: TransactionType): string => {
    const prefix = txType === 'RECETTE' ? 'REC' : 'DEP';
    const year = new Date().getFullYear();
    const existing = transactions.filter(t => t.type === txType);
    const nextSeq = existing.length + 1;
    const seqPadded = nextSeq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqPadded}`;
  };

  const [numeroPiece, setNumeroPiece] = useState<string>(generateNumeroPiece('RECETTE'));

  useEffect(() => {
    setNumeroPiece(generateNumeroPiece(type));
    setCategorie(type === 'RECETTE' ? CATEGORIES_RECETTE[0] : CATEGORIES_DEPENSE[0]);
  }, [type, transactions]);

  const montantNum = parseFloat(montantStr) || 0;
  const montantEnLettres = numberToWordsMGA(montantNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!libelle.trim() || montantNum <= 0 || !beneficiaire.trim()) {
      alert('Veuillez remplir tous les champs obligatoires (libelle, montant > 0, bénéficiaire).');
      return;
    }

    const newTx: CaisseTransaction = {
      id: `tx-${Date.now()}`,
      numeroPiece,
      type,
      date,
      libelle: libelle.trim(),
      montant: montantNum,
      montantEnLettres,
      categorie,
      beneficiaire: beneficiaire.trim(),
      modePaiement,
      statut: 'Validé',
      compteBanqueId: modePaiement === 'Virement' ? compteBanqueId : undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    onAddTransaction(newTx);
    onShowReceipt(newTx);

    // Reset Form
    setLibelle('');
    setMontantStr('');
    setNotes('');
    setNumeroPiece(generateNumeroPiece(type));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-400 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-500/30">
            FEN_SAISIE_CAISSE
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1">Saisie d un Mouvement de Caisse</h2>
          <p className="text-xs text-slate-300">
            Enregistrement d un bon de recette (entrée) ou de dépense (sortie d espèces / banque).
          </p>
        </div>

        {/* Type Toggle Buttons */}
        <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setType('RECETTE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              type === 'RECETTE'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Recette (Entrée)
          </button>
          <button
            type="button"
            onClick={() => setType('DEPENSE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              type === 'DEPENSE'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MinusCircle className="w-4 h-4" />
            Dépense (Sortie)
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Row 1: N° Pièce, Date, Mode Règlement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              N° Pièce (Généré Automatiquement)
            </label>
            <input
              type="text"
              value={numeroPiece}
              readOnly
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-300 font-mono text-sm font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              Date d Opération
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-teal-600" />
              Mode de Règlement
            </label>
            <select
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value as PaymentMode)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="Espèces">Espèces (Caisse Physique)</option>
              <option value="Chèque">Chèque Bancaire</option>
              <option value="Virement">Virement Bancaire</option>
              <option value="Mobile Money">Mobile Money (Telma/Orange/Airtel)</option>
            </select>
          </div>
        </div>

        {/* Bank selection if Virement */}
        {modePaiement === 'Virement' && (
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 animate-in fade-in">
            <label className="block text-xs font-bold text-blue-900 flex items-center gap-1">
              <Building2 className="w-4 h-4 text-blue-600" />
              Sélectionner le Compte Bancaire SALFA
            </label>
            <select
              value={compteBanqueId}
              onChange={(e) => setCompteBanqueId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-blue-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="">-- Choisir un compte bancaire --</option>
              {banques.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nomBanque} - Solde: {formatCurrencyMGA(b.soldeActuel)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Row 2: Montant & Conversion en Lettres */}
        <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Coins className="w-4 h-4 text-emerald-600" />
                Montant de l Opération (en Ariary MGA) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="100"
                  placeholder="Ex: 250000"
                  value={montantStr}
                  onChange={(e) => setMontantStr(e.target.value)}
                  className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-slate-300 text-lg font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">
                  MGA
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Montant en toutes lettres (COL_MontantEnToutesLettres)
              </div>
              <div className="text-xs font-semibold text-slate-800 italic leading-snug">
                {montantNum > 0 ? montantEnLettres : 'Saisir un montant ci-contre...'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Libellé, Catégorie, Bénéficiaire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Libellé / Motif détaillé de l Opération *
            </label>
            <input
              type="text"
              placeholder="Ex: Achat consommables de laboratoire et réactifs médicalisés"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-teal-600" />
              Catégorie Budgétaire
            </label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              {(type === 'RECETTE' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-teal-600" />
              Tiers / Bénéficiaire / Payeur *
            </label>
            <input
              type="text"
              list="beneficiaires-list"
              placeholder="Nom du fournisseur, agent ou patient"
              value={beneficiaire}
              onChange={(e) => setBeneficiaire(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              required
            />
            <datalist id="beneficiaires-list">
              {beneficiaires.map(b => (
                <option key={b.id} value={b.nom} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Remarques / Références Justificatifs
          </label>
          <textarea
            rows={2}
            placeholder="Référence bon de commande, facture N°, autorisation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        {/* Submit Bar */}
        <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Un reçu de caisse imprimable sera automatiquement généré après validation.</span>
          </div>

          <button
            type="submit"
            className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 ${
              type === 'RECETTE'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Enregistrer le Bon de {type === 'RECETTE' ? 'Recette' : 'Dépense'}
          </button>
        </div>
      </form>
    </div>
  );
};

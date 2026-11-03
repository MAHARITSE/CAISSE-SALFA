import React from 'react';
import { 
  CaisseTransaction, 
  OrdreVirement, 
  ClotureCaisse, 
  CompteBancaire, 
  Beneficiaire,
  User 
} from '../types';
import { formatCurrencyMGA, numberToWordsMGA } from '../utils/numberToWords';
import { Printer, X, Download, Building2, CheckCircle2 } from 'lucide-react';

export type ReportType = 'RECEIPT' | 'VIREMENT' | 'CLOTURE' | 'GLOBAL_SUMMARY';

interface PrintReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  transaction?: CaisseTransaction | null;
  virement?: OrdreVirement | null;
  cloture?: ClotureCaisse | null;
  banques?: CompteBancaire[];
  beneficiaires?: Beneficiaire[];
  transactionsList?: CaisseTransaction[];
  currentUser: User;
}

export const PrintReportsModal: React.FC<PrintReportsModalProps> = ({
  isOpen,
  onClose,
  reportType,
  transaction,
  virement,
  cloture,
  banques = [],
  beneficiaires = [],
  transactionsList = [],
  currentUser
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header Modal Bar */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-white">
              Aperçu Avant Impression - Document Officiel SALFA
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimer Document
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-section" className="p-8 text-slate-900 space-y-6 bg-white font-sans text-xs">
          {/* Header SALFA Branding */}
          <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
            <div className="space-y-1">
              <div className="font-extrabold text-sm uppercase tracking-wider text-teal-800">
                SAMPAN I ASA LOTERANA MOMBA NY FAHASALAMANA
              </div>
              <div className="font-bold text-xs text-slate-700">SALFA - DIRECTION GENERALE</div>
              <div className="text-[10px] text-slate-500">B.P. 1168 - Antananarivo 101, Madagascar</div>
              <div className="text-[10px] text-slate-500">Tél: +261 20 22 234 56 | Email: salfa@salfa.mg</div>
            </div>

            <div className="text-right space-y-1">
              <div className="font-bold text-base text-slate-900 font-mono">CAISSE SALFA</div>
              <div className="text-[11px] text-slate-500">Date: {new Date().toLocaleDateString('fr-FR')}</div>
              <div className="text-[10px] text-teal-700 font-bold uppercase">Copie Officielle</div>
            </div>
          </div>

          {/* 1. REPORT TYPE: SINGLE RECEIPT */}
          {reportType === 'RECEIPT' && transaction && (
            <div className="space-y-6">
              <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-300">
                <h2 className="text-base font-extrabold uppercase tracking-wide">
                  BON DE {transaction.type === 'RECETTE' ? 'RECETTE (ENCAISSEMENT)' : 'DEPENSE (DECAISSEMENT)'}
                </h2>
                <div className="font-mono text-xs font-bold text-slate-700">
                  N° Pièce: {transaction.numeroPiece}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border p-4 rounded-xl text-xs space-y-1">
                <div>
                  <strong>Date d opération:</strong> {transaction.date}
                </div>
                <div>
                  <strong>Mode de Règlement:</strong> {transaction.modePaiement}
                </div>
                <div>
                  <strong>Catégorie Budgétaire:</strong> {transaction.categorie}
                </div>
                <div>
                  <strong>Bénéficiaire / Payeur:</strong> {transaction.beneficiaire}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div>
                  <strong>Motif / Libellé:</strong> {transaction.libelle}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-600">MONTANT TOTAL:</span>
                  <span className="text-lg font-extrabold text-slate-900 font-mono">
                    {formatCurrencyMGA(transaction.montant)}
                  </span>
                </div>
                <div className="text-xs italic text-slate-700">
                  <strong>Montant en toutes lettres:</strong> {transaction.montantEnLettres}
                </div>
              </div>

              {/* Signatures Block */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs">
                <div>
                  <div className="font-bold mb-12">Le Bénéficiaire / Payeur</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Signature</div>
                </div>
                <div>
                  <div className="font-bold mb-12">Le Caissier</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">{currentUser.name}</div>
                </div>
                <div>
                  <div className="font-bold mb-12">Le Chef Comptable</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Visa & Tampon</div>
                </div>
              </div>
            </div>
          )}

          {/* 2. REPORT TYPE: WIRE TRANSFER ORDER */}
          {reportType === 'VIREMENT' && virement && (
            <div className="space-y-6">
              <div className="text-center py-2 bg-slate-900 text-white rounded-xl">
                <h2 className="text-base font-extrabold uppercase tracking-wide">ORDRE DE VIREMENT BANCAIRE</h2>
                <div className="font-mono text-xs text-teal-300">Réf: {virement.codeVirement}</div>
              </div>

              {(() => {
                const bank = banques.find(b => b.id === virement.compteSourceId);
                const ben = beneficiaires.find(b => b.id === virement.beneficiaireId);
                return (
                  <div className="space-y-4">
                    <div className="p-4 border border-slate-300 rounded-xl space-y-2">
                      <div className="font-bold text-xs uppercase text-teal-800 border-b pb-1">COMPTE DEBITAURE (SOURCE)</div>
                      <div><strong>Banque:</strong> {bank ? bank.nomBanque : '-'}</div>
                      <div><strong>N° de Compte / RIB:</strong> {bank ? bank.numeroCompte : '-'}</div>
                      <div><strong>Titulaire:</strong> {bank ? bank.titulaire : '-'}</div>
                    </div>

                    <div className="p-4 border border-slate-300 rounded-xl space-y-2">
                      <div className="font-bold text-xs uppercase text-teal-800 border-b pb-1">COMPTE CREDITEUR (BENEFICIAIRE)</div>
                      <div><strong>Nom du Tiers:</strong> {ben ? ben.nom : '-'}</div>
                      <div><strong>Banque Bénéficiaire:</strong> {ben ? ben.banque : '-'}</div>
                      <div><strong>RIB Bénéficiaire:</strong> {ben ? ben.rib : '-'}</div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <strong>Montant du Virement:</strong>
                        <span className="text-base font-bold font-mono">{formatCurrencyMGA(virement.montant)}</span>
                      </div>
                      <div className="italic text-xs">
                        <strong>Somme en lettres:</strong> {numberToWordsMGA(virement.montant)}
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <strong>Motif de Paiement:</strong> {virement.motif}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-8 grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="font-bold mb-12">Pour la Direction Financière SALFA</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px]">Signature Autorisée</div>
                </div>
                <div>
                  <div className="font-bold mb-12">Pour la Direction Générale</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px]">Signature Autorisée & Sceau</div>
                </div>
              </div>
            </div>
          )}

          {/* 3. REPORT TYPE: CLOTURE REPORT */}
          {reportType === 'CLOTURE' && cloture && (
            <div className="space-y-6">
              <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-300">
                <h2 className="text-base font-extrabold uppercase">PROCES-VERBAL DE CLOTURE DE CAISSE ET BILLETAGE</h2>
                <div className="text-xs font-medium">Date de Clôture: {cloture.dateCloture}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 border p-4 rounded-xl">
                <div><strong>Caissier Titulaire:</strong> {cloture.caissier}</div>
                <div><strong>Statut de la Caisse:</strong> {cloture.statut}</div>
                <div><strong>Solde Initial:</strong> {formatCurrencyMGA(cloture.soldeInitial)}</div>
                <div><strong>Solde Théorique:</strong> {formatCurrencyMGA(cloture.soldeTheorique)}</div>
                <div><strong>Total Encaissements:</strong> {formatCurrencyMGA(cloture.totalRecettes)}</div>
                <div><strong>Solde Physique Constaté:</strong> {formatCurrencyMGA(cloture.soldePhysique)}</div>
                <div><strong>Total Décaissements:</strong> {formatCurrencyMGA(cloture.totalDepenses)}</div>
                <div className="font-bold text-rose-700"><strong>Écart de Caisse:</strong> {formatCurrencyMGA(cloture.ecart)}</div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="bg-slate-100 p-2 font-bold text-xs uppercase">Détails du Billetage (Comptage physique)</div>
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2">Coupure</th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2 text-right">Sous-Total (MGA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="p-2">Billet 20 000 Ar</td><td className="p-2">{cloture.billetage.b20000}</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.b20000 * 20000)}</td></tr>
                    <tr><td className="p-2">Billet 10 000 Ar</td><td className="p-2">{cloture.billetage.b10000}</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.b10000 * 10000)}</td></tr>
                    <tr><td className="p-2">Billet 5 000 Ar</td><td className="p-2">{cloture.billetage.b5000}</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.b5000 * 5000)}</td></tr>
                    <tr><td className="p-2">Billet 2 000 Ar</td><td className="p-2">{cloture.billetage.b2000}</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.b2000 * 2000)}</td></tr>
                    <tr><td className="p-2">Billet 1 000 Ar</td><td className="p-2">{cloture.billetage.b1000}</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.b1000 * 1000)}</td></tr>
                    <tr><td className="p-2">Monnaies & Pièces</td><td className="p-2">-</td><td className="p-2 text-right">{formatCurrencyMGA(cloture.billetage.pieces)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl">
                <strong>Observations:</strong> {cloture.observations}
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="font-bold mb-10">Signature du Caissier</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px]">{cloture.caissier}</div>
                </div>
                <div>
                  <div className="font-bold mb-10">Signature de l Auditeur / Comptable</div>
                  <div className="border-t border-slate-400 pt-1 text-[10px]">Chef Comptable</div>
                </div>
              </div>
            </div>
          )}

          {/* 4. REPORT TYPE: GLOBAL RECAP SUMMARY */}
          {reportType === 'GLOBAL_SUMMARY' && (
            <div className="space-y-6">
              <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-300">
                <h2 className="text-base font-extrabold uppercase">ETAT RECAPITULATIF DES MOUVEMENTS DE CAISSE</h2>
                <div className="text-xs">Extrait de compte du {new Date().toLocaleDateString('fr-FR')}</div>
              </div>

              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold border-b">
                  <tr>
                    <th className="p-2">N° Pièce</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Libellé</th>
                    <th className="p-2">Tiers</th>
                    <th className="p-2 text-right">Montant (MGA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactionsList.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 font-mono">{t.numeroPiece}</td>
                      <td className="p-2 font-bold">{t.type}</td>
                      <td className="p-2">{t.date}</td>
                      <td className="p-2">{t.libelle}</td>
                      <td className="p-2">{t.beneficiaire}</td>
                      <td className="p-2 text-right font-bold">{formatCurrencyMGA(t.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer note */}
          <div className="border-t pt-4 text-center text-[10px] text-slate-400">
            Document généré par l application Caisse SALFA v25.0 - Sampan i Asa Loterana momba ny Fahasalamana
          </div>
        </div>
      </div>
    </div>
  );
};

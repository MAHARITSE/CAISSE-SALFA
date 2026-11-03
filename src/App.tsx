import React, { useState, useEffect } from 'react';
import { 
  ActiveTab, 
  User, 
  CaisseTransaction, 
  DemandeFonds, 
  Beneficiaire, 
  CompteBancaire, 
  OrdreVirement, 
  DemandeStatus,
  ClotureCaisse 
} from './types';
import { 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredDemandes, 
  saveStoredDemandes, 
  getStoredBeneficiaires, 
  saveStoredBeneficiaires, 
  getStoredBanques, 
  saveStoredBanques, 
  getStoredVirements, 
  saveStoredVirements, 
  getCurrentUser, 
  saveCurrentUser, 
  getInitialBalance 
} from './utils/storage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SaisieCaisse } from './components/SaisieCaisse';
import { MemoireCaisse } from './components/MemoireCaisse';
import { DemandesFonds } from './components/DemandesFonds';
import { Beneficiaires } from './components/Beneficiaires';
import { GestionBanque } from './components/GestionBanque';
import { ClotureCaisseView } from './components/ClotureCaisse';
import { LoginModal } from './components/LoginModal';
import { PrintReportsModal, ReportType } from './components/PrintReportsModal';
import { FileText, Printer, ShieldCheck } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Core collections
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([]);
  const [demandes, setDemandes] = useState<DemandeFonds[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [banques, setBanques] = useState<CompteBancaire[]>([]);
  const [virements, setVirements] = useState<OrdreVirement[]>([]);
  const [initialBalance, setInitialBalance] = useState<number>(3500000);

  // Printing & Receipt Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printReportType, setPrintReportType] = useState<ReportType>('RECEIPT');
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<CaisseTransaction | null>(null);
  const [selectedVirementForPrint, setSelectedVirementForPrint] = useState<OrdreVirement | null>(null);
  const [selectedClotureForPrint, setSelectedClotureForPrint] = useState<ClotureCaisse | null>(null);

  // Load initial data
  const loadAllData = () => {
    setTransactions(getStoredTransactions());
    setDemandes(getStoredDemandes());
    setBeneficiaires(getStoredBeneficiaires());
    setBanques(getStoredBanques());
    setVirements(getStoredVirements());
    setInitialBalance(getInitialBalance());
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Save changes to storage whenever collections update
  const handleAddTransaction = (newTx: CaisseTransaction) => {
    const updated = [newTx, ...transactions];
    setTransactions(updated);
    saveStoredTransactions(updated);

    // Also update bank balance if mode is Virement
    if (newTx.modePaiement === 'Virement' && newTx.compteBanqueId) {
      const updatedBanques = banques.map(b => {
        if (b.id === newTx.compteBanqueId) {
          const delta = newTx.type === 'RECETTE' ? newTx.montant : -newTx.montant;
          return { ...b, soldeActuel: b.soldeActuel + delta };
        }
        return b;
      });
      setBanques(updatedBanques);
      saveStoredBanques(updatedBanques);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveStoredTransactions(updated);
  };

  const handleAddDemande = (newDem: DemandeFonds) => {
    const updated = [newDem, ...demandes];
    setDemandes(updated);
    saveStoredDemandes(updated);
  };

  const handleUpdateDemandeStatus = (id: string, status: DemandeStatus, approvedBy?: string) => {
    const updated = demandes.map(d => {
      if (d.id === id) {
        return {
          ...d,
          statut: status,
          approuvePar: approvedBy || d.approuvePar,
          dateApprobation: status === 'Approuvé' ? new Date().toISOString() : d.dateApprobation
        };
      }
      return d;
    });
    setDemandes(updated);
    saveStoredDemandes(updated);
  };

  const handleConvertDemandeToTransaction = (dem: DemandeFonds) => {
    // Generate new cash expense transaction from approved request
    const year = new Date().getFullYear();
    const nextSeq = transactions.filter(t => t.type === 'DEPENSE').length + 1;
    const numeroPiece = `DEP-${year}-${nextSeq.toString().padStart(4, '0')}`;

    const newTx: CaisseTransaction = {
      id: `tx-${Date.now()}`,
      numeroPiece,
      type: 'DEPENSE',
      date: new Date().toISOString().slice(0, 10),
      libelle: `[Décaissement Demande ${dem.codeDemande}] ${dem.motif}`,
      montant: dem.montant,
      montantEnLettres: '',
      categorie: 'Frais de mission',
      beneficiaire: dem.demandeur,
      modePaiement: 'Espèces',
      statut: 'Validé',
      createdAt: new Date().toISOString()
    };

    handleAddTransaction(newTx);
    handleUpdateDemandeStatus(dem.id, 'Liquidé');
    handleShowReceipt(newTx);
  };

  const handleAddBeneficiaire = (newBen: Beneficiaire) => {
    const updated = [newBen, ...beneficiaires];
    setBeneficiaires(updated);
    saveStoredBeneficiaires(updated);
  };

  const handleAddBanque = (newBank: CompteBancaire) => {
    const updated = [newBank, ...banques];
    setBanques(updated);
    saveStoredBanques(updated);
  };

  const handleAddVirement = (newVir: OrdreVirement) => {
    const updated = [newVir, ...virements];
    setVirements(updated);
    saveStoredVirements(updated);

    // Deduct from bank balance
    const updatedBanques = banques.map(b => {
      if (b.id === newVir.compteSourceId) {
        return { ...b, soldeActuel: b.soldeActuel - newVir.montant };
      }
      return b;
    });
    setBanques(updatedBanques);
    saveStoredBanques(updatedBanques);

    handlePrintVirement(newVir);
  };

  const handleShowReceipt = (tx: CaisseTransaction) => {
    setSelectedTxForReceipt(tx);
    setPrintReportType('RECEIPT');
    setIsPrintModalOpen(true);
  };

  const handlePrintVirement = (v: OrdreVirement) => {
    setSelectedVirementForPrint(v);
    setPrintReportType('VIREMENT');
    setIsPrintModalOpen(true);
  };

  const handlePrintClotureReport = (clot: ClotureCaisse) => {
    setSelectedClotureForPrint(clot);
    setPrintReportType('CLOTURE');
    setIsPrintModalOpen(true);
  };

  // Compute live current balance
  const totalRecettes = transactions
    .filter(t => t.type === 'RECETTE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalDepenses = transactions
    .filter(t => t.type === 'DEPENSE' && t.statut === 'Validé')
    .reduce((sum, t) => sum + t.montant, 0);

  const currentBalance = initialBalance + totalRecettes - totalDepenses;
  const pendingDemandesCount = demandes.filter(d => d.statut === 'En attente').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onDataRefresh={loadAllData}
        currentBalance={currentBalance}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row my-4 px-4 sm:px-6 lg:px-8 gap-6">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingDemandesCount={pendingDemandesCount}
        />

        {/* Dynamic Content View */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              transactions={transactions}
              demandes={demandes}
              initialBalance={initialBalance}
              onNavigateTab={setActiveTab}
              onSelectTransactionReceipt={handleShowReceipt}
            />
          )}

          {activeTab === 'saisie' && (
            <SaisieCaisse
              transactions={transactions}
              beneficiaires={beneficiaires}
              banques={banques}
              onAddTransaction={handleAddTransaction}
              onShowReceipt={handleShowReceipt}
            />
          )}

          {activeTab === 'memoire' && (
            <MemoireCaisse
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onShowReceipt={handleShowReceipt}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'demandes' && (
            <DemandesFonds
              demandes={demandes}
              onAddDemande={handleAddDemande}
              onUpdateDemandeStatus={handleUpdateDemandeStatus}
              onConvertToTransaction={handleConvertDemandeToTransaction}
            />
          )}

          {activeTab === 'beneficiaires' && (
            <Beneficiaires
              beneficiaires={beneficiaires}
              transactions={transactions}
              onAddBeneficiaire={handleAddBeneficiaire}
            />
          )}

          {activeTab === 'banque' && (
            <GestionBanque
              banques={banques}
              virements={virements}
              beneficiaires={beneficiaires}
              onAddBanque={handleAddBanque}
              onAddVirement={handleAddVirement}
              onPrintVirement={handlePrintVirement}
            />
          )}

          {activeTab === 'cloture' && (
            <ClotureCaisseView
              transactions={transactions}
              initialBalance={initialBalance}
              currentUser={currentUser}
              onPrintClotureReport={handlePrintClotureReport}
            />
          )}

          {activeTab === 'rapports' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
              <div className="border-b pb-4">
                <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  ETAT_*.wde - Générateur de Rapports Officiers
                </span>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">Génération d États & Impressions</h2>
                <p className="text-xs text-slate-500">
                  Sélectionner un rapport financier officiel à générer au format imprimable / PDF.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => {
                    setPrintReportType('GLOBAL_SUMMARY');
                    setIsPrintModalOpen(true);
                  }}
                  className="p-5 border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-md transition-all cursor-pointer space-y-2 bg-slate-50/50"
                >
                  <div className="flex items-center space-x-2 text-teal-700 font-bold">
                    <FileText className="w-5 h-5" />
                    <span>Récapitulatif Général de Caisse</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    État récapitulatif complet des pièces de recettes et dépenses avec cumulatif.
                  </p>
                </div>

                <div 
                  onClick={() => {
                    if (transactions.length > 0) {
                      handleShowReceipt(transactions[0]);
                    }
                  }}
                  className="p-5 border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-md transition-all cursor-pointer space-y-2 bg-slate-50/50"
                >
                  <div className="flex items-center space-x-2 text-teal-700 font-bold">
                    <Printer className="w-5 h-5" />
                    <span>Impression Bon de Caisse / Reçu</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Générer et imprimer un reçu d encaissement ou un bon de décaissement avec visa.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* User Login / Role Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={(u) => {
          setCurrentUser(u);
          saveCurrentUser(u);
        }}
      />

      {/* Printable Reports Modal */}
      <PrintReportsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportType={printReportType}
        transaction={selectedTxForReceipt}
        virement={selectedVirementForPrint}
        cloture={selectedClotureForPrint}
        banques={banques}
        beneficiaires={beneficiaires}
        transactionsList={transactions}
        currentUser={currentUser}
      />
    </div>
  );
}

export default App;

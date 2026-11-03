import { CaisseTransaction, DemandeFonds, Beneficiaire, CompteBancaire, OrdreVirement, User } from '../types';
import { 
  INITIAL_TRANSACTIONS, 
  INITIAL_DEMANDES, 
  INITIAL_BENEFICIAIRES, 
  INITIAL_BANQUES, 
  INITIAL_VIREMENTS 
} from './mockData';

const STORAGE_KEYS = {
  TRANSACTIONS: 'salfa_caisse_transactions',
  DEMANDES: 'salfa_caisse_demandes',
  BENEFICIAIRES: 'salfa_caisse_beneficiaires',
  BANQUES: 'salfa_caisse_banques',
  VIREMENTS: 'salfa_caisse_virements',
  USER: 'salfa_caisse_current_user',
  INITIAL_BALANCE: 'salfa_caisse_solde_initial'
};

export const DEFAULT_USER: User = {
  id: 'usr-1',
  name: 'Andriamanitra Hasina',
  username: 'caissier.salfa',
  role: 'caissier'
};

export function getStoredTransactions(): CaisseTransaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : INITIAL_TRANSACTIONS;
  } catch {
    return INITIAL_TRANSACTIONS;
  }
}

export function saveStoredTransactions(items: CaisseTransaction[]) {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(items));
}

export function getStoredDemandes(): DemandeFonds[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DEMANDES);
    return data ? JSON.parse(data) : INITIAL_DEMANDES;
  } catch {
    return INITIAL_DEMANDES;
  }
}

export function saveStoredDemandes(items: DemandeFonds[]) {
  localStorage.setItem(STORAGE_KEYS.DEMANDES, JSON.stringify(items));
}

export function getStoredBeneficiaires(): Beneficiaire[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BENEFICIAIRES);
    return data ? JSON.parse(data) : INITIAL_BENEFICIAIRES;
  } catch {
    return INITIAL_BENEFICIAIRES;
  }
}

export function saveStoredBeneficiaires(items: Beneficiaire[]) {
  localStorage.setItem(STORAGE_KEYS.BENEFICIAIRES, JSON.stringify(items));
}

export function getStoredBanques(): CompteBancaire[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BANQUES);
    return data ? JSON.parse(data) : INITIAL_BANQUES;
  } catch {
    return INITIAL_BANQUES;
  }
}

export function saveStoredBanques(items: CompteBancaire[]) {
  localStorage.setItem(STORAGE_KEYS.BANQUES, JSON.stringify(items));
}

export function getStoredVirements(): OrdreVirement[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.VIREMENTS);
    return data ? JSON.parse(data) : INITIAL_VIREMENTS;
  } catch {
    return INITIAL_VIREMENTS;
  }
}

export function saveStoredVirements(items: OrdreVirement[]) {
  localStorage.setItem(STORAGE_KEYS.VIREMENTS, JSON.stringify(items));
}

export function getCurrentUser(): User {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export function saveCurrentUser(user: User) {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function getInitialBalance(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INITIAL_BALANCE);
    return data ? parseFloat(data) : 3500000; // 3,500,000 MGA
  } catch {
    return 3500000;
  }
}

export function saveInitialBalance(amount: number) {
  localStorage.setItem(STORAGE_KEYS.INITIAL_BALANCE, amount.toString());
}

export function exportFullDatabaseJSON(): string {
  const exportObject = {
    appName: 'CAISSE SALFA',
    version: '25.0-web',
    exportedAt: new Date().toISOString(),
    transactions: getStoredTransactions(),
    demandes: getStoredDemandes(),
    beneficiaires: getStoredBeneficiaires(),
    banques: getStoredBanques(),
    virements: getStoredVirements(),
    initialBalance: getInitialBalance()
  };

  return JSON.stringify(exportObject, null, 2);
}

export function importFullDatabaseJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.transactions && Array.isArray(data.transactions)) {
      saveStoredTransactions(data.transactions);
    }
    if (data.demandes && Array.isArray(data.demandes)) {
      saveStoredDemandes(data.demandes);
    }
    if (data.beneficiaires && Array.isArray(data.beneficiaires)) {
      saveStoredBeneficiaires(data.beneficiaires);
    }
    if (data.banques && Array.isArray(data.banques)) {
      saveStoredBanques(data.banques);
    }
    if (data.virements && Array.isArray(data.virements)) {
      saveStoredVirements(data.virements);
    }
    if (data.initialBalance !== undefined) {
      saveInitialBalance(data.initialBalance);
    }
    return true;
  } catch {
    return false;
  }
}

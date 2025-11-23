export interface Transaction {
  id: string;
  transactionId?: string; // Bank's transaction ID
  date: Date;
  payee: string;
  amount: number;
  type?: 'debit' | 'credit';
  description?: string;
  category?: string;
  tags: string[];
  account?: string;
  balance?: number;
  reference?: string;
}

export interface ColumnMapping {
  date: string;
  payee: string;
  amount: string;
  transactionId?: string;
  type?: string;
  description?: string;
  account?: string;
  balance?: string;
  reference?: string;
}

export interface Category {
  name: string;
  color: string;
}

export type AppView = 'upload' | 'mapping' | 'transactions' | 'analytics' | 'settings';

export type StorageType = 'local' | 'backend';

export interface StorageSettings {
  type: StorageType;
  backendUrl?: string;
}

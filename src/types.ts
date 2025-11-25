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
  currency?: string; // Individual transaction currency override
  isSaving?: boolean; // Mark as savings transaction
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
  parent?: string; // For hierarchical categories
  isSubscription?: boolean; // Mark as subscription category
}

export type AppView = 'upload' | 'mapping' | 'transactions' | 'analytics' | 'settings';

export type StorageType = 'local' | 'backend';

export interface StorageSettings {
  type: StorageType;
  backendUrl?: string;
  defaultCurrency?: string;
}

export interface SavingsGoal {
  amount: number;
  period: 'week' | 'month' | 'year';
}

export interface PayeeRenamingRule {
  id: string;
  pattern: string; // Can be plain text or regex
  replacement: string;
  isRegex: boolean;
  enabled: boolean;
}

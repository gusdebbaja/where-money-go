export interface Transaction {
  id: string;
  date: Date;
  payee: string;
  amount: number;
  description?: string;
  category?: string;
  tags: string[];
}

export interface ColumnMapping {
  date: string;
  payee: string;
  amount: string;
  description?: string;
}

export interface Category {
  name: string;
  color: string;
}

export type AppView = 'upload' | 'mapping' | 'transactions' | 'analytics';

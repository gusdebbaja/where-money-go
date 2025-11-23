import { Transaction, Category, StorageType } from '../types';
import * as indexedDB from './indexedDB';
import * as backend from './backend';

let storageType: StorageType = 'local';

export function setStorageType(type: StorageType) {
  storageType = type;
}

export function getStorageType(): StorageType {
  return storageType;
}

export function setBackendUrl(url: string) {
  backend.setBackendUrl(url);
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  if (storageType === 'backend') {
    return backend.saveTransactions(transactions);
  }
  return indexedDB.saveTransactions(transactions);
}

export async function getTransactions(): Promise<Transaction[]> {
  if (storageType === 'backend') {
    return backend.getTransactions();
  }
  return indexedDB.getTransactions();
}

export async function deleteTransaction(id: string): Promise<void> {
  if (storageType === 'backend') {
    return backend.deleteTransaction(id);
  }
  return indexedDB.deleteTransaction(id);
}

export async function clearTransactions(): Promise<void> {
  if (storageType === 'backend') {
    return backend.clearTransactions();
  }
  return indexedDB.clearTransactions();
}

export async function saveCategories(categories: Category[]): Promise<void> {
  if (storageType === 'backend') {
    return backend.saveCategories(categories);
  }
  return indexedDB.saveCategories(categories);
}

export async function getCategories(): Promise<Category[]> {
  if (storageType === 'backend') {
    return backend.getCategories();
  }
  return indexedDB.getCategories();
}

export async function checkDuplicates(transactionIds: string[]): Promise<Set<string>> {
  if (storageType === 'backend') {
    return backend.checkDuplicates(transactionIds);
  }
  return indexedDB.checkDuplicates(transactionIds);
}

export { testConnection } from './backend';
export { initDB } from './indexedDB';

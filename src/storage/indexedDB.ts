import { Transaction, Category } from '../types';

const DB_NAME = 'where-money-go';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Transactions store
      if (!database.objectStoreNames.contains('transactions')) {
        const txnStore = database.createObjectStore('transactions', { keyPath: 'id' });
        txnStore.createIndex('date', 'date');
        txnStore.createIndex('transactionId', 'transactionId');
        txnStore.createIndex('account', 'account');
        txnStore.createIndex('category', 'category');
      }

      // Categories store
      if (!database.objectStoreNames.contains('categories')) {
        database.createObjectStore('categories', { keyPath: 'name' });
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');

  for (const txn of transactions) {
    // Convert Date to ISO string for storage
    const toStore = {
      ...txn,
      date: txn.date instanceof Date ? txn.date.toISOString() : txn.date,
    };
    store.put(toStore);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readonly');
  const store = tx.objectStore('transactions');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result.map((txn: Transaction & { date: string }) => ({
        ...txn,
        date: new Date(txn.date),
      }));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearTransactions(): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');
  store.clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');

  store.clear();
  for (const cat of categories) {
    store.put(cat);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCategories(): Promise<Category[]> {
  const database = await initDB();
  const tx = database.transaction('categories', 'readonly');
  const store = tx.objectStore('categories');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getTransactionsByAccount(account: string): Promise<Transaction[]> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readonly');
  const store = tx.objectStore('transactions');
  const index = store.index('account');

  return new Promise((resolve, reject) => {
    const request = index.getAll(account);
    request.onsuccess = () => {
      const results = request.result.map((txn: Transaction & { date: string }) => ({
        ...txn,
        date: new Date(txn.date),
      }));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function checkDuplicates(transactionIds: string[]): Promise<Set<string>> {
  const database = await initDB();
  const tx = database.transaction('transactions', 'readonly');
  const store = tx.objectStore('transactions');
  const index = store.index('transactionId');
  const existing = new Set<string>();

  return new Promise((resolve, reject) => {
    let completed = 0;
    for (const txnId of transactionIds) {
      const request = index.get(txnId);
      request.onsuccess = () => {
        if (request.result) {
          existing.add(txnId);
        }
        completed++;
        if (completed === transactionIds.length) {
          resolve(existing);
        }
      };
      request.onerror = () => reject(request.error);
    }
    if (transactionIds.length === 0) resolve(existing);
  });
}

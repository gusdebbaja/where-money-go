import { Transaction, Category } from '../types';

let backendUrl = 'http://localhost:3001';

export function setBackendUrl(url: string) {
  backendUrl = url;
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const response = await fetch(`${backendUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transactions.map(t => ({
      ...t,
      date: t.date instanceof Date ? t.date.toISOString() : t.date,
    }))),
  });
  if (!response.ok) throw new Error('Failed to save transactions');
}

export async function getTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${backendUrl}/api/transactions`);
  if (!response.ok) throw new Error('Failed to fetch transactions');
  const data = await response.json();
  return data.map((t: Transaction & { date: string }) => ({
    ...t,
    date: new Date(t.date),
  }));
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`${backendUrl}/api/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete transaction');
}

export async function clearTransactions(): Promise<void> {
  const response = await fetch(`${backendUrl}/api/transactions`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to clear transactions');
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const response = await fetch(`${backendUrl}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categories),
  });
  if (!response.ok) throw new Error('Failed to save categories');
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${backendUrl}/api/categories`);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const response = await fetch(`${backendUrl}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update transaction');
}

export async function checkDuplicates(transactionIds: string[]): Promise<Set<string>> {
  const response = await fetch(`${backendUrl}/api/transactions/check-duplicates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transactionIds),
  });
  if (!response.ok) throw new Error('Failed to check duplicates');
  const data = await response.json();
  return new Set(data);
}

export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${backendUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

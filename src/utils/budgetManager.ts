import { Budget, Transaction, Category } from '../types';
import { getCategoryChildren } from './categoryLoader';

export function getBudgets(): Budget[] {
  const saved = localStorage.getItem('budgets');
  return saved ? JSON.parse(saved) : [];
}

export function saveBudgets(budgets: Budget[]): void {
  localStorage.setItem('budgets', JSON.stringify(budgets));
}

export function addBudget(budget: Omit<Budget, 'id'>): Budget {
  const budgets = getBudgets();
  const newBudget: Budget = {
    ...budget,
    id: `budget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  budgets.push(newBudget);
  saveBudgets(budgets);
  return newBudget;
}

export function updateBudget(id: string, updates: Partial<Budget>): void {
  const budgets = getBudgets();
  const index = budgets.findIndex(b => b.id === id);
  if (index !== -1) {
    budgets[index] = { ...budgets[index], ...updates };
    saveBudgets(budgets);
  }
}

export function deleteBudget(id: string): void {
  const budgets = getBudgets().filter(b => b.id !== id);
  saveBudgets(budgets);
}

interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'good' | 'warning' | 'exceeded';
}

export function calculateBudgetProgress(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  startDate?: Date,
  endDate?: Date
): BudgetProgress {
  // Filter transactions by date range based on period
  let relevantTransactions = transactions;

  if (startDate && endDate) {
    relevantTransactions = transactions.filter(t =>
      t.date >= startDate && t.date <= endDate
    );
  } else {
    // Auto-calculate date range based on period
    const now = new Date();
    const start = new Date();

    switch (budget.period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    relevantTransactions = transactions.filter(t => t.date >= start && t.date <= now);
  }

  // Filter by category
  if (budget.includeChildren) {
    // Include all children in budget calculation
    const children = getCategoryChildren(budget.category, categories);
    const categoryNames = [budget.category, ...children.map(c => c.name)];
    relevantTransactions = relevantTransactions.filter(t =>
      t.category && categoryNames.includes(t.category)
    );
  } else {
    relevantTransactions = relevantTransactions.filter(t =>
      t.category === budget.category
    );
  }

  const spent = relevantTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const remaining = budget.amount - spent;
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

  let status: 'good' | 'warning' | 'exceeded' = 'good';
  if (percentage >= 100) {
    status = 'exceeded';
  } else if (percentage >= 80) {
    status = 'warning';
  }

  return {
    budget,
    spent,
    remaining,
    percentage,
    status,
  };
}

export function getAllBudgetProgress(
  transactions: Transaction[],
  categories: Category[],
  startDate?: Date,
  endDate?: Date
): BudgetProgress[] {
  const budgets = getBudgets().filter(b => b.enabled);
  return budgets.map(budget =>
    calculateBudgetProgress(budget, transactions, categories, startDate, endDate)
  );
}

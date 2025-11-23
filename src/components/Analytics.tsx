import { useMemo } from 'react';
import { Transaction, Category } from '../types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
}

export function Analytics({ transactions, categories }: AnalyticsProps) {
  const spending = transactions.filter(t => t.amount < 0);
  const income = transactions.filter(t => t.amount > 0);

  const totalSpending = Math.abs(spending.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    spending.forEach(t => {
      const cat = t.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: categories.find(c => c.name === name)?.color || '#6b7280'
      }))
      .sort((a, b) => b.value - a.value);
  }, [spending, categories]);

  const overTime = useMemo(() => {
    const map = new Map<string, { spending: number; income: number }>();
    transactions.forEach(t => {
      const month = t.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      const entry = map.get(month) || { spending: 0, income: 0 };
      if (t.amount < 0) {
        entry.spending += Math.abs(t.amount);
      } else {
        entry.income += t.amount;
      }
      map.set(month, entry);
    });
    return Array.from(map.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [transactions]);

  const topPayees = useMemo(() => {
    const map = new Map<string, number>();
    spending.forEach(t => {
      map.set(t.payee, (map.get(t.payee) || 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [spending]);

  const formatCurrency = (value: number) => `$${value.toFixed(0)}`;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Analytics</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="text-2xl font-bold text-green-600">${totalIncome.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Spending</div>
          <div className="text-2xl font-bold text-red-600">${totalSpending.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Net</div>
          <div className={`text-2xl font-bold ${totalIncome - totalSpending >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${(totalIncome - totalSpending).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {byCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={formatCurrency} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Top Merchants</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topPayees} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={formatCurrency} />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">Income vs Spending Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

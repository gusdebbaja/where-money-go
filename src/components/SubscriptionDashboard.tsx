import { useMemo } from 'react';
import { Transaction, Category } from '../types';
import { formatCurrency, formatDateEuropean } from '../utils/currency';
import { getCategoryHierarchy } from '../utils/categoryLoader';
import { Calendar, DollarSign, TrendingUp, CreditCard } from 'lucide-react';

interface SubscriptionDashboardProps {
  transactions: Transaction[];
  categories: Category[];
}

interface SubscriptionInfo {
  payee: string;
  category: string;
  hierarchy: string[];
  transactions: Transaction[];
  avgAmount: number;
  monthlyEstimate: number;
  lastCharge: Date;
  totalSpent: number;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown';
}

function estimateMonthlyRecurring(transactions: Transaction[]): { amount: number; frequency: string } {
  if (transactions.length === 0) return { amount: 0, frequency: 'unknown' };
  if (transactions.length === 1) {
    return { amount: Math.abs(transactions[0].amount), frequency: 'unknown' };
  }

  // Calculate average time between transactions
  const sortedDates = transactions
    .map(t => t.date.getTime())
    .sort((a, b) => a - b);

  let totalDaysBetween = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    totalDaysBetween += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
  }

  const avgDaysBetween = totalDaysBetween / (sortedDates.length - 1);
  const avgAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length;

  let frequency = 'unknown';
  let monthlyAmount = avgAmount;

  if (avgDaysBetween >= 5 && avgDaysBetween <= 9) {
    frequency = 'weekly';
    monthlyAmount = avgAmount * (30 / 7);
  } else if (avgDaysBetween >= 12 && avgDaysBetween <= 18) {
    frequency = 'bi-weekly';
    monthlyAmount = avgAmount * 2;
  } else if (avgDaysBetween >= 25 && avgDaysBetween <= 35) {
    frequency = 'monthly';
    monthlyAmount = avgAmount;
  } else if (avgDaysBetween >= 85 && avgDaysBetween <= 100) {
    frequency = 'quarterly';
    monthlyAmount = avgAmount / 3;
  } else if (avgDaysBetween >= 350 && avgDaysBetween <= 380) {
    frequency = 'yearly';
    monthlyAmount = avgAmount / 12;
  }

  return { amount: monthlyAmount, frequency };
}

export function SubscriptionDashboard({ transactions, categories }: SubscriptionDashboardProps) {
  const userCurrency = localStorage.getItem('default-currency') || 'USD';
  const formatAmount = (value: number) => formatCurrency(value, userCurrency);

  // Group transactions by payee within subscription categories
  const subscriptions = useMemo(() => {
    const subCategoryNames = new Set(categories.filter(c => c.isSubscription).map(c => c.name));
    const subs: SubscriptionInfo[] = [];
    const transactionsByPayee = new Map<string, Transaction[]>();

    // Group transactions by payee
    transactions.forEach(t => {
      if (t.category && subCategoryNames.has(t.category) && t.amount < 0) {
        const current = transactionsByPayee.get(t.payee) || [];
        current.push(t);
        transactionsByPayee.set(t.payee, current);
      }
    });

    transactionsByPayee.forEach((txns, payee) => {
      // Sort by date descending
      txns.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      const category = txns[0].category || 'Uncategorized';
      const hierarchy = getCategoryHierarchy(category, categories);

      const amounts = txns.map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const totalSpent = amounts.reduce((a, b) => a + b, 0);

      const { amount: monthlyEstimate, frequency } = estimateMonthlyRecurring(txns);

      subs.push({
        payee,
        category,
        hierarchy,
        transactions: txns,
        avgAmount,
        monthlyEstimate,
        lastCharge: txns[0].date,
        totalSpent,
        frequency: frequency as SubscriptionInfo['frequency'],
      });
    });

    return subs.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
  }, [transactions, categories]);

  const totalMonthlySubscriptions = subscriptions.reduce(
    (sum, sub) => sum + sub.monthlyEstimate,
    0
  );

  const totalSpentAllTime = subscriptions.reduce(
    (sum, sub) => sum + sub.totalSpent,
    0
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Subscription Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 text-purple-700 mb-2">
            <CreditCard size={20} />
            <span className="text-sm font-medium">Active Subscriptions</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">{subscriptions.length}</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <DollarSign size={20} />
            <span className="text-sm font-medium">Est. Monthly Cost</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {formatAmount(totalMonthlySubscriptions)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 text-orange-700 mb-2">
            <TrendingUp size={20} />
            <span className="text-sm font-medium">Total Spent</span>
          </div>
          <div className="text-3xl font-bold text-orange-900">
            {formatAmount(totalSpentAllTime)}
          </div>
          <div className="text-xs text-orange-700 mt-1">All time</div>
        </div>
      </div>

      {/* Subscriptions List */}
      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No subscriptions found. Mark categories as subscriptions in your YAML file.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monthly Est.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Charge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Spent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <tr key={sub.payee} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{sub.payee}</span>
                      <span className="text-xs text-gray-500">
                        {sub.hierarchy.join(' > ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {sub.frequency}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatAmount(sub.avgAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatAmount(sub.monthlyEstimate)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDateEuropean(sub.lastCharge)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatAmount(sub.totalSpent)}
                    <div className="text-xs text-gray-500">
                      {sub.transactions.length} charge{sub.transactions.length !== 1 ? 's' : ''}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tips */}
      {subscriptions.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Review your subscriptions regularly to identify services you no longer use.
            Canceling just one {formatAmount(totalMonthlySubscriptions / subscriptions.length)}/month subscription
            saves {formatAmount((totalMonthlySubscriptions / subscriptions.length) * 12)}/year!
          </p>
        </div>
      )}
    </div>
  );
}

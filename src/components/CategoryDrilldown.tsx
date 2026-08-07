import { useState, useMemo, useCallback, useEffect } from 'react';
import { Transaction, Category } from '../types';
import { formatCurrency } from '../utils/currency';
import { getCategoryChildren } from '../utils/categoryLoader';
import { ChevronRight, Home, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';

interface CategoryDrilldownProps {
  transactions: Transaction[];
  categories: Category[];
  initialCategory?: string;
  initialDateRange?: { start: string; end: string };
  onInitialConsumed?: () => void;
}

interface CategoryNode {
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  color: string;
  hasChildren: boolean;
  parent?: string;
  [key: string]: string | number | boolean | undefined;
}

export function CategoryDrilldown({ transactions, categories, initialCategory, initialDateRange, onInitialConsumed }: CategoryDrilldownProps) {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [showPayees, setShowPayees] = useState(false);
  const [selectedPayee, setSelectedPayee] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const userCurrency = localStorage.getItem('default-currency') || 'USD';
  const formatAmount = (value: number) => formatCurrency(value, userCurrency);

  // When Analytics navigates here with a category + date range, apply them
  useEffect(() => {
    if (!initialCategory) return;
    if (initialDateRange) setDateRange(initialDateRange);
    setSelectedPath([initialCategory]);
    setSelectedPayee(null);
    setShowPayees(false); // let the auto-payee effect below decide
    onInitialConsumed?.();
  }, [initialCategory]);

  const handleDateChange = useCallback((r: { start: string; end: string }) => {
    setDateRange(r);
    setSelectedPath([]);
    setShowPayees(false);
    setSelectedPayee(null);
  }, []);

  // Get spending transactions only, filtered by date
  const spendingTransactions = useMemo(
    () => transactions.filter(t => {
      if (t.amount >= 0 || !t.category || t.isHidden) return false;
      if (dateRange.start && t.date < new Date(dateRange.start)) return false;
      if (dateRange.end && t.date > new Date(dateRange.end + 'T23:59:59')) return false;
      return true;
    }),
    [transactions, dateRange]
  );

  const totalSpending = useMemo(
    () => Math.abs(spendingTransactions.reduce((sum, t) => sum + t.amount, 0)),
    [spendingTransactions]
  );

  // Get current level categories
  const currentLevelData = useMemo(() => {
    const currentCategory = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null;

    // Get all possible categories at this level
    let categoriesToShow: Category[];

    if (!currentCategory) {
      // Root level - show root categories
      categoriesToShow = categories.filter(c => !c.parent);
    } else {
      // Show children of current category
      categoriesToShow = getCategoryChildren(currentCategory, categories);
    }

    // Calculate spending for each category
    const nodes: CategoryNode[] = categoriesToShow.map(cat => {
      // Get all descendants
      const descendants = getCategoryChildren(cat.name, categories);
      const allCategoryNames = [cat.name, ...descendants.map(d => d.name)];

      // Filter transactions for this category and all descendants
      const categoryTransactions = spendingTransactions.filter(t =>
        t.category && allCategoryNames.includes(t.category)
      );

      const amount = Math.abs(
        categoryTransactions.reduce((sum, t) => sum + t.amount, 0)
      );

      const percentage = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;

      return {
        name: cat.name,
        amount,
        percentage,
        transactionCount: categoryTransactions.length,
        color: cat.color,
        hasChildren: descendants.length > 0,
        parent: cat.parent,
      };
    }).filter(node => node.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return nodes;
  }, [categories, spendingTransactions, selectedPath, totalSpending]);

  // Auto-switch to payee/transaction view when we're inside a category but its
  // subcategories have no spending in the selected period (leaf or empty branch)
  useEffect(() => {
    if (selectedPath.length > 0 && !showPayees && currentLevelData.length === 0) {
      setShowPayees(true);
    }
  }, [currentLevelData, selectedPath, showPayees]);

  // Get previous month data for comparison
  const previousMonthData = useMemo(() => {
    const now = new Date();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const previousMonthTxns = transactions.filter(
      t => t.amount < 0 && t.date >= previousMonthStart && t.date <= previousMonthEnd && t.category
    );

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthTxns = transactions.filter(
      t => t.amount < 0 && t.date >= currentMonthStart && t.category
    );

    const result = new Map<string, { current: number; previous: number; change: number }>();

    currentLevelData.forEach(node => {
      const descendants = getCategoryChildren(node.name, categories);
      const allNames = [node.name, ...descendants.map(d => d.name)];

      const current = Math.abs(
        currentMonthTxns
          .filter(t => t.category && allNames.includes(t.category))
          .reduce((sum, t) => sum + t.amount, 0)
      );

      const previous = Math.abs(
        previousMonthTxns
          .filter(t => t.category && allNames.includes(t.category))
          .reduce((sum, t) => sum + t.amount, 0)
      );

      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      result.set(node.name, { current, previous, change });
    });

    return result;
  }, [transactions, currentLevelData, categories]);

  // Payee-level breakdown for the current leaf category
  const payeeData = useMemo(() => {
    if (!showPayees || selectedPath.length === 0) return [];
    const leafCategory = selectedPath[selectedPath.length - 1];
    const catObj = categories.find(c => c.name === leafCategory);
    const descendants = getCategoryChildren(leafCategory, categories);
    const allNames = [leafCategory, ...descendants.map(d => d.name)];

    const leafTxns = spendingTransactions.filter(t => t.category && allNames.includes(t.category));
    const byPayee = new Map<string, number>();

    leafTxns.forEach(t => {
      byPayee.set(t.payee, (byPayee.get(t.payee) || 0) + Math.abs(t.amount));
    });

    return Array.from(byPayee.entries())
      .map(([payee, amount]) => ({
        name: payee,
        amount,
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
        transactionCount: leafTxns.filter(t => t.payee === payee).length,
        color: catObj?.color || '#6366f1',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [showPayees, selectedPath, spendingTransactions, categories, totalSpending]);

  // Individual transactions for the leaf/payee view
  const leafTransactions = useMemo(() => {
    if (!showPayees || selectedPath.length === 0) return [];
    const leafCategory = selectedPath[selectedPath.length - 1];
    const descendants = getCategoryChildren(leafCategory, categories);
    const allNames = [leafCategory, ...descendants.map(d => d.name)];
    return spendingTransactions
      .filter(t => t.category && allNames.includes(t.category) && (!selectedPayee || t.payee === selectedPayee))
      .sort((a, b) => a.amount - b.amount); // most negative first = largest expense first
  }, [showPayees, selectedPath, spendingTransactions, categories, selectedPayee]);

  const handleDrillDown = (categoryName: string) => {
    const node = currentLevelData.find(n => n.name === categoryName);
    if (!node) return;
    setSelectedPayee(null);
    if (node.hasChildren) {
      setShowPayees(false);
      setSelectedPath([...selectedPath, categoryName]);
    } else {
      setSelectedPath([...selectedPath, categoryName]);
      setShowPayees(true);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setShowPayees(false);
    setSelectedPayee(null);
    if (index === -1) {
      setSelectedPath([]);
    } else {
      setSelectedPath(selectedPath.slice(0, index + 1));
    }
  };

  const getBreadcrumbs = () => {
    const crumbs: { name: string; level: number }[] = [
      { name: 'All Categories', level: -1 },
      ...selectedPath.map((name, index) => ({ name, level: index })),
    ];
    if (showPayees) crumbs.push({ name: 'Payees', level: selectedPath.length });
    return crumbs;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Category Drilldown</h2>
        <div className="text-sm text-gray-500">
          Total Spending: <span className="font-bold text-gray-900">{formatAmount(totalSpending)}</span>
        </div>
      </div>
      <div className="mb-6">
        <DateRangePicker transactions={transactions} dateRange={dateRange} onChange={handleDateChange} />
      </div>

      {/* Breadcrumb Navigation */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {getBreadcrumbs().map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight size={16} className="text-gray-400" />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.level)}
                className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                  index === getBreadcrumbs().length - 1
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {index === 0 && <Home size={16} />}
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4">
          <div className="text-sm text-blue-700 mb-1">Categories</div>
          <div className="text-2xl font-bold text-blue-900">{currentLevelData.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-4">
          <div className="text-sm text-green-700 mb-1">Total Transactions</div>
          <div className="text-2xl font-bold text-green-900">
            {currentLevelData.reduce((sum, n) => sum + n.transactionCount, 0)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-4">
          <div className="text-sm text-purple-700 mb-1">Largest Category</div>
          <div className="text-xl font-bold text-purple-900 truncate">
            {currentLevelData[0]?.name || '-'}
          </div>
          <div className="text-xs text-purple-700">
            {currentLevelData[0] ? formatAmount(currentLevelData[0].amount) : ''}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-4">
          <div className="text-sm text-orange-700 mb-1">Current Level</div>
          <div className="text-2xl font-bold text-orange-900">
            {selectedPath.length === 0 ? 'Root' : `Level ${selectedPath.length}`}
          </div>
        </div>
      </div>

      {/* Visualization Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={currentLevelData.slice(0, 10)}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => {
                  const node = currentLevelData.find(n => n.name === entry.name);
                  return node ? `${node.name} ${node.percentage.toFixed(0)}%` : '';
                }}
              >
                {currentLevelData.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatAmount(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentLevelData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tickFormatter={(value) => formatCurrency(value, userCurrency).replace(/\.\d+/, '')} />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Bar dataKey="amount" onClick={(data) => {
                if (data && data.name) {
                  handleDrillDown(data.name as string);
                }
              }}>
                {currentLevelData.slice(0, 10).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    cursor={entry.hasChildren ? 'pointer' : 'default'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 text-center mt-2">
            Click a bar to drill down into subcategories or view payees
          </p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                % of Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transactions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trend (vs Last Month)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentLevelData.map((node) => {
              const trendData = previousMonthData.get(node.name);
              const trend = trendData?.change || 0;
              const trendColor = trend > 10 ? 'text-red-600' : trend < -10 ? 'text-green-600' : 'text-gray-600';

              return (
                <tr key={node.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: node.color }}
                      ></div>
                      <span className="font-medium text-gray-900">{node.name}</span>
                      {node.hasChildren && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Has subcategories
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatAmount(node.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {node.percentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {node.transactionCount}
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${trendColor}`}>
                    <div className="flex items-center gap-1">
                      {trend > 10 && <TrendingUp size={16} />}
                      {trend < -10 && <TrendingDown size={16} />}
                      {trend !== 0 && (
                        <span>
                          {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                        </span>
                      )}
                      {trend === 0 && <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDrillDown(node.name)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors text-white ${
                        node.hasChildren ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-500 hover:bg-indigo-600'
                      }`}
                    >
                      {node.hasChildren ? (
                        <>Drill Down <ChevronRight size={16} /></>
                      ) : (
                        <>View Payees <Users size={14} /></>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showPayees && currentLevelData.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No spending data found for this category level.
        </div>
      )}

      {/* Payee-level breakdown */}
      {showPayees && (
        <>
          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-1">Payees by Spend</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Click a bar to filter transactions below</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={payeeData.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v, userCurrency).replace(/\.\d+/, '')} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Bar dataKey="amount" cursor="pointer" onClick={(d) => setSelectedPayee(prev => prev === d.name ? null : d.name)}>
                    {payeeData.slice(0, 15).map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={selectedPayee && selectedPayee !== entry.name ? 0.35 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">Payee Distribution</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={payeeData.slice(0, 10)}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    cursor="pointer"
                    onClick={(d) => setSelectedPayee(prev => prev === d.name ? null : d.name)}
                    label={({ name, percent }) => (percent ?? 0) > 0.06 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                  >
                    {payeeData.slice(0, 10).map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={selectedPayee && selectedPayee !== entry.name ? 0.35 : 1} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payee summary table */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium">Payee Summary</h3>
              {selectedPayee && (
                <button onClick={() => setSelectedPayee(null)} className="text-xs px-2 py-1 rounded border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  Clear filter: {selectedPayee}
                </button>
              )}
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% of Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg per Txn</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {payeeData.map((p) => (
                  <tr
                    key={p.name}
                    className="hover:bg-gray-50 cursor-pointer"
                    style={{ opacity: selectedPayee && selectedPayee !== p.name ? 0.45 : 1 }}
                    onClick={() => setSelectedPayee(prev => prev === p.name ? null : p.name)}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium" style={{ color: selectedPayee === p.name ? p.color : 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatAmount(p.amount)}</td>
                    <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{p.percentage.toFixed(1)}%</td>
                    <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{p.transactionCount}</td>
                    <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatAmount(p.amount / p.transactionCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Individual transactions */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium">
                {selectedPayee ? `Transactions — ${selectedPayee}` : 'All Transactions'}
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({leafTransactions.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {leafTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-2.5 text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {t.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-2.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.payee}</td>
                      <td className="px-6 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t.category}</td>
                      <td className="px-6 py-2.5 text-sm font-semibold text-red-500 whitespace-nowrap">{formatAmount(Math.abs(t.amount))}</td>
                      <td className="px-6 py-2.5 text-sm max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.description || '—'}</td>
                    </tr>
                  ))}
                  {leafTransactions.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

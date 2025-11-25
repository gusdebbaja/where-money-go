import { useState, useMemo } from 'react';
import { Transaction, Category } from '../types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Calendar, PieChart as PieIcon, BarChart3, LineChart as LineIcon, TrendingUp, 
  TrendingDown, Filter, AlertCircle, CheckCircle, DollarSign, Activity
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { getCategoryChildren } from '../utils/categoryLoader';

type ChartType = 'pie' | 'bar' | 'line' | 'area';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
}

export function Analytics({ transactions, categories }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [categoryChartType, setCategoryChartType] = useState<ChartType>('pie');
  const [merchantChartType, setMerchantChartType] = useState<ChartType>('bar');
  const [timeChartType, setTimeChartType] = useState<ChartType>('line');
  
  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPayees, setSelectedPayees] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Get user's currency
  const userCurrency = localStorage.getItem('default-currency') || 'USD';

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Date filter
      if (dateRange.start && t.date < new Date(dateRange.start)) return false;
      if (dateRange.end && t.date > new Date(dateRange.end + 'T23:59:59')) return false;
      
      // Category filter (includes children)
      if (selectedCategories.length > 0) {
        if (!t.category) return false;
        
        const matchesCategory = selectedCategories.some(selectedCat => {
          if (t.category === selectedCat) return true;
          
          // Check if transaction category is a child of selected category
          const children = getCategoryChildren(selectedCat, categories);
          return children.some(child => child.name === t.category);
        });
        
        if (!matchesCategory) return false;
      }
      
      // Payee filter
      if (selectedPayees.length > 0 && !selectedPayees.includes(t.payee)) {
        return false;
      }
      
      return true;
    });
  }, [transactions, dateRange, selectedCategories, selectedPayees, categories]);

  const spending = filteredTransactions.filter(t => t.amount < 0);
  const income = filteredTransactions.filter(t => t.amount > 0);

  const totalSpending = Math.abs(spending.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  
  const subscriptionSpending = Math.abs(
    spending.filter(t => {
      const cat = categories.find(c => c.name === t.category);
      return cat?.isSubscription;
    }).reduce((sum, t) => sum + t.amount, 0)
  );

  const savingsAmount = income.filter(t => t.isSaving).reduce((sum, t) => sum + t.amount, 0);
  
  const savingsGoal = (() => {
    const saved = localStorage.getItem('savings-goal');
    return saved ? JSON.parse(saved) : { amount: 0, period: 'year' };
  })();

  const savingsProgress = savingsGoal.amount > 0 ? (savingsAmount / savingsGoal.amount) * 100 : 0;

  // Additional insights
  const avgDailySpending = useMemo(() => {
    if (spending.length === 0) return 0;
    const dates = spending.map(t => t.date.getTime());
    const days = Math.max(1, Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)));
    return totalSpending / days;
  }, [spending, totalSpending]);

  const avgTransactionSize = useMemo(() => {
    return spending.length > 0 ? totalSpending / spending.length : 0;
  }, [spending, totalSpending]);

  const largestExpense = useMemo(() => {
    if (spending.length === 0) return null;
    return spending.reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max);
  }, [spending]);

  const mostFrequentCategory = useMemo(() => {
    if (spending.length === 0) return null;
    const counts = new Map<string, number>();
    spending.forEach(t => {
      const cat = t.category || 'Uncategorized';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const [category, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return { category, count };
  }, [spending]);

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
    const map = new Map<string, { spending: number; income: number; net: number }>();
    filteredTransactions.forEach(t => {
      const month = t.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      const entry = map.get(month) || { spending: 0, income: 0, net: 0 };
      if (t.amount < 0) {
        entry.spending += Math.abs(t.amount);
      } else {
        entry.income += t.amount;
      }
      entry.net = entry.income - entry.spending;
      map.set(month, entry);
    });
    return Array.from(map.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [filteredTransactions]);

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

  // Spending trends
  const spendingTrend = useMemo(() => {
    if (overTime.length < 2) return 0;
    const recent = overTime.slice(-3).reduce((sum, m) => sum + m.spending, 0) / Math.min(3, overTime.length);
    const older = overTime.slice(0, -3).reduce((sum, m) => sum + m.spending, 0) / Math.max(1, overTime.length - 3);
    return older > 0 ? ((recent - older) / older) * 100 : 0;
  }, [overTime]);

  // Get unique payees for filter
  const uniquePayees = useMemo(() => {
    const payees = new Set(transactions.map(t => t.payee));
    return Array.from(payees).sort();
  }, [transactions]);

  // Get root categories for filter
  const rootCategories = useMemo(() => {
    return categories.filter(c => !c.parent);
  }, [categories]);

  const formatAmount = (value: number) => formatCurrency(value, userCurrency);
  const formatShort = (value: number) => {
    const formatted = formatCurrency(value, userCurrency);
    return formatted.replace(/\.\d+/, '');
  };

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const togglePayeeFilter = (payee: string) => {
    setSelectedPayees(prev =>
      prev.includes(payee)
        ? prev.filter(p => p !== payee)
        : [...prev, payee]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedPayees([]);
    setDateRange({ start: '', end: '' });
  };

  const ChartTypeSelector = ({
    value,
    onChange,
    options = ['pie', 'bar', 'line', 'area']
  }: {
    value: ChartType;
    onChange: (type: ChartType) => void;
    options?: ChartType[];
  }) => {
    const icons: Record<ChartType, typeof PieIcon> = {
      pie: PieIcon,
      bar: BarChart3,
      line: LineIcon,
      area: TrendingUp,
    };

    return (
      <div className="flex gap-1">
        {options.map(type => {
          const Icon = icons[type];
          return (
            <button
              key={type}
              onClick={() => onChange(type)}
              className={`p-1.5 rounded ${value === type ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title={type.charAt(0).toUpperCase() + type.slice(1)}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    );
  };

  const renderCategoryChart = () => {
    switch (categoryChartType) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={byCategory}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
            >
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={formatAmount} />
          </PieChart>
        );
      case 'bar':
        return (
          <BarChart data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <Bar dataKey="value">
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        );
      case 'line':
      case 'area':
        const ChartComponent = categoryChartType === 'line' ? LineChart : AreaChart;
        const DataComponent = categoryChartType === 'line' ? Line : Area;
        return (
          <ChartComponent data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <DataComponent type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" />
          </ChartComponent>
        );
    }
  };

  const renderMerchantChart = () => {
    switch (merchantChartType) {
      case 'bar':
        return (
          <BarChart data={topPayees} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={formatShort} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatAmount} />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={topPayees} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
              {topPayees.map((_, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(${index * 36}, 70%, 50%)`} />
              ))}
            </Pie>
            <Tooltip formatter={formatAmount} />
            <Legend />
          </PieChart>
        );
      default:
        return (
          <BarChart data={topPayees}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        );
    }
  };

  const renderTimeChart = () => {
    switch (timeChartType) {
      case 'line':
        return (
          <LineChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} />
            <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <Legend />
            <Area type="monotone" dataKey="income" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
            <Area type="monotone" dataKey="spending" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatShort} />
            <Tooltip formatter={formatAmount} />
            <Legend />
            <Bar dataKey="income" fill="#22c55e" />
            <Bar dataKey="spending" fill="#ef4444" />
          </BarChart>
        );
      default:
        return renderTimeChart();
    }
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedPayees.length > 0 || dateRange.start || dateRange.end;

  return (
    <div>
      {/* Header with Filters */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1 border rounded-md hover:bg-gray-50 ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {selectedCategories.length + selectedPayees.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <PieIcon size={16} />
                Categories
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {rootCategories.map(cat => (
                  <label key={cat.name} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.name)}
                      onChange={() => toggleCategoryFilter(cat.name)}
                      className="rounded"
                    />
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-sm">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <DollarSign size={16} />
                Payees (Top 20)
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {uniquePayees.slice(0, 20).map(payee => (
                  <label key={payee} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPayees.includes(payee)}
                      onChange={() => togglePayeeFilter(payee)}
                      className="rounded"
                    />
                    <span className="text-sm truncate">{payee}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="text-2xl font-bold text-green-600">{formatAmount(totalIncome)}</div>
          <div className="text-xs text-gray-400 mt-1">{income.length} transactions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Spending</div>
          <div className="text-2xl font-bold text-red-600">{formatAmount(totalSpending)}</div>
          <div className="text-xs text-gray-400 mt-1">{spending.length} transactions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Net</div>
          <div className={`text-2xl font-bold ${totalIncome - totalSpending >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatAmount(totalIncome - totalSpending)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            {spendingTrend > 0 ? <TrendingUp size={12} className="text-red-500" /> : <TrendingDown size={12} className="text-green-500" />}
            {Math.abs(spendingTrend).toFixed(1)}% trend
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Subscriptions</div>
          <div className="text-2xl font-bold text-purple-600">{formatAmount(subscriptionSpending)}</div>
          <div className="text-xs text-gray-400 mt-1">{totalSpending > 0 ? ((subscriptionSpending / totalSpending) * 100).toFixed(1) : 0}% of spending</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Savings ({savingsGoal.period})</div>
          <div className="text-2xl font-bold text-blue-600">{formatAmount(savingsAmount)}</div>
          {savingsGoal.amount > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(savingsProgress, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-400 mt-1">{savingsProgress.toFixed(0)}% of {formatAmount(savingsGoal.amount)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Insights Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Activity size={16} />
            <span className="text-sm font-medium">Avg Daily Spending</span>
          </div>
          <div className="text-xl font-bold text-blue-900">{formatAmount(avgDailySpending)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-700 mb-2">
            <BarChart3 size={16} />
            <span className="text-sm font-medium">Avg Transaction</span>
          </div>
          <div className="text-xl font-bold text-purple-900">{formatAmount(avgTransactionSize)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-700 mb-2">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Largest Expense</span>
          </div>
          <div className="text-xl font-bold text-orange-900">
            {largestExpense ? formatAmount(Math.abs(largestExpense.amount)) : '-'}
          </div>
          {largestExpense && (
            <div className="text-xs text-orange-700 mt-1 truncate">{largestExpense.payee}</div>
          )}
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Top Category</span>
          </div>
          <div className="text-xl font-bold text-green-900">
            {mostFrequentCategory ? mostFrequentCategory.count : '-'}
          </div>
          {mostFrequentCategory && (
            <div className="text-xs text-green-700 mt-1 truncate">{mostFrequentCategory.category}</div>
          )}
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No transactions found for the selected filters.
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Spending by Category</h3>
                <ChartTypeSelector value={categoryChartType} onChange={setCategoryChartType} />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {renderCategoryChart()}
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Top Merchants</h3>
                <ChartTypeSelector
                  value={merchantChartType}
                  onChange={setMerchantChartType}
                  options={['bar', 'pie']}
                />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {renderMerchantChart()}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Income vs Spending Over Time</h3>
              <ChartTypeSelector
                value={timeChartType}
                onChange={setTimeChartType}
                options={['line', 'area', 'bar']}
              />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              {renderTimeChart()}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

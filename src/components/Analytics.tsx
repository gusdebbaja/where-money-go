import { useState, useMemo } from 'react';
import { Transaction, Category } from '../types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Calendar, PieChart as PieIcon, BarChart3, LineChart as LineIcon, TrendingUp } from 'lucide-react';

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

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (dateRange.start && t.date < new Date(dateRange.start)) return false;
      if (dateRange.end && t.date > new Date(dateRange.end + 'T23:59:59')) return false;
      return true;
    });
  }, [transactions, dateRange]);

  const spending = filteredTransactions.filter(t => t.amount < 0);
  const income = filteredTransactions.filter(t => t.amount > 0);

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
    filteredTransactions.forEach(t => {
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

  const formatCurrency = (value: number) => `$${value.toFixed(0)}`;

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
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={formatCurrency} />
          </PieChart>
        );
      case 'bar':
        return (
          <BarChart data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
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
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
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
            <XAxis type="number" tickFormatter={formatCurrency} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatCurrency} />
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
            <Tooltip formatter={formatCurrency} />
            <Legend />
          </PieChart>
        );
      case 'line':
      case 'area':
        return (
          <BarChart data={topPayees}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
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
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
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
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Bar dataKey="income" fill="#22c55e" />
            <Bar dataKey="spending" fill="#ef4444" />
          </BarChart>
        );
      default:
        return renderTimeChart();
    }
  };

  return (
    <div>
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
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

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

      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No transactions found for the selected date range.
        </div>
      ) : (
        <>
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

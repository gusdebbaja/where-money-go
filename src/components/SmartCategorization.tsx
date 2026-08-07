import { useState, useMemo } from 'react';
import { Transaction, Category } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  Brain, TrendingUp, Calendar, Users, Zap, CheckCircle, X, 
  BarChart3, LineChart as LineIcon, PieChart as PieIcon
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import {
  normalizePayeeName,
  batchSmartCategorize,
  getPayeeSpendingStats
} from '../utils/smartCategorization';

interface SmartCategorizationProps {
  transactions: Transaction[];
  categories: Category[];
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
}

type TimeGrouping = 'day' | 'week' | 'month';
type ChartType = 'bar' | 'line' | 'area' | 'pie';

export function SmartCategorization({ transactions, categories: _categories, onBulkUpdate }: SmartCategorizationProps) {
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>('month');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  
  const userCurrency = localStorage.getItem('default-currency') || 'USD';
  
  // Smart categorization analysis
  const smartAnalysis = useMemo(() => {
    const spending = transactions.filter(t => t.amount < 0);
    const suggestions = batchSmartCategorize(spending);
    const payeeStats = getPayeeSpendingStats(spending);
    
    // Find uncategorized transactions that have good suggestions
    const goodSuggestions = Array.from(suggestions.entries())
      .filter(([payee, suggestion]) => {
        const txns = spending.filter(t => t.payee === payee);
        const hasUncategorized = txns.some(t => !t.category);
        return hasUncategorized && suggestion.confidence > 0.7;
      })
      .map(([payee, suggestion]) => ({
        payee,
        normalizedPayee: suggestion.normalizedPayee,
        suggestedCategory: suggestion.suggestedCategory,
        confidence: suggestion.confidence,
        transactionCount: spending.filter(t => t.payee === payee).length,
        totalAmount: spending.filter(t => t.payee === payee).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
    
    return {
      suggestions,
      payeeStats,
      goodSuggestions
    };
  }, [transactions]);
  
  // Time-based spending analysis
  const timeBasedData = useMemo(() => {
    const spending = transactions.filter(t => t.amount < 0);
    const grouped = new Map<string, Map<string, number>>();
    
    spending.forEach(t => {
      const normalizedPayee = normalizePayeeName(t.payee);
      let timeKey: string;
      
      switch (timeGrouping) {
        case 'day':
          timeKey = t.date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const weekStart = new Date(t.date);
          weekStart.setDate(t.date.getDate() - t.date.getDay());
          timeKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          timeKey = t.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          break;
      }
      
      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, new Map());
      }
      
      const timeGroup = grouped.get(timeKey)!;
      timeGroup.set(normalizedPayee, (timeGroup.get(normalizedPayee) || 0) + Math.abs(t.amount));
    });
    
    // Convert to chart data
    const allPayees = new Set<string>();
    spending.forEach(t => allPayees.add(normalizePayeeName(t.payee)));
    const topPayees = Array.from(allPayees)
      .map(payee => ({
        payee,
        total: spending
          .filter(t => normalizePayeeName(t.payee) === payee)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(p => p.payee);
    
    const chartData = Array.from(grouped.entries())
      .map(([timeKey, payeeMap]) => {
        const dataPoint: any = { time: timeKey };
        topPayees.forEach(payee => {
          dataPoint[payee] = payeeMap.get(payee) || 0;
        });
        return dataPoint;
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    return { chartData, topPayees };
  }, [transactions, timeGrouping]);
  
  const formatAmount = (value: number) => formatCurrency(value, userCurrency);
  
  const applySuggestion = (payee: string, category: string) => {
    if (!onBulkUpdate) return;
    
    const txnIds = transactions
      .filter(t => t.payee === payee && !t.category)
      .map(t => t.id);
    
    if (txnIds.length > 0) {
      onBulkUpdate(txnIds, { category });
    }
  };
  
  const applySelectedSuggestions = () => {
    if (!onBulkUpdate) return;
    
    selectedSuggestions.forEach(payee => {
      const suggestion = smartAnalysis.goodSuggestions.find(s => s.payee === payee);
      if (suggestion) {
        applySuggestion(payee, suggestion.suggestedCategory);
      }
    });
    
    setSelectedSuggestions(new Set());
    setShowSuggestions(false);
  };
  
  const toggleSuggestion = (payee: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(payee)) {
        next.delete(payee);
      } else {
        next.add(payee);
      }
      return next;
    });
  };
  
  const renderChart = () => {
    const { chartData, topPayees } = timeBasedData;
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => formatCurrency(value, userCurrency).replace(/\.\d+/, '')} />
            <Tooltip formatter={formatAmount} />
            {topPayees.map((payee, index) => (
              <Bar 
                key={payee} 
                dataKey={payee} 
                stackId="spending"
                fill={colors[index % colors.length]} 
              />
            ))}
          </BarChart>
        );
      
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => formatCurrency(value, userCurrency).replace(/\.\d+/, '')} />
            <Tooltip formatter={formatAmount} />
            {topPayees.slice(0, 5).map((payee, index) => (
              <Line 
                key={payee} 
                type="monotone" 
                dataKey={payee} 
                stroke={colors[index % colors.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => formatCurrency(value, userCurrency).replace(/\.\d+/, '')} />
            <Tooltip formatter={formatAmount} />
            {topPayees.slice(0, 5).map((payee, index) => (
              <Area 
                key={payee} 
                type="monotone" 
                dataKey={payee} 
                stackId="1"
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        );
      
      case 'pie':
        const pieData = topPayees.map((payee, index) => ({
          name: payee,
          value: chartData.reduce((sum, d) => sum + (d[payee] || 0), 0),
          fill: colors[index % colors.length]
        }));
        
        return (
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={formatAmount} />
          </PieChart>
        );
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Brain className="text-purple-600" size={24} />
          <h2 className="text-2xl font-bold">Smart Categorization & Analysis</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <Zap size={16} />
            Smart Suggestions ({smartAnalysis.goodSuggestions.length})
          </button>
        </div>
      </div>
      
      {/* Smart Suggestions Panel */}
      {showSuggestions && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Smart Categorization Suggestions</h3>
            <div className="flex gap-2">
              {selectedSuggestions.size > 0 && (
                <button
                  onClick={applySelectedSuggestions}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Apply Selected ({selectedSuggestions.size})
                </button>
              )}
              <button
                onClick={() => setShowSuggestions(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {smartAnalysis.goodSuggestions.map(suggestion => (
              <div key={suggestion.payee} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(suggestion.payee)}
                    onChange={() => toggleSuggestion(suggestion.payee)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">{suggestion.normalizedPayee}</div>
                    <div className="text-sm text-gray-500">
                      {suggestion.transactionCount} transactions • {formatAmount(suggestion.totalAmount)}
                    </div>
                    <div className="text-xs text-gray-400">Original: {suggestion.payee}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                    {suggestion.suggestedCategory}
                  </span>
                  <span className="text-xs text-gray-500">
                    {(suggestion.confidence * 100).toFixed(0)}% confident
                  </span>
                  <button
                    onClick={() => applySuggestion(suggestion.payee, suggestion.suggestedCategory)}
                    className="p-1 text-green-600 hover:text-green-700"
                    title="Apply suggestion"
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Spending Analysis Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Spending Analysis by Normalized Payees</h3>
          <div className="flex items-center gap-4">
            {/* Time Grouping */}
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <select
                value={timeGrouping}
                onChange={(e) => setTimeGrouping(e.target.value as TimeGrouping)}
                className="border rounded px-3 py-1"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
            
            {/* Chart Type */}
            <div className="flex gap-1">
              {[
                { type: 'bar' as ChartType, icon: BarChart3 },
                { type: 'line' as ChartType, icon: LineIcon },
                { type: 'area' as ChartType, icon: TrendingUp },
                { type: 'pie' as ChartType, icon: PieIcon }
              ].map(({ type, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`p-2 rounded ${chartType === type ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title={type.charAt(0).toUpperCase() + type.slice(1)}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
      
      {/* Top Normalized Payees */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Users size={16} />
          Top Spending by Normalized Payees
        </h3>
        <div className="space-y-3">
          {smartAnalysis.payeeStats.slice(0, 10).map((stat, index) => (
            <div key={stat.normalizedPayee} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{stat.normalizedPayee}</div>
                  <div className="text-sm text-gray-500">
                    {stat.frequency} transactions • Avg: {formatAmount(stat.avgTransaction)}
                  </div>
                  <div className="text-xs text-gray-400">
                    Variants: {stat.originalPayees.slice(0, 2).join(', ')}
                    {stat.originalPayees.length > 2 && ` +${stat.originalPayees.length - 2} more`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{formatAmount(stat.totalSpent)}</div>
                <div className="text-xs text-gray-500">
                  Last: {stat.lastTransaction.toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
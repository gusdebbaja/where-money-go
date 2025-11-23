import { useState } from 'react';
import { Transaction, ColumnMapping, AppView } from './types';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { TransactionList } from './components/TransactionList';
import { Analytics } from './components/Analytics';
import { Upload, Map, List, BarChart3 } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', color: '#ef4444' },
  { name: 'Transportation', color: '#f97316' },
  { name: 'Shopping', color: '#eab308' },
  { name: 'Entertainment', color: '#22c55e' },
  { name: 'Bills & Utilities', color: '#3b82f6' },
  { name: 'Healthcare', color: '#8b5cf6' },
  { name: 'Income', color: '#10b981' },
  { name: 'Other', color: '#6b7280' },
];

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories] = useState(DEFAULT_CATEGORIES);

  const handleFileUpload = (data: string[][], fileHeaders: string[]) => {
    setRawData(data);
    setHeaders(fileHeaders);
    setView('mapping');
  };

  const handleMappingComplete = (columnMapping: ColumnMapping) => {
    setMapping(columnMapping);

    const parsed: Transaction[] = rawData.map((row, index) => {
      const dateIdx = headers.indexOf(columnMapping.date);
      const payeeIdx = headers.indexOf(columnMapping.payee);
      const amountIdx = headers.indexOf(columnMapping.amount);
      const descIdx = columnMapping.description ? headers.indexOf(columnMapping.description) : -1;

      const rawAmount = row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0';

      return {
        id: `txn-${index}`,
        date: new Date(row[dateIdx]),
        payee: row[payeeIdx] || 'Unknown',
        amount: parseFloat(rawAmount),
        description: descIdx >= 0 ? row[descIdx] : undefined,
        category: undefined,
        tags: [],
      };
    }).filter(t => !isNaN(t.date.getTime()) && !isNaN(t.amount));

    setTransactions(parsed);
    setView('transactions');
  };

  const handleUpdateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  };

  const navItems = [
    { view: 'upload' as AppView, icon: Upload, label: 'Upload' },
    { view: 'mapping' as AppView, icon: Map, label: 'Map', disabled: !headers.length },
    { view: 'transactions' as AppView, icon: List, label: 'Transactions', disabled: !transactions.length },
    { view: 'analytics' as AppView, icon: BarChart3, label: 'Analytics', disabled: !transactions.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Where Money Go?</h1>
            <div className="flex space-x-1">
              {navItems.map(({ view: v, icon: Icon, label, disabled }) => (
                <button
                  key={v}
                  onClick={() => !disabled && setView(v)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2
                    ${view === v ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'upload' && <FileUpload onUpload={handleFileUpload} />}
        {view === 'mapping' && (
          <ColumnMapper
            headers={headers}
            sampleData={rawData.slice(0, 3)}
            onComplete={handleMappingComplete}
          />
        )}
        {view === 'transactions' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            onUpdate={handleUpdateTransaction}
          />
        )}
        {view === 'analytics' && (
          <Analytics transactions={transactions} categories={categories} />
        )}
      </main>
    </div>
  );
}

export default App;

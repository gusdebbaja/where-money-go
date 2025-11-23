import { useState, useEffect } from 'react';
import { Transaction, ColumnMapping, AppView } from './types';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { TransactionList } from './components/TransactionList';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { Upload, Map, List, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import * as storage from './storage';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Initialize storage and load data
  useEffect(() => {
    const init = async () => {
      // Load storage settings
      const saved = localStorage.getItem('storage-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        storage.setStorageType(settings.type);
        if (settings.backendUrl) {
          storage.setBackendUrl(settings.backendUrl);
        }
      }

      // Initialize IndexedDB
      await storage.initDB();

      // Load existing data
      await loadData();
      setLoading(false);
    };
    init();
  }, []);

  const loadData = async () => {
    try {
      const [loadedTxns, loadedCats] = await Promise.all([
        storage.getTransactions(),
        storage.getCategories(),
      ]);
      setTransactions(loadedTxns);
      if (loadedCats.length > 0) {
        setCategories(loadedCats);
      }
      if (loadedTxns.length > 0) {
        setView('transactions');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleFileUpload = (data: string[][], fileHeaders: string[]) => {
    setRawData(data);
    setHeaders(fileHeaders);
    setView('mapping');
  };

  const handleMappingComplete = async (columnMapping: ColumnMapping) => {
    const getIdx = (field?: string) => field ? headers.indexOf(field) : -1;

    const parsed: Transaction[] = rawData.map((row, index) => {
      const dateIdx = getIdx(columnMapping.date);
      const payeeIdx = getIdx(columnMapping.payee);
      const amountIdx = getIdx(columnMapping.amount);
      const txnIdIdx = getIdx(columnMapping.transactionId);
      const typeIdx = getIdx(columnMapping.type);
      const descIdx = getIdx(columnMapping.description);
      const accountIdx = getIdx(columnMapping.account);
      const balanceIdx = getIdx(columnMapping.balance);
      const refIdx = getIdx(columnMapping.reference);

      const rawAmount = row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0';
      const rawBalance = balanceIdx >= 0 ? row[balanceIdx]?.replace(/[^0-9.-]/g, '') : undefined;
      const rawType = typeIdx >= 0 ? row[typeIdx]?.toLowerCase() : undefined;

      return {
        id: `txn-${Date.now()}-${index}`,
        transactionId: txnIdIdx >= 0 ? row[txnIdIdx] : undefined,
        date: new Date(row[dateIdx]),
        payee: row[payeeIdx] || 'Unknown',
        amount: parseFloat(rawAmount),
        type: rawType?.includes('credit') ? 'credit' : rawType?.includes('debit') ? 'debit' : undefined,
        description: descIdx >= 0 ? row[descIdx] : undefined,
        category: undefined,
        tags: [],
        account: accountIdx >= 0 ? row[accountIdx] : undefined,
        balance: rawBalance ? parseFloat(rawBalance) : undefined,
        reference: refIdx >= 0 ? row[refIdx] : undefined,
      };
    }).filter(t => !isNaN(t.date.getTime()) && !isNaN(t.amount));

    // Check for duplicates if transaction IDs are provided
    const txnIds = parsed.filter(t => t.transactionId).map(t => t.transactionId!);
    let duplicates = new Set<string>();
    if (txnIds.length > 0) {
      duplicates = await storage.checkDuplicates(txnIds);
    }

    // Filter out duplicates
    const newTransactions = parsed.filter(t => !t.transactionId || !duplicates.has(t.transactionId));

    if (duplicates.size > 0) {
      alert(`Skipped ${duplicates.size} duplicate transaction(s)`);
    }

    // Save to storage
    const allTransactions = [...transactions, ...newTransactions];
    await storage.saveTransactions(allTransactions);
    setTransactions(allTransactions);
    setView('transactions');
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const updated = transactions.map(t => t.id === id ? { ...t, ...updates } : t);
    setTransactions(updated);
    await storage.saveTransactions(updated);
  };

  const handleStorageChange = () => {
    loadData();
  };

  const navItems = [
    { view: 'upload' as AppView, icon: Upload, label: 'Upload' },
    { view: 'mapping' as AppView, icon: Map, label: 'Map', disabled: !headers.length },
    { view: 'transactions' as AppView, icon: List, label: 'Transactions', disabled: !transactions.length },
    { view: 'analytics' as AppView, icon: BarChart3, label: 'Analytics', disabled: !transactions.length },
    { view: 'settings' as AppView, icon: SettingsIcon, label: 'Settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

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
        {view === 'settings' && (
          <Settings onStorageChange={handleStorageChange} />
        )}
      </main>
    </div>
  );
}

export default App;

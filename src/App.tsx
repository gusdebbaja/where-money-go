import { useState, useEffect } from 'react';
import { Transaction, ColumnMapping, AppView, Category } from './types';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { TransactionList } from './components/TransactionList';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { Upload, Map, List, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import * as storage from './storage';
import { loadCategoriesFromYaml } from './utils/categoryLoader';

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

      // Load categories from YAML
      const loadedCategories = await loadCategoriesFromYaml();
      setCategories(loadedCategories);

      // Load existing data
      await loadData();
      setLoading(false);
    };
    init();
  }, []);

  const loadData = async () => {
    try {
      const loadedTxns = await storage.getTransactions();
      setTransactions(loadedTxns);
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
      const amount = parseFloat(rawAmount);
      const payee = row[payeeIdx] || 'Unknown';
      const description = descIdx >= 0 ? row[descIdx] : undefined;

      // Auto-detect savings: positive amount with keywords like "transfer", "savings", "deposit"
      const savingsKeywords = ['savings', 'transfer to savings', 'deposit', 'investment'];
      const isSaving = amount > 0 && savingsKeywords.some(kw => 
        payee.toLowerCase().includes(kw) || description?.toLowerCase().includes(kw)
      );

      const txnType: 'credit' | 'debit' | undefined = rawType?.includes('credit') ? 'credit' : rawType?.includes('debit') ? 'debit' : undefined;

      return {
        id: `txn-${Date.now()}-${index}`,
        transactionId: txnIdIdx >= 0 ? row[txnIdIdx] : undefined,
        date: new Date(row[dateIdx]),
        payee,
        amount,
        type: txnType,
        description,
        category: undefined,
        tags: [],
        account: accountIdx >= 0 ? row[accountIdx] : undefined,
        balance: rawBalance ? parseFloat(rawBalance) : undefined,
        reference: refIdx >= 0 ? row[refIdx] : undefined,
        isSaving,
      };
    }).filter(t => !isNaN(t.date.getTime()) && !isNaN(t.amount));

    // Check for duplicates based on duplicate detection setting
    const duplicateDetection = localStorage.getItem('duplicate-detection') || 'strict';
    const duplicateIndices = new Set<number>();
    
    if (duplicateDetection === 'strict') {
      // A transaction is duplicate if date, payee, and amount all match an existing transaction
      parsed.forEach((newTxn, index) => {
        const isDuplicate = transactions.some(existingTxn => 
          existingTxn.date.getTime() === newTxn.date.getTime() &&
          existingTxn.payee === newTxn.payee &&
          existingTxn.amount === newTxn.amount
        );
        
        if (isDuplicate) {
          duplicateIndices.add(index);
        }
      });
    }

    // Filter out duplicates
    const newTransactions = parsed.filter((_, index) => !duplicateIndices.has(index));

    if (duplicateIndices.size > 0) {
      alert(`Skipped ${duplicateIndices.size} duplicate transaction(s) based on date, payee, and amount`);
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

  const handleBulkUpdate = async (ids: string[], updates: Partial<Transaction>) => {
    const idSet = new Set(ids);
    const updated = transactions.map(t => idSet.has(t.id) ? { ...t, ...updates } : t);
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
            onBulkUpdate={handleBulkUpdate}
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

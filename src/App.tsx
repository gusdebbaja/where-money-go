import { useState, useEffect, useCallback, useTransition } from 'react';
import { Transaction, ColumnMapping, AppView, Category } from './types';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { TransactionList } from './components/TransactionList';
import { Analytics } from './components/Analytics';
import { InteractiveAnalytics } from './components/InteractiveAnalytics';
import { SubscriptionDashboard } from './components/SubscriptionDashboard';
import { CategoryDrilldown } from './components/CategoryDrilldown';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Upload, Map as MapIcon, List, BarChart3, Activity, CreditCard, Target, Settings as SettingsIcon } from 'lucide-react';
import * as storage from './storage';
import { loadCategoriesFromYaml } from './utils/categoryLoader';
import { useToast } from './context/ToastContext';

const VIEW_MESSAGES: Record<AppView, { title: string; sub: string }> = {
  upload:        { title: 'Preparing upload…',          sub: 'Getting ready for your data' },
  mapping:       { title: 'Loading column mapper…',     sub: 'Analysing your file structure' },
  transactions:  { title: 'Loading your ledger…',       sub: 'Sorting through transactions' },
  analytics:     { title: 'Crunching your numbers…',    sub: 'Computing spending breakdowns' },
  interactive:   { title: 'Building your dashboard…',   sub: 'Assembling interactive charts' },
  subscriptions: { title: 'Scanning for subscriptions…',sub: 'Detecting recurring payments' },
  drilldown:     { title: 'Drilling into spending…',    sub: 'Grouping by category & payee' },
  settings:      { title: 'Loading preferences…',       sub: '' },
};

function App() {
  const showToast = useToast();
  const [view, setView] = useState<AppView>('upload');
  const [pendingView, setPendingView] = useState<AppView | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [importProgress, setImportProgress] = useState<{ message: string; sub: string; progress: number } | null>(null);
  // Lazy-mount: once visited, a view stays in the DOM so its memo cache survives navigation
  const [mountedViews, setMountedViews] = useState<Set<AppView>>(() => new Set(['upload']));
  // When Analytics pie is clicked, carry the category + date range into Drilldown
  const [drilldownInitial, setDrilldownInitial] = useState<{ category: string; dateRange: { start: string; end: string } } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const loadedTxns = await storage.getTransactions();
      setTransactions(loadedTxns);
      if (loadedTxns.length > 0) {
        setView('transactions');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load transactions. Try refreshing the page.', 'error');
    }
  }, []);

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
  }, [loadData]);

  const handleFileUpload = (data: string[][], fileHeaders: string[]) => {
    setRawData(data);
    setHeaders(fileHeaders);
    setView('mapping');
  };

  const handleMappingComplete = async (columnMapping: ColumnMapping) => {
    const getIdx = (field?: string) => field ? headers.indexOf(field) : -1;

    const dateIdx   = getIdx(columnMapping.date);
    const payeeIdx  = getIdx(columnMapping.payee);
    const amountIdx = getIdx(columnMapping.amount);
    const txnIdIdx  = getIdx(columnMapping.transactionId);
    const typeIdx   = getIdx(columnMapping.type);
    const descIdx   = getIdx(columnMapping.description);
    const accountIdx = getIdx(columnMapping.account);
    const balanceIdx = getIdx(columnMapping.balance);
    const refIdx    = getIdx(columnMapping.reference);

    setImportProgress({ message: 'Parsing rows…', sub: `Processing ${rawData.length.toLocaleString()} rows`, progress: 5 });
    await new Promise(r => setTimeout(r, 0));

    const savingsKeywords = ['savings', 'transfer to savings', 'deposit', 'investment'];

    const parsed: Transaction[] = rawData.map((row, index) => {
      const rawAmount  = row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0';
      const rawBalance = balanceIdx >= 0 ? row[balanceIdx]?.replace(/[^0-9.-]/g, '') : undefined;
      const rawType    = typeIdx >= 0 ? row[typeIdx]?.toLowerCase() : undefined;
      const amount     = parseFloat(rawAmount);
      const payee      = row[payeeIdx] || 'Unknown';
      const description = descIdx >= 0 ? row[descIdx] : undefined;
      const isSaving   = amount > 0 && savingsKeywords.some(kw =>
        payee.toLowerCase().includes(kw) || description?.toLowerCase().includes(kw)
      );
      const txnType: 'credit' | 'debit' | undefined =
        rawType?.includes('credit') ? 'credit' : rawType?.includes('debit') ? 'debit' : undefined;

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

    // Chunked duplicate detection so the UI can show progress
    const duplicateDetection = localStorage.getItem('duplicate-detection') || 'strict';
    const duplicateIndices = new Set<number>();

    if (duplicateDetection === 'strict' && transactions.length > 0) {
      const CHUNK = 300;
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const end = Math.min(i + CHUNK, parsed.length);
        for (let j = i; j < end; j++) {
          const t = parsed[j];
          if (transactions.some(e =>
            e.date.getTime() === t.date.getTime() &&
            e.payee === t.payee &&
            e.amount === t.amount
          )) duplicateIndices.add(j);
        }
        const pct = 10 + ((i + CHUNK) / parsed.length) * 75;
        setImportProgress({
          message: 'Checking for duplicates…',
          sub: `Scanned ${Math.min(i + CHUNK, parsed.length).toLocaleString()} of ${parsed.length.toLocaleString()} rows`,
          progress: Math.min(pct, 85),
        });
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const newTransactions = parsed.filter((_, i) => !duplicateIndices.has(i));
    if (duplicateIndices.size > 0) {
      showToast(`Skipped ${duplicateIndices.size} duplicate transaction(s).`, 'info');
    }

    setImportProgress({ message: 'Saving to database…', sub: `Writing ${newTransactions.length.toLocaleString()} transactions`, progress: 92 });
    await new Promise(r => setTimeout(r, 0));

    const allTransactions = [...transactions, ...newTransactions];
    await storage.saveTransactions(allTransactions);

    setImportProgress({ message: 'Done!', sub: '', progress: 100 });
    await new Promise(r => setTimeout(r, 350));

    setImportProgress(null);
    setTransactions(allTransactions);
    startTransition(() => setView('transactions'));
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await storage.patchTransaction(id, updates);
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Transaction>) => {
    const idSet = new Set(ids);
    setTransactions(prev => prev.map(t => idSet.has(t.id) ? { ...t, ...updates } : t));
    await storage.patchTransactions(ids.map(id => ({ id, updates })));
  };

  const handleBatchUpdate = async (batchUpdates: Array<{ ids: string[], data: Partial<Transaction> }>) => {
    const updatesMap = new Map<string, Partial<Transaction>>();
    batchUpdates.forEach(({ ids, data }) => {
      ids.forEach(id => updatesMap.set(id, { ...(updatesMap.get(id) || {}), ...data }));
    });
    setTransactions(prev => prev.map(t => {
      const u = updatesMap.get(t.id);
      return u ? { ...t, ...u } : t;
    }));
    await storage.patchTransactions(Array.from(updatesMap.entries()).map(([id, updates]) => ({ id, updates })));
  };

  const handleSetView = (v: AppView) => {
    if (v === view) return;
    setMountedViews(prev => new Set([...prev, v]));
    setPendingView(v);
    startTransition(() => setView(v));
  };

  // Clear pendingView once the transition has committed
  useEffect(() => {
    if (!isPending) setPendingView(null);
  }, [isPending]);

  // Trigger chart resize after navigation so Recharts/ECharts re-measure their containers
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [view]);

  const handleDrilldownFromAnalytics = (category: string, dateRange: { start: string; end: string }) => {
    setDrilldownInitial({ category, dateRange });
    handleSetView('drilldown');
  };

  const handleStorageChange = () => {
    loadData();
  };

  const navItems = [
    { view: 'upload' as AppView, icon: Upload, label: 'Upload' },
    { view: 'mapping' as AppView, icon: MapIcon, label: 'Map', disabled: !headers.length },
    { view: 'transactions' as AppView, icon: List, label: 'Transactions', disabled: !transactions.length },
    { view: 'analytics' as AppView, icon: BarChart3, label: 'Analytics', disabled: !transactions.length },
    { view: 'interactive' as AppView, icon: Activity, label: 'Interactive', disabled: !transactions.length },
    { view: 'subscriptions' as AppView, icon: CreditCard, label: 'Subscriptions', disabled: !transactions.length },
    { view: 'drilldown' as AppView, icon: Target, label: 'Drilldown', disabled: !transactions.length },
    { view: 'settings' as AppView, icon: SettingsIcon, label: 'Settings' },
  ];

  if (loading) {
    return (
      <LoadingOverlay
        fullScreen
        message="Loading your financial data…"
        subMessage="Connecting to your local database"
      />
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
                  onClick={() => !disabled && handleSetView(v)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2
                    ${view === v || pendingView === v ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Icon size={16} />
                  {label}
                  {pendingView === v && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        {/* Upload & Mapping are never lazy-mounted — they need fresh state each time */}
        {view === 'upload' && (
          <ErrorBoundary label="Upload">
            <FileUpload onUpload={handleFileUpload} />
          </ErrorBoundary>
        )}
        {view === 'mapping' && (
          <ErrorBoundary label="Column Mapper">
            <ColumnMapper headers={headers} sampleData={rawData.slice(0, 3)} onComplete={handleMappingComplete} />
          </ErrorBoundary>
        )}

        {/* Data views: lazy-mounted so their useMemo cache survives navigation */}
        {mountedViews.has('transactions') && (
          <div style={{ display: view === 'transactions' ? undefined : 'none' }}>
            <ErrorBoundary label="Transactions">
              <TransactionList
                transactions={transactions}
                categories={categories}
                onUpdate={handleUpdateTransaction}
                onBulkUpdate={handleBulkUpdate}
                onBatchUpdate={handleBatchUpdate}
              />
            </ErrorBoundary>
          </div>
        )}
        {mountedViews.has('analytics') && (
          <div style={{ display: view === 'analytics' ? undefined : 'none' }}>
            <ErrorBoundary label="Analytics">
              <Analytics
                transactions={transactions}
                categories={categories}
                onDrilldown={handleDrilldownFromAnalytics}
              />
            </ErrorBoundary>
          </div>
        )}
        {mountedViews.has('interactive') && (
          <div style={{ display: view === 'interactive' ? undefined : 'none' }}>
            <ErrorBoundary label="Interactive Analytics">
              <InteractiveAnalytics transactions={transactions} />
            </ErrorBoundary>
          </div>
        )}
        {mountedViews.has('subscriptions') && (
          <div style={{ display: view === 'subscriptions' ? undefined : 'none' }}>
            <ErrorBoundary label="Subscriptions">
              <SubscriptionDashboard transactions={transactions} categories={categories} />
            </ErrorBoundary>
          </div>
        )}
        {mountedViews.has('drilldown') && (
          <div style={{ display: view === 'drilldown' ? undefined : 'none' }}>
            <ErrorBoundary label="Drilldown">
              <CategoryDrilldown
                transactions={transactions}
                categories={categories}
                initialCategory={drilldownInitial?.category}
                initialDateRange={drilldownInitial?.dateRange}
                onInitialConsumed={() => setDrilldownInitial(null)}
              />
            </ErrorBoundary>
          </div>
        )}
        {mountedViews.has('settings') && (
          <div style={{ display: view === 'settings' ? undefined : 'none' }}>
            <ErrorBoundary label="Settings">
              <Settings onStorageChange={handleStorageChange} categories={categories} transactions={transactions} />
            </ErrorBoundary>
          </div>
        )}

        {/* Tab-switch loading overlay */}
        {isPending && pendingView && (
          <LoadingOverlay
            message={VIEW_MESSAGES[pendingView].title}
            subMessage={VIEW_MESSAGES[pendingView].sub}
          />
        )}

        {/* Import progress overlay */}
        {importProgress && (
          <LoadingOverlay
            message={importProgress.message}
            subMessage={importProgress.sub}
            progress={importProgress.progress}
          />
        )}
      </main>
    </div>
  );
}

export default App;

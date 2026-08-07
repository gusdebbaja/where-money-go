import { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { useToast } from '../context/ToastContext';
import { StorageType, SavingsGoal, PayeeRenamingRule, Budget, Category, Transaction } from '../types';
import { setStorageType, setBackendUrl, getStorageType, testConnection, clearTransactions } from '../storage';
import { useTheme, Theme, Style } from '../context/ThemeContext';
import { Database, Cloud, Trash2, CheckCircle, XCircle, Sun, Moon, Smartphone, DollarSign, Target, Edit3, Plus, X, TrendingDown, ChevronLeft, ChevronRight, Download, Upload, Search, Layout } from 'lucide-react';
import { detectLocalCurrency, COMMON_CURRENCIES } from '../utils/currency';
import { getRenamingRules, saveRenamingRules, addRenamingRule, batchAddRenamingRules, extractPayeePattern } from '../utils/payeeRules';
import { getBudgets, saveBudgets, addBudget, deleteBudget } from '../utils/budgetManager';
import { load, dump } from 'js-yaml';

interface SettingsProps {
  onStorageChange: () => void;
  categories?: Category[];
  transactions?: Transaction[];
}

const ITEMS_PER_PAGE = 10;

export function Settings({ onStorageChange, categories = [], transactions = [] }: SettingsProps) {
  const showToast = useToast();
  const { theme, setTheme, style, setStyle } = useTheme();
  const [storage, setStorage] = useState<StorageType>(getStorageType());
  const [url, setUrl] = useState('http://localhost:3001');
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'failed'>('untested');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<string>(() => {
    const saved = localStorage.getItem('default-currency');
    return saved || detectLocalCurrency();
  });
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal>(() => {
    const saved = localStorage.getItem('savings-goal');
    return saved ? JSON.parse(saved) : { amount: 0, period: 'year' };
  });
  const [renamingRules, setRenamingRules] = useState<PayeeRenamingRule[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddRule, setShowAddRule] = useState(false);
  const renamingFileInputRef = useRef<HTMLInputElement>(null);
  const [newRule, setNewRule] = useState({ pattern: '', replacement: '', isRegex: false });
  const [duplicateDetection, setDuplicateDetection] = useState<'strict' | 'off'>(() => {
    const saved = localStorage.getItem('duplicate-detection');
    return (saved as 'strict' | 'off') || 'strict';
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ruleSearch, setRuleSearch] = useState('');
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudget, setNewBudget] = useState<Omit<Budget, 'id' | 'enabled'>>({
    category: '',
    amount: 0,
    period: 'month',
    includeChildren: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem('storage-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setStorage(settings.type);
      setUrl(settings.backendUrl || 'http://localhost:3001');
      setStorageType(settings.type);
      if (settings.backendUrl) {
        setBackendUrl(settings.backendUrl);
      }
    }
    setRenamingRules(getRenamingRules());
    setBudgets(getBudgets());
  }, []);

  const handleExportRenamingRules = () => {
    try {
      const yamlStr = dump(renamingRules);
      const blob = new Blob([yamlStr], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renaming-rules.yaml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting rules:', error);
      showToast('Error exporting rules to YAML.', 'error');
    }
  };

  const handleImportRenamingRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = load(content) as any[];
        
        if (Array.isArray(parsed)) {
          // Filter valid rules and strip IDs
          const validRules = parsed.filter(r => r.pattern && r.replacement).map(({ id, ...rest }) => rest);
          
          if (validRules.length > 0) {
            batchAddRenamingRules(validRules);
            setRenamingRules(getRenamingRules());
            showToast(`Successfully imported ${validRules.length} rules.`, 'success');
          } else {
            showToast('No valid rules found in YAML file.', 'warning');
          }
        } else {
          showToast('Invalid YAML format: expected an array of rules.', 'error');
        }
      } catch (error) {
        console.error('Error parsing YAML:', error);
        showToast('Error parsing YAML file.', 'error');
      }
      if (renamingFileInputRef.current) {
        renamingFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleStorageChange = (type: StorageType) => {
    setStorage(type);
    setStorageType(type);
    localStorage.setItem('storage-settings', JSON.stringify({ type, backendUrl: url }));
    onStorageChange();
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setBackendUrl(newUrl);
    setConnectionStatus('untested');
    localStorage.setItem('storage-settings', JSON.stringify({ type: storage, backendUrl: newUrl }));
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    const connected = await testConnection();
    setConnectionStatus(connected ? 'connected' : 'failed');
  };

  const handleClearData = async () => {
    await clearTransactions();
    setShowClearConfirm(false);
    onStorageChange();
  };

  const handleCurrencyChange = (currency: string) => {
    setDefaultCurrency(currency);
    localStorage.setItem('default-currency', currency);
  };

  const handleSavingsGoalChange = (goal: SavingsGoal) => {
    setSavingsGoal(goal);
    localStorage.setItem('savings-goal', JSON.stringify(goal));
  };

  const handleAddRule = () => {
    if (newRule.pattern && newRule.replacement) {
      addRenamingRule({
        ...newRule,
        enabled: true,
      });
      setRenamingRules(getRenamingRules());
      setNewRule({ pattern: '', replacement: '', isRegex: false });
      setShowAddRule(false);
    }
  };

  const handleToggleRule = (id: string) => {
    const updated = renamingRules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveRenamingRules(updated);
    setRenamingRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = renamingRules.filter(r => r.id !== id);
    saveRenamingRules(updated);
    setRenamingRules(updated);
  };

  const handleStripDateSuffixes = () => {
    addRenamingRule({
      pattern: DATE_SUFFIX_RULE_PATTERN,
      replacement: '',
      isRegex: true,
      enabled: true,
    });
    setRenamingRules(getRenamingRules());
    showToast(`Date suffix rule added — ${suffixInfo.count} payees will be cleaned up.`, 'success');
  };

  const handleDuplicateDetectionChange = (mode: 'strict' | 'off') => {
    setDuplicateDetection(mode);
    localStorage.setItem('duplicate-detection', mode);
  };

  const handleAddBudget = () => {
    if (newBudget.category && newBudget.amount > 0) {
      addBudget({
        ...newBudget,
        enabled: true,
      });
      setBudgets(getBudgets());
      setNewBudget({
        category: '',
        amount: 0,
        period: 'month',
        includeChildren: true,
      });
      setShowAddBudget(false);
    }
  };

  const handleToggleBudget = (id: string) => {
    const updated = budgets.map(b =>
      b.id === id ? { ...b, enabled: !b.enabled } : b
    );
    saveBudgets(updated);
    setBudgets(updated);
  };

  const handleDeleteBudget = (id: string) => {
    deleteBudget(id);
    setBudgets(getBudgets());
  };

  const rootCategories = categories.filter(c => !c.parent);

  const filteredRules = useMemo(() => {
    const q = ruleSearch.toLowerCase();
    if (!q) return renamingRules;
    return renamingRules.filter(r =>
      r.pattern.toLowerCase().includes(q) || r.replacement.toLowerCase().includes(q)
    );
  }, [renamingRules, ruleSearch]);

  // The global date-suffix stripping rule we'd create
  const DATE_SUFFIX_RULE_PATTERN = String.raw`\s*[\/&]\d{2}-\d{2}-\d{2,4}\s*$`;

  const suffixInfo = useMemo(() => {
    const affected = transactions.filter(t => extractPayeePattern(t.payee) !== t.payee.trim());
    const examples = Array.from(new Set(affected.map(t => t.payee))).slice(0, 3);
    const alreadyExists = renamingRules.some(r => r.pattern === DATE_SUFFIX_RULE_PATTERN);
    return { count: affected.length, examples, alreadyExists };
  }, [transactions, renamingRules]);

  const themes: { value: Theme; label: string; icon: typeof Sun; desc: string }[] = [
    { value: 'light', label: 'Light', icon: Sun, desc: 'Classic light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { value: 'amoled', label: 'AMOLED', icon: Smartphone, desc: 'Pure black for OLED' },
  ];

  const styles: { value: Style; label: string; desc: string; preview: ReactNode }[] = [
    {
      value: 'smooth',
      label: 'Smooth',
      desc: 'Rounded corners & soft shadows',
      preview: (
        <div className="w-full h-20 flex items-center justify-center gap-2 px-3">
          <div className="flex-1 h-10 rounded-xl shadow-md" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <div className="h-2 w-3/5 rounded-full mt-2 mx-2" style={{ backgroundColor: 'var(--text-muted)' }} />
            <div className="h-2 w-2/5 rounded-full mt-1.5 mx-2" style={{ backgroundColor: 'var(--border)' }} />
          </div>
          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
        </div>
      ),
    },
    {
      value: 'angular',
      label: 'Angular',
      desc: 'Boxy terminal style, monospace',
      preview: (
        <div className="w-full h-20 flex items-center justify-center gap-2 px-3" style={{ fontFamily: 'ui-monospace, monospace' }}>
          <div className="flex-1 h-10" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', boxShadow: '3px 3px 0 var(--border)' }}>
            <div className="h-1.5 w-3/5 mt-2 mx-2" style={{ backgroundColor: 'var(--text-muted)' }} />
            <div className="h-1.5 w-2/5 mt-1.5 mx-2" style={{ backgroundColor: 'var(--border)' }} />
          </div>
          <div className="w-8 h-8 text-xs flex items-center justify-center font-mono font-bold" style={{ backgroundColor: '#3b82f6', color: '#fff', boxShadow: '3px 3px 0 #1e40af' }}>
            &gt;_
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Layout size={18} />
          Appearance
        </h3>

        {/* Visual style */}
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>VISUAL STYLE</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {styles.map(({ value, label, desc, preview }) => (
            <label
              key={value}
              className={`flex flex-col border rounded-lg cursor-pointer transition-colors overflow-hidden ${
                style === value ? 'border-blue-500' : 'hover:border-blue-300'
              }`}
              style={{ backgroundColor: style === value ? 'color-mix(in srgb, #3b82f6 8%, var(--bg-secondary))' : 'var(--bg-secondary)' }}
            >
              <input type="radio" name="ui-style" checked={style === value} onChange={() => setStyle(value)} className="sr-only" />
              <div className="border-b" style={{ borderColor: style === value ? '#93c5fd' : 'var(--border)' }}>
                {preview}
              </div>
              <div className="px-3 py-2">
                <span className={`font-medium text-sm ${style === value ? 'text-blue-600' : ''}`}>{label}</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Color theme */}
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>COLOR THEME</p>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ value, label, icon: Icon, desc }) => (
            <label
              key={value}
              className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                theme === value ? 'border-blue-500' : 'hover:bg-gray-50'
              }`}
              style={{ backgroundColor: theme === value ? 'color-mix(in srgb, #3b82f6 8%, var(--bg-secondary))' : undefined }}
            >
              <input type="radio" name="theme" checked={theme === value} onChange={() => setTheme(value)} className="sr-only" />
              <Icon size={22} className={theme === value ? 'text-blue-600' : 'text-gray-400'} />
              <span className={`mt-2 font-medium text-sm ${theme === value ? 'text-blue-600' : ''}`}>{label}</span>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4">Storage Location</h3>

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="storage"
              checked={storage === 'local'}
              onChange={() => handleStorageChange('local')}
              className="w-4 h-4"
            />
            <Database size={20} className="text-blue-600" />
            <div>
              <div className="font-medium">Local Storage (IndexedDB)</div>
              <div className="text-sm text-gray-500">Data stored in your browser. Private and offline-capable.</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="storage"
              checked={storage === 'backend'}
              onChange={() => handleStorageChange('backend')}
              className="w-4 h-4"
            />
            <Cloud size={20} className="text-green-600" />
            <div>
              <div className="font-medium">Backend Server (SQLite)</div>
              <div className="text-sm text-gray-500">Data stored on server. Accessible from multiple devices.</div>
            </div>
          </label>
        </div>

        {storage === 'backend' && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backend URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="flex-1 border rounded-md px-3 py-2"
                placeholder="http://localhost:3001"
              />
              <button
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {connectionStatus === 'testing' ? 'Testing...' : 'Test'}
              </button>
            </div>
            {connectionStatus === 'connected' && (
              <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle size={16} />
                Connected successfully
              </div>
            )}
            {connectionStatus === 'failed' && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <XCircle size={16} />
                Connection failed. Make sure the server is running.
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Run <code className="bg-gray-200 px-1 rounded">cd server && npm install && npm start</code> to start the backend.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <DollarSign size={20} />
          Currency Settings
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Currency
          </label>
          <select
            value={defaultCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            {COMMON_CURRENCIES.map(curr => (
              <option key={curr.code} value={curr.code}>
                {curr.symbol} {curr.name} ({curr.code})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Individual transactions can override this currency setting.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Target size={20} />
          Savings Goal
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Amount
            </label>
            <input
              type="number"
              value={savingsGoal.amount}
              onChange={(e) => handleSavingsGoalChange({ ...savingsGoal, amount: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0.00"
              min="0"
              step="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period
            </label>
            <select
              value={savingsGoal.period}
              onChange={(e) => handleSavingsGoalChange({ ...savingsGoal, period: e.target.value as 'week' | 'month' | 'year' })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">
            The app will auto-detect incoming transactions as savings, but you can manually adjust them.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <TrendingDown size={20} />
            Budget Tracking
          </h3>
          <button
            onClick={() => setShowAddBudget(!showAddBudget)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Plus size={16} />
            Add Budget
          </button>
        </div>

        {showAddBudget && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select a category</option>
                  {rootCategories.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Amount
                </label>
                <input
                  type="number"
                  value={newBudget.amount || ''}
                  onChange={(e) => setNewBudget({ ...newBudget, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  min="0"
                  step="100"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period
                </label>
                <select
                  value={newBudget.period}
                  onChange={(e) => setNewBudget({ ...newBudget, period: e.target.value as 'week' | 'month' | 'year' })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newBudget.includeChildren}
                  onChange={(e) => setNewBudget({ ...newBudget, includeChildren: e.target.checked })}
                  className="rounded"
                />
                Include subcategories in budget
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAddBudget}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Add Budget
                </button>
                <button
                  onClick={() => {
                    setShowAddBudget(false);
                    setNewBudget({
                      category: '',
                      amount: 0,
                      period: 'month',
                      includeChildren: true,
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {budgets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No budgets set. Add budgets to track your spending limits.
            </p>
          ) : (
            budgets.map(budget => (
              <div
                key={budget.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  budget.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{budget.category}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-600">
                      {defaultCurrency} {budget.amount.toLocaleString()} / {budget.period}
                    </span>
                    {budget.includeChildren && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        + subcategories
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={budget.enabled}
                      onChange={() => handleToggleBudget(budget.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <button
                    onClick={() => handleDeleteBudget(budget.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          💡 Tip: Budgets help you track spending limits. View progress in the Analytics tab.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Edit3 size={20} />
            Payee Renaming Rules
          </h3>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleImportRenamingRules}
              className="hidden"
              ref={renamingFileInputRef}
            />
            <button
              onClick={() => renamingFileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm border"
              title="Import rules from YAML"
            >
              <Upload size={16} />
              Import
            </button>
            <button
              onClick={handleExportRenamingRules}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm border"
              title="Export rules to YAML"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Plus size={16} />
              Add Rule
            </button>
          </div>
        </div>

        {/* Date suffix detection banner */}
        {suffixInfo.count > 0 && (
          <div className="mb-4 flex items-start justify-between gap-3 p-3 rounded-lg border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Date suffixes detected in {suffixInfo.count} payee{suffixInfo.count !== 1 ? 's' : ''}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                e.g. {suffixInfo.examples.map(e => <code key={e} className="mr-2">{e}</code>)}
              </p>
            </div>
            <button
              onClick={handleStripDateSuffixes}
              disabled={suffixInfo.alreadyExists}
              className="shrink-0 px-3 py-1.5 text-sm rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={suffixInfo.alreadyExists
                ? { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                : { background: '#304c7a', color: '#fff' }}
              title={suffixInfo.alreadyExists ? 'Rule already exists' : 'Add a rule to strip these suffixes from all matching payees'}
            >
              {suffixInfo.alreadyExists ? 'Rule active' : 'Strip suffixes'}
            </button>
          </div>
        )}

        {/* Search */}
        {renamingRules.length > 0 && (
          <div className="mb-4 flex items-center gap-2 border rounded-md px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={ruleSearch}
              onChange={e => { setRuleSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by pattern or replacement…"
              className="flex-1 text-sm outline-none"
              style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
            />
            {ruleSearch && (
              <button onClick={() => { setRuleSearch(''); setCurrentPage(1); }} style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {showAddRule && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pattern {newRule.isRegex && '(Regex)'}
                </label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  placeholder={newRule.isRegex ? "^JOES GRILL.*" : "JOES GRILL"}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Replacement
                </label>
                <input
                  type="text"
                  value={newRule.replacement}
                  onChange={(e) => setNewRule({ ...newRule, replacement: e.target.value })}
                  placeholder="Joe's Grill"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRule.isRegex}
                  onChange={(e) => setNewRule({ ...newRule, isRegex: e.target.checked })}
                  className="rounded"
                />
                Use Regular Expression
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Add Rule
                </button>
                <button
                  onClick={() => {
                    setShowAddRule(false);
                    setNewRule({ pattern: '', replacement: '', isRegex: false });
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {renamingRules.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No renaming rules yet. Add rules to clean up payee names automatically.
            </p>
          ) : filteredRules.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No rules match "{ruleSearch}"
            </p>
          ) : (
            <>
              {filteredRules
                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                .map(rule => (
                  <div
                    key={rule.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      rule.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-blue-600 truncate">
                          {rule.pattern}
                        </code>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-medium truncate">{rule.replacement}</span>
                        {rule.isRegex && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            Regex
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              
              {filteredRules.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRules.length)} of {filteredRules.length}{ruleSearch ? ` matching "${ruleSearch}"` : ' rules'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="flex items-center px-2 text-sm font-medium">
                      Page {currentPage} of {Math.ceil(filteredRules.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRules.length / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredRules.length / ITEMS_PER_PAGE)}
                      className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          💡 Tip: You can also create rules directly from the transaction list by clicking the edit icon next to a payee name.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4">Import Settings</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duplicate Detection
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="duplicate-detection"
                checked={duplicateDetection === 'strict'}
                onChange={() => handleDuplicateDetectionChange('strict')}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium text-sm">Strict (Recommended)</div>
                <div className="text-xs text-gray-500">
                  Skip transactions with matching date, payee, and amount
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="duplicate-detection"
                checked={duplicateDetection === 'off'}
                onChange={() => handleDuplicateDetectionChange('off')}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium text-sm">Off</div>
                <div className="text-xs text-gray-500">
                  Import all transactions (may create duplicates)
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">Data Management</h3>

        {showClearConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete all transactions? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClearData}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Yes, delete all
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-md hover:bg-red-50"
          >
            <Trash2 size={16} />
            Clear all transactions
          </button>
        )}
      </div>
    </div>
  );
}

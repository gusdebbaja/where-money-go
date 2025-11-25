import { useState, useEffect } from 'react';
import { StorageType, SavingsGoal, PayeeRenamingRule } from '../types';
import { setStorageType, setBackendUrl, getStorageType, testConnection, clearTransactions } from '../storage';
import { useTheme, Theme } from '../context/ThemeContext';
import { Database, Cloud, Trash2, CheckCircle, XCircle, Sun, Moon, Smartphone, DollarSign, Target, Edit3, Plus, X } from 'lucide-react';
import { detectLocalCurrency, COMMON_CURRENCIES } from '../utils/currency';
import { getRenamingRules, saveRenamingRules, addRenamingRule } from '../utils/payeeRules';

interface SettingsProps {
  onStorageChange: () => void;
}

export function Settings({ onStorageChange }: SettingsProps) {
  const { theme, setTheme } = useTheme();
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
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', replacement: '', isRegex: false });
  const [duplicateDetection, setDuplicateDetection] = useState<'strict' | 'off'>(() => {
    const saved = localStorage.getItem('duplicate-detection');
    return (saved as 'strict' | 'off') || 'strict';
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
  }, []);

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

  const handleDuplicateDetectionChange = (mode: 'strict' | 'off') => {
    setDuplicateDetection(mode);
    localStorage.setItem('duplicate-detection', mode);
  };

  const themes: { value: Theme; label: string; icon: typeof Sun; desc: string }[] = [
    { value: 'light', label: 'Light', icon: Sun, desc: 'Classic light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { value: 'amoled', label: 'AMOLED', icon: Smartphone, desc: 'Pure black for OLED screens' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ value, label, icon: Icon, desc }) => (
            <label
              key={value}
              className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors
                ${theme === value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="theme"
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon size={24} className={theme === value ? 'text-blue-600' : 'text-gray-400'} />
              <span className="mt-2 font-medium text-sm">{label}</span>
              <span className="text-xs text-gray-500 text-center">{desc}</span>
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
            <Edit3 size={20} />
            Payee Renaming Rules
          </h3>
          <button
            onClick={() => setShowAddRule(!showAddRule)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Plus size={16} />
            Add Rule
          </button>
        </div>

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
          ) : (
            renamingRules.map(rule => (
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
            ))
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

import { useState, useEffect } from 'react';
import { StorageType } from '../types';
import { setStorageType, setBackendUrl, getStorageType, testConnection, clearTransactions } from '../storage';
import { useTheme, Theme } from '../context/ThemeContext';
import { Database, Cloud, Trash2, CheckCircle, XCircle, Sun, Moon, Smartphone } from 'lucide-react';

interface SettingsProps {
  onStorageChange: () => void;
}

export function Settings({ onStorageChange }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const [storage, setStorage] = useState<StorageType>(getStorageType());
  const [url, setUrl] = useState('http://localhost:3001');
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'failed'>('untested');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

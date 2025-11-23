import { useState, useEffect } from 'react';
import { ColumnMapping } from '../types';
import { Save, FolderOpen, Trash2 } from 'lucide-react';

interface SavedMapping {
  name: string;
  mapping: ColumnMapping;
}

interface ColumnMapperProps {
  headers: string[];
  sampleData: string[][];
  onComplete: (mapping: ColumnMapping) => void;
}

const STORAGE_KEY = 'saved-column-mappings';

export function ColumnMapper({ headers, sampleData, onComplete }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedMappings(JSON.parse(stored));
    }
  }, []);

  const fields = [
    { key: 'date', label: 'Date', required: true },
    { key: 'payee', label: 'Payee/Merchant', required: true },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'description', label: 'Description', required: false },
  ];

  const handleSubmit = () => {
    if (mapping.date && mapping.payee && mapping.amount) {
      onComplete(mapping as ColumnMapping);
    }
  };

  const saveMapping = () => {
    if (!saveName.trim() || !mapping.date || !mapping.payee || !mapping.amount) return;

    const newMapping: SavedMapping = {
      name: saveName.trim(),
      mapping: mapping as ColumnMapping,
    };

    const updated = [...savedMappings.filter(m => m.name !== newMapping.name), newMapping];
    setSavedMappings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveName('');
    setShowSaveDialog(false);
  };

  const loadMapping = (saved: SavedMapping) => {
    setMapping(saved.mapping);
  };

  const deleteMapping = (name: string) => {
    const updated = savedMappings.filter(m => m.name !== name);
    setSavedMappings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const isComplete = mapping.date && mapping.payee && mapping.amount;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Map Your Columns</h2>

      {savedMappings.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FolderOpen size={16} />
            Saved Mappings
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedMappings.map((saved) => (
              <div key={saved.name} className="flex items-center gap-1 bg-white rounded px-2 py-1 text-sm">
                <button
                  onClick={() => loadMapping(saved)}
                  className="hover:text-blue-600"
                >
                  {saved.name}
                </button>
                <Trash2
                  size={14}
                  className="text-gray-400 hover:text-red-500 cursor-pointer ml-1"
                  onClick={() => deleteMapping(saved.name)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-medium mb-4">Preview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left bg-gray-50 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 truncate max-w-[150px]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">Column Mapping</h3>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              <select
                value={mapping[key as keyof ColumnMapping] || ''}
                onChange={(e) => setMapping(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Select column...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!isComplete}
            className={`px-6 py-2 rounded-md font-medium
              ${isComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
          >
            Continue
          </button>

          {isComplete && (
            <>
              {showSaveDialog ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Mapping name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveMapping()}
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={saveMapping}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-blue-600"
                >
                  <Save size={16} />
                  Save mapping
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

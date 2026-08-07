import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { Plus, X, Edit3, Brain, Zap, Download, Upload } from 'lucide-react';
import { CategoryRule, getCategoryRules, saveCategoryRules, addCategoryRule, batchAddCategoryRules, updateCategoryRule } from '../utils/smartCategorization';
import { Category } from '../types';
import { load, dump } from 'js-yaml';

interface CategoryRulesManagerProps {
  categories: Category[];
}

export function CategoryRulesManager({ categories }: CategoryRulesManagerProps) {
  const showToast = useToast();
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newRule, setNewRule] = useState({
    pattern: '',
    category: '',
    isRegex: false,
    confidence: 0.8,
    tags: ''
  });

  useEffect(() => {
    setRules(getCategoryRules());
  }, []);

  const handleExportRules = () => {
    try {
      const yamlStr = dump(rules);
      const blob = new Blob([yamlStr], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'category-rules.yaml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting rules:', error);
      showToast('Error exporting rules to YAML.', 'error');
    }
  };

  const handleImportRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = load(content) as any[];
        
        if (Array.isArray(parsed)) {
          // Filter valid rules and strip IDs/dates to treat as new/updates
          const validRules = parsed.filter(r => r.pattern && r.category).map(({ id, createdAt, ...rest }) => rest);
          
          if (validRules.length > 0) {
            batchAddCategoryRules(validRules);
            setRules(getCategoryRules());
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
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleEditRule = (rule: CategoryRule) => {
    setNewRule({
      pattern: rule.pattern,
      category: rule.category,
      isRegex: rule.isRegex,
      confidence: rule.confidence,
      tags: rule.tags ? rule.tags.join(', ') : ''
    });
    setEditingId(rule.id);
    setShowAddRule(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveRule = () => {
    if (newRule.pattern && newRule.category) {
      const ruleData = {
        pattern: newRule.pattern,
        category: newRule.category,
        isRegex: newRule.isRegex,
        confidence: newRule.confidence,
        tags: newRule.tags ? newRule.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        enabled: true,
      };

      if (editingId) {
        const originalRule = rules.find(r => r.id === editingId);
        if (originalRule) {
          updateCategoryRule({
            ...originalRule,
            ...ruleData
          });
        }
      } else {
        addCategoryRule(ruleData);
      }
      
      setRules(getCategoryRules());
      setNewRule({ pattern: '', category: '', isRegex: false, confidence: 0.8, tags: '' });
      setEditingId(null);
      setShowAddRule(false);
    }
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveCategoryRules(updated);
    setRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    saveCategoryRules(updated);
    setRules(updated);
  };

  const handleUpdateConfidence = (id: string, confidence: number) => {
    const updated = rules.map(r =>
      r.id === id ? { ...r, confidence } : r
    );
    saveCategoryRules(updated);
    setRules(updated);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Brain size={20} />
          Smart Category Rules
        </h3>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".yaml,.yml"
            onChange={handleImportRules}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm border"
            title="Import rules from YAML"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            onClick={handleExportRules}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm border"
            title="Export rules to YAML"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={() => setShowAddRule(!showAddRule)}
            className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
          >
            <Plus size={16} />
            Add Rule
          </button>
        </div>
      </div>

      <div className="mb-4 p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 mb-2">
          <Zap size={16} />
          <span className="text-sm font-medium">How Smart Category Rules Work</span>
        </div>
        <div className="text-xs text-purple-600 space-y-1">
          <p>• Rules are checked first, before keyword matching</p>
          <p>• Higher confidence rules take priority</p>
          <p>• You can optionally assign tags (e.g., "Exclude")</p>
          <p>• Use regex for advanced pattern matching</p>
          <p>• Example: Pattern "UBER.*" → Category "Uber" (matches "UBER A 12930123")</p>
        </div>
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
                placeholder={newRule.isRegex ? "^UBER.*|^Uber.*" : "UBER"}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                {newRule.isRegex 
                  ? "Use regex patterns like '^UBER.*' to match payees starting with UBER"
                  : "Simple text matching - will match if payee contains this text"
                }
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newRule.category}
                onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={newRule.tags}
                onChange={(e) => setNewRule({ ...newRule, tags: e.target.value })}
                placeholder="e.g. business, subscription"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confidence: {(newRule.confidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={newRule.confidence}
                onChange={(e) => setNewRule({ ...newRule, confidence: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500">
                Higher confidence rules take priority over lower ones
              </div>
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
                onClick={handleSaveRule}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                {editingId ? 'Update Rule' : 'Add Rule'}
              </button>
              <button
                onClick={() => {
                  setShowAddRule(false);
                  setNewRule({ pattern: '', category: '', isRegex: false, confidence: 0.8, tags: '' });
                  setEditingId(null);
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
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No category rules yet. Add rules to automatically categorize transactions based on payee patterns.
          </p>
        ) : (
          rules
            .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
            .map(rule => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  rule.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-purple-600 truncate">
                      {rule.pattern}
                    </code>
                    <span className="text-gray-400">→</span>
                    <span className="text-sm font-medium truncate">{rule.category}</span>
                    {rule.tags && rule.tags.length > 0 && (
                      <div className="flex gap-1">
                        {rule.tags.map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {rule.isRegex && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        Regex
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Confidence: {(rule.confidence * 100).toFixed(0)}%</span>
                    <span>Created: {rule.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex flex-col items-center">
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={rule.confidence}
                      onChange={(e) => handleUpdateConfidence(rule.id, parseFloat(e.target.value))}
                      className="w-16 h-1"
                      title="Adjust confidence"
                    />
                    <span className="text-xs text-gray-400">{(rule.confidence * 100).toFixed(0)}%</span>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                  
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit rule"
                  >
                    <Edit3 size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete rule"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-xs text-blue-600 space-y-1">
          <p><strong>💡 Tips:</strong></p>
          <p>• Create rules for payees that aren't automatically detected</p>
          <p>• Use regex for complex patterns: "^(UBER|Uber).*" matches both "UBER A 123" and "Uber Trip"</p>
          <p>• Higher confidence rules (90%+) override lower ones</p>
          <p>• Test your regex patterns online before adding them</p>
        </div>
      </div>
    </div>
  );
}
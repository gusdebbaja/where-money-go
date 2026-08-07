import { useState, useCallback, useMemo, useDeferredValue } from 'react';
import { useToast } from '../context/ToastContext';
import { Transaction, Category } from '../types';
import { Tag, X, PiggyBank, CheckSquare, Square, Edit2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Brain, Zap, EyeOff, Eye } from 'lucide-react';
import { formatCurrency, COMMON_CURRENCIES, formatDateEuropean } from '../utils/currency';
import { applyRenamingRules, getRenamingRules, addRenamingRule, batchAddRenamingRules, extractPayeePattern, escapeRegex } from '../utils/payeeRules';
import { batchSmartCategorizeOptimized, batchAddCategoryRules, normalizePayeeName } from '../utils/smartCategorization';
import { DateRangePicker } from './DateRangePicker';
import { CategorySelect } from './CategorySelect';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
  onBatchUpdate?: (updates: Array<{ ids: string[], data: Partial<Transaction> }>) => void;
}

const ITEMS_PER_PAGE = 50;

export function TransactionList({ transactions, categories, onUpdate, onBulkUpdate, onBatchUpdate }: TransactionListProps) {
  const showToast = useToast();
  const [filter, setFilter] = useState('');
  const [tagInput, setTagInput] = useState<{ [id: string]: string }>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [editPayeeValue, setEditPayeeValue] = useState('');
  const [showRuleDialog, setShowRuleDialog] = useState<{ payee: string; category?: string; hasRule?: boolean } | null>(null);
  const [sortField, setSortField] = useState<'date' | 'payee' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{
    payee: string;
    normalizedPayee: string;
    suggestedCategory: string;
    confidence: number;
    method: string;
    tags?: string[];
    transactionCount: number;
    totalAmount: number;
  }>>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isProcessingSmartCategorization, setIsProcessingSmartCategorization] = useState(false);
  const [smartCategorizationProgress, setSmartCategorizationProgress] = useState({ processed: 0, total: 0, currentPayee: '' });
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  // Bumped whenever a renaming rule is added so withDisplayNames recomputes
  const [rulesVersion, setRulesVersion] = useState(0);

  // Expensive step: apply renaming rules. Reruns when transactions OR rules change.
  const withDisplayNames = useMemo(() => {
    const rules = getRenamingRules();
    return transactions.map(t => ({
      ...t,
      displayPayee: applyRenamingRules(t.payee, rules),
    }));
  }, [transactions, rulesVersion]);

  // Defer filter so keystrokes don't block the UI while sorting/filtering 5k rows
  const deferredFilter = useDeferredValue(filter);

  const uncategorizedCount = useMemo(
    () => withDisplayNames.filter(t => t.amount < 0 && !t.category).length,
    [withDisplayNames]
  );

  const filtered = useMemo(() => {
    const lowerFilter = deferredFilter.toLowerCase();
    return withDisplayNames
      .filter(t => {
        if (showUncategorizedOnly && (t.amount >= 0 || t.category)) return false;
        if (dateRange.start && t.date < new Date(dateRange.start)) return false;
        if (dateRange.end && t.date > new Date(dateRange.end + 'T23:59:59')) return false;
        if (lowerFilter && !t.displayPayee.toLowerCase().includes(lowerFilter) &&
            !t.payee.toLowerCase().includes(lowerFilter) &&
            !t.description?.toLowerCase().includes(lowerFilter)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'date': comparison = a.date.getTime() - b.date.getTime(); break;
          case 'payee': comparison = a.displayPayee.localeCompare(b.displayPayee); break;
          case 'amount': comparison = a.amount - b.amount; break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [withDisplayNames, deferredFilter, sortField, sortDirection, showUncategorizedOnly, dateRange]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const addTag = useCallback((id: string) => {
    const tag = tagInput[id]?.trim();
    if (!tag) return;

    const txn = transactions.find(t => t.id === id);
    if (txn && !txn.tags.includes(tag)) {
      onUpdate(id, { tags: [...txn.tags, tag] });
    }
    setTagInput(prev => ({ ...prev, [id]: '' }));
  }, [tagInput, transactions, onUpdate]);

  const removeTag = useCallback((id: string, tag: string) => {
    const txn = transactions.find(t => t.id === id);
    if (txn) {
      onUpdate(id, { tags: txn.tags.filter(t => t !== tag) });
    }
  }, [transactions, onUpdate]);

  const handleCategoryChange = useCallback((id: string, category: string) => {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    onUpdate(id, { category: category || undefined });

    // Extract pattern from payee (remove dates, etc.)
    const pattern = extractPayeePattern(txn.payee);
    
    // Check if a renaming rule already exists for this pattern
    const rules = getRenamingRules();
    const hasRule = rules.some(rule => {
      if (!rule.enabled) return false;
      try {
        if (rule.isRegex) {
          const regex = new RegExp(rule.pattern, 'i');
          return regex.test(txn.payee);
        } else {
          return txn.payee.toLowerCase().includes(rule.pattern.toLowerCase());
        }
      } catch {
        return false;
      }
    });
    
    // Ask if user wants to apply to all transactions with similar payee pattern
    if (category && pattern) {
      const similarTxns = transactions.filter(t => {
        const tPattern = extractPayeePattern(t.payee);
        return tPattern === pattern && t.id !== id && t.category !== category;
      });
      
      if (similarTxns.length > 0) {
        // Only offer to create rule if one doesn't exist
        setShowRuleDialog({ payee: pattern, category, hasRule });
      }
    }
  }, [transactions, onUpdate]);

  const applyPatternRule = useCallback((pattern: string, category: string, createRule: boolean) => {
    if (createRule) {
      addRenamingRule({
        pattern: `^${escapeRegex(pattern)}.*`,
        replacement: pattern,
        isRegex: true,
        enabled: true,
      });
      setRulesVersion(v => v + 1);
    }

    // Apply category to all matching transactions
    if (onBulkUpdate) {
      const matchingIds = transactions
        .filter(t => extractPayeePattern(t.payee) === pattern)
        .map(t => t.id);
      onBulkUpdate(matchingIds, { category });
    }

    setShowRuleDialog(null);
  }, [transactions, onBulkUpdate]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const applyBulkCategory = useCallback((category: string) => {
    if (onBulkUpdate && selectedIds.size > 0) {
      onBulkUpdate(Array.from(selectedIds), { category: category || undefined });
      setSelectedIds(new Set());
      setShowBulkActions(false);
    }
  }, [selectedIds, onBulkUpdate]);

  const defaultCurrency = localStorage.getItem('default-currency') || 'USD';

  const handleSort = useCallback((field: 'date' | 'payee' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  }, [sortField]);

  const handleEditPayee = useCallback((id: string, currentPayee: string) => {
    setEditingPayee(id);
    setEditPayeeValue(currentPayee);
  }, []);

  const handleSavePayee = useCallback((originalPayee: string) => {
    if (editPayeeValue.trim() && editPayeeValue !== originalPayee) {
      const base = extractPayeePattern(originalPayee);
      const hasStrippableSuffix = base && base !== originalPayee;
      addRenamingRule({
        // If the payee had a date/suffix, match all variants (^BASE.*); otherwise exact match
        pattern: hasStrippableSuffix
          ? `^${escapeRegex(base)}.*`
          : `^${escapeRegex(originalPayee)}$`,
        replacement: editPayeeValue.trim(),
        isRegex: true,
        enabled: true,
      });
      setRulesVersion(v => v + 1);
    }
    setEditingPayee(null);
  }, [editPayeeValue]);

  const runSmartCategorization = useCallback(async () => {
    const uncategorizedTransactions = transactions.filter(t => !t.category && t.amount < 0);
    
    if (uncategorizedTransactions.length === 0) {
      showToast('No uncategorized transactions found.', 'info');
      return;
    }

    setIsProcessingSmartCategorization(true);
    setSmartCategorizationProgress({ processed: 0, total: 0, currentPayee: '' });
    
    try {
      // Use optimized chunked processing for large datasets
      const suggestions = await batchSmartCategorizeOptimized(
        uncategorizedTransactions,
        (processed, total, currentPayee) => {
          setSmartCategorizationProgress({ processed, total, currentPayee: currentPayee || '' });
        }
      );

      setSmartSuggestions(suggestions);
      setShowSmartSuggestions(true);
      setSelectedSuggestions(new Set());
    } catch (error) {
      console.error('Error during smart categorization:', error);
      showToast('An error occurred during smart categorization. Please try again.', 'error');
    } finally {
      setIsProcessingSmartCategorization(false);
    }
  }, [transactions]);

  const toggleSuggestion = useCallback((payee: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(payee)) {
        next.delete(payee);
      } else {
        next.add(payee);
      }
      return next;
    });
  }, []);

  const toggleAllSuggestions = useCallback(() => {
    setSelectedSuggestions(prev => {
      if (prev.size === smartSuggestions.length) {
        return new Set();
      } else {
        return new Set(smartSuggestions.map(s => s.payee));
      }
    });
  }, [smartSuggestions]);

  const applySmartSuggestions = useCallback(() => {
    if (!onBulkUpdate && !onBatchUpdate) return;

    let appliedCount = 0;
    const batchUpdates: Array<{ ids: string[], data: Partial<Transaction> }> = [];
    const renamingRulesToAdd: Array<any> = [];
    const categoryRulesToAdd: Array<any> = [];
    
    selectedSuggestions.forEach(payee => {
      const suggestion = smartSuggestions.find(s => s.payee === payee);
      if (suggestion) {
        // Create both renaming rule and category rule
        const normalizedPayee = normalizePayeeName(payee);
        
        // Create renaming rule to clean up payee name
        // IMPROVED: Create a more generic rule if possible to avoid 1:1 mappings
        let rulePattern = `^${payee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        let isRegex = true;
        
        // If the normalized name is a substring of the original, use it as a simple "contains" rule
        // This drastically reduces the number of rules needed (e.g., "Uber" handles "Uber *Trip 1" and "Uber *Trip 2")
        if (payee.toLowerCase().includes(normalizedPayee.toLowerCase()) && normalizedPayee.length > 3) {
          rulePattern = normalizedPayee;
          isRegex = false;
        }

        renamingRulesToAdd.push({
          pattern: rulePattern,
          replacement: normalizedPayee,
          isRegex: isRegex,
          enabled: true,
        });

        // Create category rule for future transactions
        categoryRulesToAdd.push({
          pattern: normalizedPayee,
          category: suggestion.suggestedCategory,
          isRegex: false,
          enabled: true,
          confidence: suggestion.confidence,
          tags: suggestion.tags
        });

        // Apply category to existing transactions
        const txnIds = transactions
          .filter(t => t.payee === payee && !t.category)
          .map(t => t.id);
        
        if (txnIds.length > 0) {
          const updateData: Partial<Transaction> = { category: suggestion.suggestedCategory };
          if (suggestion.tags && suggestion.tags.length > 0) {
            updateData.tags = suggestion.tags;
          }

          batchUpdates.push({
            ids: txnIds,
            data: updateData
          });
          appliedCount += txnIds.length;
        }
      }
    });

    // Batch apply rules
    if (renamingRulesToAdd.length > 0) {
      batchAddRenamingRules(renamingRulesToAdd);
    }
    
    if (categoryRulesToAdd.length > 0) {
      batchAddCategoryRules(categoryRulesToAdd);
    }

    if (batchUpdates.length > 0) {
      if (onBatchUpdate) {
        onBatchUpdate(batchUpdates);
      } else if (onBulkUpdate) {
        // Fallback to sequential updates if batch not supported
        batchUpdates.forEach(update => {
          onBulkUpdate(update.ids, update.data);
        });
      }
    }

    setSelectedSuggestions(new Set());
    setShowSmartSuggestions(false);
    
    // Force re-render to show updated payee names
    setFilter(prev => prev + ' ');
    setTimeout(() => setFilter(prev => prev.trim()), 0);
    
    showToast(`Applied smart categorization to ${appliedCount} transactions and created rules for future transactions!`, 'success');
  }, [selectedSuggestions, smartSuggestions, transactions, onBulkUpdate, onBatchUpdate, showToast]);

  const renderRow = (txn: Transaction & { displayPayee: string }) => {
    const isSelected = selectedIds.has(txn.id);
    const category = categories.find(c => c.name === txn.category);
    const isEditing = editingPayee === txn.id;

    return (
      <div key={txn.id} className={`flex items-center border-b hover:bg-gray-50 py-2 ${isSelected ? 'bg-blue-50' : ''} ${txn.isHidden ? 'opacity-40' : ''}`}>
        <div className="px-2 py-2 w-[40px] flex items-center justify-center">
          <button onClick={() => toggleSelection(txn.id)} className="text-gray-400 hover:text-blue-600">
            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
        </div>
        <div className="px-2 py-2 w-[90px] text-sm">
          {formatDateEuropean(txn.date)}
        </div>
        <div className="px-2 py-2 flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editPayeeValue}
                onChange={(e) => setEditPayeeValue(e.target.value)}
                onBlur={() => handleSavePayee(txn.payee)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePayee(txn.payee);
                  if (e.key === 'Escape') setEditingPayee(null);
                }}
                className="text-sm border rounded px-2 py-1 flex-1"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm truncate ${txn.isHidden ? 'line-through text-gray-400' : ''}`}>{txn.displayPayee}</div>
                {txn.displayPayee !== txn.payee && (
                  <div className="text-xs text-gray-400 truncate">Original: {txn.payee}</div>
                )}
                {txn.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {txn.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleEditPayee(txn.id, txn.displayPayee)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"
                title="Rename payee"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="px-2 py-2 w-[120px]">
          <div className={`text-sm text-right font-medium ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(txn.amount, txn.currency || defaultCurrency)}
          </div>
          <select
            value={txn.currency || defaultCurrency}
            onChange={(e) => onUpdate(txn.id, { currency: e.target.value })}
            className="text-xs border rounded px-1 py-0.5 w-full mt-1"
            title="Currency"
          >
            {COMMON_CURRENCIES.map(curr => (
              <option key={curr.code} value={curr.code}>{curr.code}</option>
            ))}
          </select>
        </div>
        <div className="px-2 py-2 w-[180px]">
          <CategorySelect
            value={txn.category || ''}
            categories={categories}
            onChange={(val) => handleCategoryChange(txn.id, val)}
          />
          {category?.isSubscription && (
            <div className="text-xs text-purple-600 mt-1">📅 Subscription</div>
          )}
        </div>
        <div className="px-2 py-2 w-[180px]">
          <div className="flex flex-wrap gap-1 items-center">
            {txn.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
              >
                {tag}
                <X
                  size={12}
                  className="cursor-pointer hover:text-blue-900"
                  onClick={() => removeTag(txn.id, tag)}
                />
              </span>
            ))}
            {txn.tags.length > 2 && (
              <span className="text-xs text-gray-500">+{txn.tags.length - 2}</span>
            )}
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Add"
                value={tagInput[txn.id] || ''}
                onChange={(e) => setTagInput(prev => ({ ...prev, [txn.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addTag(txn.id)}
                className="text-xs border rounded px-1 py-0.5 w-12"
              />
              <Tag
                size={12}
                className="text-gray-400 cursor-pointer hover:text-blue-600"
                onClick={() => addTag(txn.id)}
              />
            </div>
          </div>
        </div>
        <div className="px-2 py-2 w-[90px] flex items-center justify-center gap-2">
          <button
            onClick={() => onUpdate(txn.id, { isSaving: !txn.isSaving })}
            className={`${txn.isSaving ? 'text-green-600' : 'text-gray-300'} hover:text-green-500`}
            title={txn.isSaving ? 'Marked as savings' : 'Mark as savings'}
          >
            <PiggyBank size={18} />
          </button>
          <button
            onClick={() => onUpdate(txn.id, { isHidden: !txn.isHidden })}
            className={`${txn.isHidden ? 'text-gray-500' : 'text-gray-300'} hover:text-gray-600`}
            title={txn.isHidden ? 'Hidden from analytics — click to show' : 'Hide from analytics'}
          >
            {txn.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            Transactions ({filtered.length.toLocaleString()}
            {filter && ` of ${transactions.length.toLocaleString()}`})
          </h2>
          <div className="text-sm text-gray-500 mt-1">
            Page {currentPage} of {totalPages} • Showing {paginatedTransactions.length} transactions
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Bulk Actions ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setShowUncategorizedOnly(v => !v); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors ${
              showUncategorizedOnly
                ? 'bg-orange-600 text-white border-orange-600'
                : 'border-orange-300 text-orange-600 hover:bg-orange-50'
            }`}
            title="Show only uncategorized spending transactions"
          >
            <Zap size={16} />
            Uncategorized
            {uncategorizedCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                showUncategorizedOnly ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
              }`}>
                {uncategorizedCount}
              </span>
            )}
          </button>
          <button
            onClick={runSmartCategorization}
            disabled={isProcessingSmartCategorization}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
              isProcessingSmartCategorization
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
            title="Automatically categorize transactions using AI"
          >
            <Brain size={16} />
            {isProcessingSmartCategorization ? 'Processing...' : 'Smart Categorize'}
          </button>
          <input
            type="text"
            placeholder="Filter transactions..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border rounded-md px-3 py-2 w-56"
          />
        </div>
      </div>

      {/* Date / period filter */}
      <div className="mb-4">
        <DateRangePicker
          transactions={transactions}
          dateRange={dateRange}
          onChange={(r) => { setDateRange(r); setCurrentPage(1); }}
        />
      </div>

      {showBulkActions && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-3">Apply to {selectedIds.size} selected transaction(s)</h3>
          <div className="flex gap-3 items-center">
            <select
              onChange={(e) => e.target.value && applyBulkCategory(e.target.value)}
              className="border rounded px-3 py-2"
              defaultValue=""
            >
              <option value="">Set Category...</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setShowBulkActions(false);
              }}
              className="px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="flex bg-gray-50 border-b">
          <div className="px-2 py-3 w-[40px]"></div>
          <button
            onClick={() => handleSort('date')}
            className="px-2 py-3 w-[90px] text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            Date
            {sortField === 'date' ? (
              sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} className="opacity-30" />
            )}
          </button>
          <button
            onClick={() => handleSort('payee')}
            className="px-2 py-3 flex-1 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            Payee
            {sortField === 'payee' ? (
              sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} className="opacity-30" />
            )}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className="px-2 py-3 w-[120px] text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-end"
          >
            Amount
            {sortField === 'amount' ? (
              sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} className="opacity-30" />
            )}
          </button>
          <div className="px-2 py-3 w-[160px] text-sm font-medium text-gray-500">Category</div>
          <div className="px-2 py-3 w-[180px] text-sm font-medium text-gray-500">Tags</div>
          <div className="px-2 py-3 w-[60px] text-sm font-medium text-gray-500 text-center">
            <PiggyBank size={14} className="inline" />
          </div>
        </div>

        {/* Transaction List */}
        {filtered.length > 0 ? (
          <>
            <div className="overflow-y-auto">
              {paginatedTransactions.map(txn => renderRow(txn))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No transactions found.
          </div>
        )}
      </div>

      {/* Smart Categorization Dialog */}
      {(showSmartSuggestions || isProcessingSmartCategorization) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Brain className="text-purple-600" size={24} />
                <h3 className="text-lg font-bold">Smart Categorization Suggestions</h3>
              </div>
              <div className="flex gap-2">
                {selectedSuggestions.size > 0 && !isProcessingSmartCategorization && (
                  <button
                    onClick={applySmartSuggestions}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Zap size={16} />
                    Apply Selected ({selectedSuggestions.size})
                  </button>
                )}
                {!isProcessingSmartCategorization && (
                  <button
                    onClick={() => setShowSmartSuggestions(false)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {isProcessingSmartCategorization ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Processing Smart Categorization</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Analyzing {smartCategorizationProgress.total > 0 ? smartCategorizationProgress.total : '...'} unique payees
                </p>
                
                {smartCategorizationProgress.total > 0 && (
                  <div className="w-full max-w-md">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress: {smartCategorizationProgress.processed} / {smartCategorizationProgress.total}</span>
                      <span>{Math.round((smartCategorizationProgress.processed / smartCategorizationProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(smartCategorizationProgress.processed / smartCategorizationProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    {smartCategorizationProgress.currentPayee && (
                      <p className="text-xs text-gray-500 text-center truncate">
                        Processing: {smartCategorizationProgress.currentPayee}
                      </p>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-gray-400 mt-4 text-center max-w-md">
                  This may take a moment for large datasets. The browser will remain responsive during processing.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 mb-2">
                    <Zap size={16} />
                    <span className="text-sm font-medium">What Smart Categorization Does</span>
                  </div>
                  <div className="text-xs text-purple-600 space-y-1">
                    <p>• <strong>Cleans payee names:</strong> "UBER A 12930123" → "UBER"</p>
                    <p>• <strong>Suggests categories:</strong> Based on keywords, patterns, and similar transactions</p>
                    <p>• <strong>Creates rules:</strong> Future transactions will be automatically categorized</p>
                    <p>• <strong>Applies immediately:</strong> Categorizes existing uncategorized transactions</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                  {smartSuggestions.length > 0 ? (
                    <>
                      <div className="flex items-center gap-3 p-3 border-b bg-gray-50 rounded-t-lg">
                        <input
                          type="checkbox"
                          checked={selectedSuggestions.size === smartSuggestions.length && smartSuggestions.length > 0}
                          onChange={toggleAllSuggestions}
                          className="rounded w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Select All</span>
                      </div>
                      {smartSuggestions.map((suggestion) => (
                        <div key={suggestion.payee} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedSuggestions.has(suggestion.payee)}
                              onChange={() => toggleSuggestion(suggestion.payee)}
                              className="rounded w-4 h-4 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <div className="font-medium">{suggestion.normalizedPayee}</div>
                              <div className="text-sm text-gray-500">
                                {suggestion.transactionCount} transactions • {formatCurrency(suggestion.totalAmount, defaultCurrency)}
                              </div>
                              <div className="text-xs text-gray-400">Original: {suggestion.payee}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                              {suggestion.suggestedCategory}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              suggestion.confidence > 0.8 ? 'bg-green-100 text-green-700' :
                              suggestion.confidence > 0.5 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {(suggestion.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      No smart suggestions found. All transactions might be categorized or confidence is too low.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pattern Rule Dialog */}
      {showRuleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Apply to Similar Transactions?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Found multiple transactions matching pattern: <strong>{showRuleDialog.payee}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Would you like to:
            </p>
            <div className="space-y-3">
              {!showRuleDialog.hasRule && (
                <button
                  onClick={() => {
                    const category = showRuleDialog.category ?? '';
                    applyPatternRule(showRuleDialog.payee, category, true);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-left"
                >
                  <div className="font-medium">Create renaming rule & apply category</div>
                  <div className="text-xs opacity-90">
                    Clean up payee names and categorize all matching transactions
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  const category = showRuleDialog.category ?? '';
                  applyPatternRule(showRuleDialog.payee, category, false);
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-left"
              >
                <div className="font-medium">{showRuleDialog.hasRule ? 'Apply category to all' : 'Just apply category'}</div>
                <div className="text-xs opacity-90">
                  {showRuleDialog.hasRule 
                    ? 'Categorize all matching transactions (renaming rule already exists)'
                    : 'Only categorize matching transactions'}
                </div>
              </button>
              <button
                onClick={() => setShowRuleDialog(null)}
                className="w-full px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

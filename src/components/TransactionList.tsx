import { useState, useCallback, useMemo } from 'react';
import { Transaction, Category } from '../types';
import { Tag, X, PiggyBank, CheckSquare, Square, Edit2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, COMMON_CURRENCIES, formatDateEuropean } from '../utils/currency';
import { applyRenamingRules, getRenamingRules, addRenamingRule, extractPayeePattern } from '../utils/payeeRules';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
}

const ITEMS_PER_PAGE = 50;

export function TransactionList({ transactions, categories, onUpdate, onBulkUpdate }: TransactionListProps) {
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



  const filtered = useMemo(() => {
    const rules = getRenamingRules();
    const mapped = transactions
      .map(t => ({
        ...t,
        displayPayee: applyRenamingRules(t.payee, rules),
      }))
      .filter(t =>
        t.displayPayee.toLowerCase().includes(filter.toLowerCase()) ||
        t.payee.toLowerCase().includes(filter.toLowerCase()) ||
        t.description?.toLowerCase().includes(filter.toLowerCase())
      );

    // Sort transactions
    return mapped.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'payee':
          comparison = a.displayPayee.localeCompare(b.displayPayee);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transactions, filter, sortField, sortDirection]);

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
      // Create a renaming rule
      addRenamingRule({
        pattern: `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`,
        replacement: pattern,
        isRegex: true,
        enabled: true,
      });
    }

    // Apply category to all matching transactions
    if (onBulkUpdate) {
      const matchingIds = transactions
        .filter(t => extractPayeePattern(t.payee) === pattern)
        .map(t => t.id);
      onBulkUpdate(matchingIds, { category });
    }

    setShowRuleDialog(null);
    // Force re-render by updating a state that triggers filtered recalculation
    setFilter(prev => prev + ' ');
    setTimeout(() => setFilter(prev => prev.trim()), 0);
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
      // Create a renaming rule
      addRenamingRule({
        pattern: `^${originalPayee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        replacement: editPayeeValue.trim(),
        isRegex: true,
        enabled: true,
      });
      // Force re-render
      setFilter(prev => prev + ' ');
      setTimeout(() => setFilter(prev => prev.trim()), 0);
    }
    setEditingPayee(null);
  }, [editPayeeValue]);

  const renderRow = (txn: Transaction & { displayPayee: string }) => {
    const isSelected = selectedIds.has(txn.id);
    const category = categories.find(c => c.name === txn.category);
    const isEditing = editingPayee === txn.id;

    return (
      <div key={txn.id} className={`flex items-center border-b hover:bg-gray-50 py-2 ${isSelected ? 'bg-blue-50' : ''}`}>
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
                <div className="font-medium text-sm truncate">{txn.displayPayee}</div>
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
        <div className="px-2 py-2 w-[160px]">
          <select
            value={txn.category || ''}
            onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
            className="text-sm border rounded px-2 py-1 w-full"
          >
            <option value="">Uncategorized</option>
            {categories.filter(c => !c.parent).map((cat) => (
              <optgroup key={cat.name} label={cat.name}>
                <option value={cat.name}>{cat.name}</option>
                {categories.filter(c => c.parent === cat.name).map(sub => (
                  <option key={sub.name} value={sub.name}>  └ {sub.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
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
        <div className="px-2 py-2 w-[60px] flex items-center justify-center">
          <button
            onClick={() => onUpdate(txn.id, { isSaving: !txn.isSaving })}
            className={`${txn.isSaving ? 'text-green-600' : 'text-gray-300'} hover:text-green-500`}
            title={txn.isSaving ? 'Marked as savings' : 'Mark as savings'}
          >
            <PiggyBank size={18} />
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
          <input
            type="text"
            placeholder="Filter transactions..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border rounded-md px-3 py-2 w-64"
          />
        </div>
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
                  onClick={() => applyPatternRule(showRuleDialog.payee, showRuleDialog.category!, true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-left"
                >
                  <div className="font-medium">Create renaming rule & apply category</div>
                  <div className="text-xs opacity-90">
                    Clean up payee names and categorize all matching transactions
                  </div>
                </button>
              )}
              <button
                onClick={() => applyPatternRule(showRuleDialog.payee, showRuleDialog.category!, false)}
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

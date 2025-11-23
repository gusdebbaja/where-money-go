import { useState, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Transaction, Category } from '../types';
import { Tag, X } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
}

const ROW_HEIGHT = 72;

export function TransactionList({ transactions, categories, onUpdate }: TransactionListProps) {
  const [filter, setFilter] = useState('');
  const [tagInput, setTagInput] = useState<{ [id: string]: string }>({});

  const filtered = useMemo(() =>
    transactions.filter(t =>
      t.payee.toLowerCase().includes(filter.toLowerCase()) ||
      t.description?.toLowerCase().includes(filter.toLowerCase())
    ),
    [transactions, filter]
  );

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const txn = filtered[index];
    if (!txn) return null;

    return (
      <div style={style} className="flex items-center border-b hover:bg-gray-50">
        <div className="px-4 py-2 w-[100px] text-sm">
          {txn.date.toLocaleDateString()}
        </div>
        <div className="px-4 py-2 flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{txn.payee}</div>
          {txn.description && (
            <div className="text-xs text-gray-500 truncate">
              {txn.description}
            </div>
          )}
        </div>
        <div className={`px-4 py-2 w-[100px] text-sm text-right font-medium ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(txn.amount)}
        </div>
        <div className="px-4 py-2 w-[150px]">
          <select
            value={txn.category || ''}
            onChange={(e) => onUpdate(txn.id, { category: e.target.value || undefined })}
            className="text-sm border rounded px-2 py-1 w-full"
          >
            <option value="">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="px-4 py-2 w-[200px]">
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
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Transactions ({filtered.length.toLocaleString()}
          {filter && ` of ${transactions.length.toLocaleString()}`})
        </h2>
        <input
          type="text"
          placeholder="Filter transactions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-md px-3 py-2 w-64"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="flex bg-gray-50 border-b">
          <div className="px-4 py-3 w-[100px] text-sm font-medium text-gray-500">Date</div>
          <div className="px-4 py-3 flex-1 text-sm font-medium text-gray-500">Payee</div>
          <div className="px-4 py-3 w-[100px] text-sm font-medium text-gray-500 text-right">Amount</div>
          <div className="px-4 py-3 w-[150px] text-sm font-medium text-gray-500">Category</div>
          <div className="px-4 py-3 w-[200px] text-sm font-medium text-gray-500">Tags</div>
        </div>

        {/* Virtualized List */}
        {filtered.length > 0 ? (
          <List
            height={Math.min(600, filtered.length * ROW_HEIGHT)}
            itemCount={filtered.length}
            itemSize={ROW_HEIGHT}
            width="100%"
          >
            {Row}
          </List>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No transactions found.
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Transaction, Category } from '../types';
import { Tag, X } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
}

export function TransactionList({ transactions, categories, onUpdate }: TransactionListProps) {
  const [filter, setFilter] = useState('');
  const [tagInput, setTagInput] = useState<{ [id: string]: string }>({});

  const filtered = transactions.filter(t =>
    t.payee.toLowerCase().includes(filter.toLowerCase()) ||
    t.description?.toLowerCase().includes(filter.toLowerCase())
  );

  const addTag = (id: string) => {
    const tag = tagInput[id]?.trim();
    if (!tag) return;

    const txn = transactions.find(t => t.id === id);
    if (txn && !txn.tags.includes(tag)) {
      onUpdate(id, { tags: [...txn.tags, tag] });
    }
    setTagInput(prev => ({ ...prev, [id]: '' }));
  };

  const removeTag = (id: string, tag: string) => {
    const txn = transactions.find(t => t.id === id);
    if (txn) {
      onUpdate(id, { tags: txn.tags.filter(t => t !== tag) });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Transactions ({transactions.length})</h2>
        <input
          type="text"
          placeholder="Filter transactions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-md px-3 py-2 w-64"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Payee</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {txn.date.toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{txn.payee}</div>
                  {txn.description && (
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {txn.description}
                    </div>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(txn.amount)}
                </td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    {txn.tags.map((tag) => (
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
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Add tag"
                        value={tagInput[txn.id] || ''}
                        onChange={(e) => setTagInput(prev => ({ ...prev, [txn.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addTag(txn.id)}
                        className="text-xs border rounded px-2 py-0.5 w-20"
                      />
                      <Tag
                        size={14}
                        className="text-gray-400 cursor-pointer hover:text-blue-600"
                        onClick={() => addTag(txn.id)}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

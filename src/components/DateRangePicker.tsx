import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { Transaction } from '../types';

interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  transactions: Transaction[];
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

function getPayPeriodDate(year: number, month: number): Date {
  const date = new Date(year, month, 25);
  const day = date.getDay();
  if (day === 0) date.setDate(23);
  else if (day === 6) date.setDate(24);
  return date;
}

export function DateRangePicker({ transactions, dateRange, onChange }: DateRangePickerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedPayPeriods, setSelectedPayPeriods] = useState<string[]>([]);

  const calendarMonths = useMemo(() => {
    if (transactions.length === 0) return [];
    const keys = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(keys)
      .sort()
      .reverse()
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return {
          id: key,
          label: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          start: `${key}-01`,
          end: `${String(year)}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        };
      });
  }, [transactions]);

  const payPeriods = useMemo(() => {
    if (transactions.length === 0) return [];
    const uniqueKeys = new Set<string>();
    transactions.forEach(t => {
      const date = new Date(t.date);
      let year = date.getFullYear();
      let month = date.getMonth();
      if (date.getDate() > 25) {
        month++;
        if (month > 11) { month = 0; year++; }
      }
      uniqueKeys.add(`${year}-${String(month).padStart(2, '0')}`);
    });
    return Array.from(uniqueKeys)
      .sort()
      .reverse()
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        const payDay = getPayPeriodDate(y, m);
        const prevPayDay = getPayPeriodDate(y, m - 1);
        const startDate = new Date(prevPayDay);
        startDate.setDate(startDate.getDate() + 1);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = payDay.toISOString().split('T')[0];
        const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${payDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        return { id: `${startStr}|${endStr}`, label, start: startStr, end: endStr };
      });
  }, [transactions]);

  const selectMonth = (id: string) => {
    if (selectedMonth === id) {
      setSelectedMonth(null);
      onChange({ start: '', end: '' });
    } else {
      const m = calendarMonths.find(m => m.id === id);
      if (!m) return;
      setSelectedMonth(id);
      setSelectedPayPeriods([]);
      onChange({ start: m.start, end: m.end });
    }
  };

  const togglePayPeriod = (periodId: string) => {
    setSelectedMonth(null);
    const next = selectedPayPeriods.includes(periodId)
      ? selectedPayPeriods.filter(id => id !== periodId)
      : [...selectedPayPeriods, periodId];
    setSelectedPayPeriods(next);
    if (next.length === 0) {
      onChange({ start: '', end: '' });
    } else {
      let minStart = '', maxEnd = '';
      next.forEach(id => {
        const [s, e] = id.split('|');
        if (!minStart || s < minStart) minStart = s;
        if (!maxEnd || e > maxEnd) maxEnd = e;
      });
      onChange({ start: minStart, end: maxEnd });
    }
  };

  const clearManual = () => {
    setSelectedMonth(null);
    setSelectedPayPeriods([]);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Manual date inputs */}
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-gray-400 shrink-0" />
        <input
          type="date"
          value={dateRange.start}
          onChange={e => { clearManual(); onChange({ ...dateRange, start: e.target.value }); }}
          className="border rounded px-2 py-1 text-sm"
        />
        <span className="text-gray-400">–</span>
        <input
          type="date"
          value={dateRange.end}
          onChange={e => { clearManual(); onChange({ ...dateRange, end: e.target.value }); }}
          className="border rounded px-2 py-1 text-sm"
        />
        {(dateRange.start || dateRange.end) && (
          <button
            onClick={() => { clearManual(); onChange({ start: '', end: '' }); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border"
          >
            Clear
          </button>
        )}
      </div>

      {/* Month pills */}
      {calendarMonths.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0 w-16">Month</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {calendarMonths.map(m => (
              <button
                key={m.id}
                onClick={() => selectMonth(m.id)}
                className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors ${
                  selectedMonth === m.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pay period pills */}
      {payPeriods.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0 w-16">Pay&nbsp;period</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {payPeriods.map(p => (
              <button
                key={p.id}
                onClick={() => togglePayPeriod(p.id)}
                className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors ${
                  selectedPayPeriods.includes(p.id)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

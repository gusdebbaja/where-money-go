import { useState, useRef, useEffect, useMemo, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../types';
import { Search, ChevronDown, X } from 'lucide-react';

interface CategorySelectProps {
  value: string;
  categories: Category[];
  onChange: (value: string) => void;
}

const DROPDOWN_HEIGHT = 280;

export function CategorySelect({ value, categories, onChange }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCat = categories.find(c => c.name === value);
  const roots = useMemo(() => categories.filter(c => !c.parent), [categories]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const computePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_HEIGHT + 8 && rect.top > DROPDOWN_HEIGHT;
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 9999,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const handleOpen = () => {
    computePosition();
    setOpen(v => !v);
  };

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => computePosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const dropdown = (
    <div
      ref={dropdownRef}
      className="flex flex-col rounded-lg shadow-xl border"
      style={{
        ...dropdownStyle,
        maxHeight: DROPDOWN_HEIGHT,
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Search bar */}
      <div className="flex items-center gap-1.5 px-2 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setOpen(false)}
          placeholder="Search categories..."
          className="flex-1 text-sm outline-none"
          style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ color: 'var(--text-muted)' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Options */}
      <div className="overflow-y-auto flex-1">
        <button
          onMouseDown={e => { e.preventDefault(); select(''); }}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          style={{ color: 'var(--text-muted)' }}
        >
          — Uncategorized
        </button>

        {search ? (
          filtered.length > 0 ? filtered.map(cat => (
            <button
              key={cat.name}
              onMouseDown={e => { e.preventDefault(); select(cat.name); }}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-100"
              style={{ fontWeight: value === cat.name ? 600 : undefined }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
              {cat.parent && (
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{cat.parent}</span>
              )}
            </button>
          )) : (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No matches</div>
          )
        ) : (
          roots.map(root => {
            const children = categories.filter(c => c.parent === root.name);
            return (
              <div key={root.name}>
                <button
                  onMouseDown={e => { e.preventDefault(); select(root.name); }}
                  className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-100"
                  style={{
                    fontWeight: 600,
                    backgroundColor: value === root.name ? 'var(--bg-tertiary)' : undefined,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: root.color }} />
                  {root.name}
                </button>
                {children.map(child => (
                  <button
                    key={child.name}
                    onMouseDown={e => { e.preventDefault(); select(child.name); }}
                    className="w-full text-left pl-7 pr-3 py-1 text-sm flex items-center gap-2 hover:bg-gray-100"
                    style={{
                      fontWeight: value === child.name ? 600 : undefined,
                      backgroundColor: value === child.name ? 'var(--bg-tertiary)' : undefined,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: child.color }} />
                    {child.name}
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-1.5 text-sm border rounded px-2 py-1 text-left hover:border-blue-400 transition-colors"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      >
        {selectedCat ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCat.color }} />
            <span className="flex-1 truncate">{selectedCat.name}</span>
            <X size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} onClick={clear} />
          </>
        ) : (
          <>
            <span className="flex-1" style={{ color: 'var(--text-muted)' }}>Uncategorized</span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </>
        )}
      </button>

      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

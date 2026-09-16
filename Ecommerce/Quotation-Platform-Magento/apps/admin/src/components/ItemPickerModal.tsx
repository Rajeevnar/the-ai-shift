'use client';

import { useMemo, useState } from 'react';
import { ItemLibraryItem } from '../lib/types';

// Shared by the quote builder and template builder's "Add from library"
// action — a searchable modal instead of a plain <select>, which stops
// being usable once a tenant has more than a handful of items. Filtering
// happens client-side against the already-loaded item list (fetched once
// per page load) rather than hitting the API per keystroke — fine at the
// scale a single tenant's item library realistically reaches.
export function ItemPickerModal({
  items,
  onSelect,
  onClose,
}: {
  items: ItemLibraryItem[];
  onSelect: (item: ItemLibraryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-4">
          <p className="mb-2 font-medium">Add from item library</p>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No items match &ldquo;{search}&rdquo;.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center justify-between border-b border-slate-50 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="block font-medium text-slate-800">{item.name}</span>
                  {item.sku && <span className="block text-xs text-slate-400">SKU {item.sku}</span>}
                </span>
                <span className="text-slate-500">£{Number(item.defaultUnitPrice).toFixed(2)}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-slate-100 p-3 text-right">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

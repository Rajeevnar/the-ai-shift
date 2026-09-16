'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api';
import { ItemLibraryItem } from '../../../lib/types';

const PAGE_SIZE = 100;

export default function ItemLibraryPage() {
  const [items, setItems] = useState<ItemLibraryItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), take: String(PAGE_SIZE) });
    if (search.trim()) params.set('q', search.trim());
    api
      .get<{ items: ItemLibraryItem[]; total: number }>(`/item-library/search?${params}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      });
  }, [page, search]);

  useEffect(load, [load]);

  // Any search edit jumps back to page 0 — staying on e.g. page 3 of a
  // fresh, much-shorter search result would just show an empty page.
  function onSearchChange(value: string) {
    setSearch(value);
    setPage(0);
  }

  async function onRefresh() {
    setError(null);
    setNotice(null);
    setRefreshing(true);
    try {
      const result = await api.post<{ refreshed: number; total: number }>('/item-library/refresh-from-connectors');
      setNotice(
        result.total === 0
          ? 'No items were imported from a connector — nothing to refresh.'
          : `Refreshed ${result.refreshed} of ${result.total} synced items with their latest connector prices.`,
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not refresh items');
    } finally {
      setRefreshing(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/item-library', {
        name,
        defaultUnitPrice: price ? Number(price) : undefined,
        defaultVatRate: vatRate ? Number(vatRate) : undefined,
      });
      setName('');
      setPrice('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Item Library</h1>

      <form onSubmit={onSubmit} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Unit price</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-28 rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">VAT %</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="w-24 rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add item
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </form>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh synced items'}
        </button>
        <span className="text-xs text-slate-400">
          Re-applies the latest prices from each item&apos;s connector — for a fresh pull from Magento itself, sync on
          the Connectors page first.
        </span>
      </div>
      {notice && <p className="mb-4 text-sm text-green-700">{notice}</p>}

      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <span className="shrink-0 text-sm text-slate-500">{total} item{total === 1 ? '' : 's'} total</span>
      </div>

      {items === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        search ? (
          <p className="text-slate-400">No items match your search.</p>
        ) : (
          <p className="text-slate-400">
            No items yet. Add one above, or — if you&apos;ve already synced a connector — go to{' '}
            <Link href="/dashboard/connectors" className="underline hover:text-slate-600">
              Connectors
            </Link>
            , click &ldquo;View products&rdquo;, select the ones you want (there&apos;s a &ldquo;Select all&rdquo;
            option), and click &ldquo;Import to item library&rdquo;. Syncing only pulls products in for browsing —
            importing is the separate step that makes them usable on quotes.
          </p>
        )
      ) : (
        <>
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Unit price</th>
                <th className="px-4 py-2 font-medium">VAT %</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {i.name}
                    {i.sourceConnectorProductId && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">synced</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{Number(i.defaultUnitPrice).toFixed(2)}</td>
                  <td className="px-4 py-2 text-slate-500">{Number(i.defaultVatRate).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Showing {pageStart}–{pageEnd} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={pageEnd >= total}
                  className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

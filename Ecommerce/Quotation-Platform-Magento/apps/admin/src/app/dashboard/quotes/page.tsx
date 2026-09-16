'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../lib/api';
import { Client, QuoteSummary, QuoteTemplateSummary } from '../../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
};

const NEW_CLIENT = '__new__';

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplateSummary[]>([]);
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  function loadClients() {
    api.get<Client[]>('/clients').then(setClients).catch(() => setClients([]));
  }

  useEffect(() => {
    api.get<QuoteSummary[]>('/quotes').then(setQuotes).catch(() => setQuotes([]));
    api.get<QuoteTemplateSummary[]>('/quote-templates').then(setTemplates).catch(() => setTemplates([]));
    loadClients();
  }, []);

  async function onCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingClient(true);
    try {
      const client = await api.post<Client>('/clients', { name: newClientName, email: newClientEmail || undefined });
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(client.id);
      setNewClientName('');
      setNewClientEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create client');
    } finally {
      setCreatingClient(false);
    }
  }

  async function onCreate() {
    setError(null);
    setCreating(true);
    try {
      // clientId is optional — a quote can be started immediately and the
      // client picked/added from the builder page itself.
      const quote = await api.post<{ id: string }>('/quotes', {
        clientId: clientId && clientId !== NEW_CLIENT ? clientId : undefined,
        templateId: templateId || undefined,
      });
      router.push(`/dashboard/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create quote');
    } finally {
      setCreating(false);
    }
  }

  const filteredQuotes = useMemo(() => {
    if (!quotes) return null;
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        quote.quoteNumber.toLowerCase().includes(q) ||
        (quote.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (quote.client?.name ?? '').toLowerCase().includes(q),
    );
  }, [quotes, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <span className="text-sm text-slate-500">{quotes?.length ?? 0} total</span>
      </div>

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">New quote for (optional)</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5"
            >
              <option value="">No client yet — pick later</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CLIENT}>+ New client…</option>
            </select>
          </label>
          {templates.length > 0 && (
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Starting from</span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5"
              >
                <option value="">Blank quote</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {clientId !== NEW_CLIENT && (
            <button
              onClick={onCreate}
              disabled={creating}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'New quote'}
            </button>
          )}
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>

        {clientId === NEW_CLIENT && (
          <form onSubmit={onCreateClient} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Client name</span>
              <input
                required
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Email (optional)</span>
              <input
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={creatingClient}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creatingClient ? 'Adding…' : 'Add client'}
            </button>
            <button type="button" onClick={() => setClientId('')} className="text-sm text-slate-500 hover:text-slate-800">
              Cancel
            </button>
          </form>
        )}
      </div>

      {quotes && quotes.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by number or client…"
          className="mb-4 w-full max-w-sm rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
      )}

      {quotes === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : quotes.length === 0 ? (
        <p className="text-slate-400">No quotes yet.</p>
      ) : filteredQuotes?.length === 0 ? (
        <p className="text-slate-400">No quotes match your search.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Issue date</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotes?.map((q) => (
              <tr
                key={q.id}
                onClick={() => router.push(`/dashboard/quotes/${q.id}`)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2 font-medium">
                  {q.documentType === 'invoice' ? q.invoiceNumber : q.quoteNumber}
                  {q.documentType === 'invoice' && (
                    <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">invoice</span>
                  )}
                </td>
                <td className="px-4 py-2">{q.client?.name ?? <span className="text-slate-400">No client yet</span>}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[q.status]}`}>{q.status}</span>
                </td>
                <td className="px-4 py-2 text-slate-500">{new Date(q.issueDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {q.currency} {Number(q.grandTotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

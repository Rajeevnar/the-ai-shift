'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../lib/api';
import { Client, ClientQuoteHistoryEntry, ClientSummary } from '../../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
};

// Fields the panel edits — separate from Client so the tags text input can
// hold a raw comma-separated string while it's being typed.
interface ClientForm {
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  tagsInput: string;
}

function toForm(client: Client): ClientForm {
  return {
    name: client.name,
    email: client.email ?? '',
    phone: client.phone ?? '',
    billingAddress: client.billingAddress ?? '',
    tagsInput: client.tags.join(', '),
  };
}

const EMPTY_FORM: ClientForm = { name: '', email: '', phone: '', billingAddress: '', tagsInput: '' };

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [search, setSearch] = useState('');

  // Panel state: null = closed, 'new' = creating, or the client id being edited.
  const [panel, setPanel] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [history, setHistory] = useState<ClientQuoteHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<ClientSummary[]>('/clients').then(setClients).catch(() => setClients([]));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!clients) return null;
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [clients, search]);

  function openNew() {
    setError(null);
    setForm(EMPTY_FORM);
    setHistory(null);
    setPanel('new');
  }

  function openEdit(client: ClientSummary) {
    setError(null);
    setForm(toForm(client));
    setHistory(null);
    setPanel(client.id);
    api.get<ClientQuoteHistoryEntry[]>(`/clients/${client.id}/quotes`).then(setHistory).catch(() => setHistory([]));
  }

  function closePanel() {
    setPanel(null);
  }

  function parseTags(input: string): string[] {
    return input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      billingAddress: form.billingAddress || undefined,
      tags: parseTags(form.tagsInput),
    };
    try {
      if (panel === 'new') {
        await api.post<Client>('/clients', payload);
      } else if (panel) {
        await api.patch<Client>(`/clients/${panel}`, payload);
      }
      closePanel();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const editingClient = panel && panel !== 'new' ? clients?.find((c) => c.id === panel) : null;

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Clients</h1>
          <button
            onClick={openNew}
            className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            + New client
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or tag…"
          className="mb-4 w-full max-w-sm rounded border border-slate-300 px-3 py-1.5 text-sm"
        />

        {filtered === null ? (
          <p className="text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400">{clients?.length ? 'No clients match your search.' : 'No clients yet.'}</p>
        ) : (
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Tags</th>
                <th className="px-4 py-2 text-right font-medium">Quotes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${panel === c.id ? 'bg-slate-50' : ''}`}
                >
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-slate-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">{c.quoteCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panel && (
        <div className="w-96 shrink-0 rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{panel === 'new' ? 'New client' : editingClient?.name ?? 'Edit client'}</h2>
            <button onClick={closePanel} className="text-sm text-slate-400 hover:text-slate-700">
              Close
            </button>
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Billing address</span>
              <textarea
                value={form.billingAddress}
                onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
                rows={2}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Tags (comma separated)</span>
              <input
                value={form.tagsInput}
                onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
                placeholder="VIP, Corporate, Repeat"
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : panel === 'new' ? 'Add client' : 'Save changes'}
              </button>
              <button type="button" onClick={closePanel} className="rounded px-4 py-1.5 text-sm text-slate-500 hover:text-slate-800">
                Cancel
              </button>
            </div>
          </form>

          {panel !== 'new' && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-700">History</h3>
              {history === null ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400">No quotes or invoices sent to this client yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      onClick={() => router.push(`/dashboard/quotes/${h.id}`)}
                      className="flex cursor-pointer items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div>
                        <div className="font-medium">
                          {h.documentType === 'invoice' ? h.invoiceNumber : h.quoteNumber}
                          {h.documentType === 'invoice' && (
                            <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">invoice</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString()}
                          {h.sentCount > 0 && ` · sent ${h.sentCount}${h.sentCount > 1 ? 'x' : ''}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[h.status]}`}>{h.status}</span>
                        <span className="text-slate-600">{Number(h.grandTotal).toFixed(2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

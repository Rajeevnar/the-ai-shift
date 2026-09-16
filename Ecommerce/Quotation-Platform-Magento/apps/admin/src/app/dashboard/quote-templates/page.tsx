'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../lib/api';
import { useDialog } from '../../../lib/dialog';
import { QuoteTemplateSummary } from '../../../lib/types';

export default function QuoteTemplatesPage() {
  const router = useRouter();
  const { confirmDialog } = useDialog();
  const [templates, setTemplates] = useState<QuoteTemplateSummary[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api.get<QuoteTemplateSummary[]>('/quote-templates').then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const template = await api.post<QuoteTemplateSummary>('/quote-templates', { name });
      router.push(`/dashboard/quote-templates/${template.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create template');
    } finally {
      setCreating(false);
    }
  }

  async function onRemove(id: string) {
    const ok = await confirmDialog('Delete this template? This cannot be undone.', { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    setError(null);
    try {
      await api.delete(`/quote-templates/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete template');
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Quote Templates</h1>
      <p className="mb-6 text-slate-500">Starter layouts you can pick when creating a new quote.</p>

      <form onSubmit={onCreate} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Template name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5"
            placeholder="e.g. Catering event"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New template'}
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </form>

      {templates === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-slate-400">
          No templates yet. Create one above, or open a quote and use &ldquo;Save as template&rdquo;.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <button onClick={() => router.push(`/dashboard/quote-templates/${t.id}`)} className="text-left font-medium hover:underline">
                {t.name}
              </button>
              <button onClick={() => onRemove(t.id)} className="text-xs text-slate-400 hover:text-red-600">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

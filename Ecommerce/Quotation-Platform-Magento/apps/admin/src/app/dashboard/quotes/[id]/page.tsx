'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { useDialog } from '../../../../lib/dialog';
import { Client, ItemLibraryItem, QuoteFull, QuoteLineItem, QuoteStatus } from '../../../../lib/types';
import { ItemPickerModal } from '../../../../components/ItemPickerModal';

// Linear workflow: draft -> sent -> accepted | declined. A quote that hasn't
// been sent yet has no business being "accepted"/"declined" — that was a
// real, reported bug (all three buttons showed regardless of status).
const NEXT_STATUS_ACTIONS: Record<QuoteStatus, { status: QuoteStatus; label: string }[]> = {
  draft: [{ status: 'sent', label: 'Mark as sent' }],
  sent: [
    { status: 'accepted', label: 'Mark as accepted' },
    { status: 'declined', label: 'Mark as declined' },
  ],
  accepted: [],
  declined: [],
  expired: [],
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-green-50 text-green-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
};

const ACTIVITY_STYLES: Record<string, string> = {
  Sent: 'bg-blue-50 text-blue-700',
  Accepted: 'bg-green-50 text-green-700',
  Declined: 'bg-red-50 text-red-700',
  'Converted to invoice': 'bg-purple-50 text-purple-700',
  'Reverted to quote': 'bg-purple-50 text-purple-700',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  converted_to_invoice: 'Converted to invoice',
  reverted_to_quote: 'Reverted to quote',
};

export default function QuoteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { confirmDialog, alertDialog, promptDialog } = useDialog();
  const [quote, setQuote] = useState<QuoteFull | null>(null);
  const [itemLibrary, setItemLibrary] = useState<ItemLibraryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [clientPanelOpen, setClientPanelOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const load = useCallback(() => {
    api.get<QuoteFull>(`/quotes/${id}`).then(setQuote).catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [id]);

  useEffect(() => {
    load();
    api.get<ItemLibraryItem[]>('/item-library').then(setItemLibrary).catch(() => setItemLibrary([]));
    api.get<Client[]>('/clients').then(setClients).catch(() => setClients([]));
  }, [load]);

  // Every mutating action goes through this: shows "Saving…" immediately,
  // "Saved" briefly on success (so auto-save is actually visible, not
  // silent), and a real error message on failure instead of swallowing it —
  // a failed request previously vanished with no feedback at all, which is
  // what made a genuinely failed delete/edit look like "nothing happened."
  async function withSaveState(fn: () => Promise<void>) {
    setSaveState('saving');
    setError(null);
    try {
      await fn();
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (err) {
      setSaveState('error');
      setError(err instanceof ApiError ? err.message : 'Something went wrong — change may not have saved.');
    }
  }

  function addSection() {
    return withSaveState(async () => {
      await api.post(`/quotes/${id}/sections`, { title: 'New section' });
      load();
    });
  }

  function updateSectionTitle(sectionId: string, title: string) {
    return withSaveState(async () => {
      await api.patch(`/quotes/${id}/sections/${sectionId}`, { title });
      load();
    });
  }

  async function removeSection(sectionId: string) {
    const ok = await confirmDialog('Remove this section and all its line items?', { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    return withSaveState(async () => {
      await api.delete(`/quotes/${id}/sections/${sectionId}`);
      load();
    });
  }

  function addLineItem(sectionId: string, itemLibraryItemId?: string) {
    return withSaveState(async () => {
      await api.post(
        `/quotes/${id}/sections/${sectionId}/line-items`,
        itemLibraryItemId ? { itemLibraryItemId } : { description: 'New item', quantity: 1, unitPrice: 0, vatRate: 20 },
      );
      load();
    });
  }

  function commitLineItem(sectionId: string, lineItemId: string, patch: Record<string, unknown>) {
    return withSaveState(async () => {
      await api.patch(`/quotes/${id}/sections/${sectionId}/line-items/${lineItemId}`, patch);
      load();
    });
  }

  async function removeLineItem(sectionId: string, lineItemId: string) {
    const ok = await confirmDialog('Remove this line item?', { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    return withSaveState(async () => {
      await api.delete(`/quotes/${id}/sections/${sectionId}/line-items/${lineItemId}`);
      load();
    });
  }

  function setStatus(status: QuoteStatus) {
    return withSaveState(async () => {
      await api.patch(`/quotes/${id}/status`, { status });
      load();
    });
  }

  // Attaches an existing client (picked from the list) to this quote.
  function attachClient(clientId: string) {
    return withSaveState(async () => {
      await api.patch(`/quotes/${id}`, { clientId });
      load();
      setClientPanelOpen(false);
    });
  }

  // Creates a brand new client and attaches it in one step.
  function createAndAttachClient(data: Partial<Client>) {
    return withSaveState(async () => {
      const client = await api.post<Client>('/clients', data);
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
      await api.patch(`/quotes/${id}`, { clientId: client.id });
      load();
      setClientPanelOpen(false);
    });
  }

  // Edits the details of the client already attached to this quote.
  function updateClientDetails(patch: Partial<Client>) {
    if (!quote?.client) return Promise.resolve();
    return withSaveState(async () => {
      await api.patch(`/clients/${quote.client!.id}`, patch);
      load();
      setClientPanelOpen(false);
    });
  }

  async function saveAsTemplate() {
    const name = await promptDialog(
      'Save this quote as a template named:',
      quote?.quoteNumber ? `${quote.quoteNumber} template` : 'New template',
    );
    if (!name) return;
    await withSaveState(async () => {
      await api.post(`/quotes/${id}/save-as-template`, { name });
    });
    await alertDialog('Saved. Find it under Templates.');
  }

  async function convertToInvoice() {
    const ok = await confirmDialog('Convert this quote to an invoice? It will get its own invoice number.', {
      confirmLabel: 'Convert',
    });
    if (!ok) return;
    return withSaveState(async () => {
      await api.post(`/quotes/${id}/convert-to-invoice`);
      load();
    });
  }

  async function revertToQuote() {
    const ok = await confirmDialog('Revert this back to a quote? Its invoice number will be dropped.', {
      confirmLabel: 'Revert',
      danger: true,
    });
    if (!ok) return;
    return withSaveState(async () => {
      await api.post(`/quotes/${id}/revert-to-quote`);
      load();
    });
  }

  async function sendQuote(payload: { toEmail: string; subject?: string; message: string }) {
    await withSaveState(async () => {
      await api.post(`/quotes/${id}/send`, payload);
      load();
    });
    setSendDialogOpen(false);
  }

  if (error && !quote) return <p className="text-red-700">{error}</p>;
  if (!quote) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto flex max-w-6xl items-start gap-6">
    <div className="min-w-0 flex-1">
      <Link href="/dashboard/quotes" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to Quotes
      </Link>
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {quote.documentType === 'invoice' ? quote.invoiceNumber : quote.quoteNumber}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setClientPanelOpen((o) => !o)} className="text-slate-500 hover:underline">
              {quote.client?.name ?? 'No client yet — click to add'}
            </button>
            {quote.documentType === 'invoice' && (
              <span className="whitespace-nowrap rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                invoice · from {quote.quoteNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} />
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${QUOTE_STATUS_STYLES[quote.status]}`}
            >
              {quote.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {NEXT_STATUS_ACTIONS[quote.status].map((a) => (
              <button
                key={a.status}
                onClick={() => setStatus(a.status)}
                className="whitespace-nowrap rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {a.label}
              </button>
            ))}
            <button
              onClick={saveAsTemplate}
              className="whitespace-nowrap rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Save as template
            </button>
            {quote.documentType === 'quote' ? (
              <button
                onClick={convertToInvoice}
                className="whitespace-nowrap rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Convert to invoice
              </button>
            ) : (
              <button
                onClick={revertToQuote}
                className="whitespace-nowrap rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Revert to quote
              </button>
            )}
            <button
              onClick={() => setSendDialogOpen(true)}
              className="whitespace-nowrap rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {quote.status === 'sent' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
          Sent{quote.sentAt ? ` · ${new Date(quote.sentAt).toLocaleString()}` : ''}
        </div>
      )}

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {clientPanelOpen && (
        <ClientPanel
          client={quote.client}
          clients={clients}
          onAttach={attachClient}
          onCreate={createAndAttachClient}
          onUpdate={updateClientDetails}
          onClose={() => setClientPanelOpen(false)}
        />
      )}

      {sendDialogOpen && (
        <SendDialog
          documentLabel={quote.documentType === 'invoice' ? 'Invoice' : 'Quote'}
          number={quote.documentType === 'invoice' ? (quote.invoiceNumber ?? '') : quote.quoteNumber}
          tenantName={user?.tenant.emailFromName || user?.tenant.name || ''}
          defaultToEmail={quote.client?.email ?? ''}
          defaultMessage={quote.notes ?? ''}
          onSend={sendQuote}
          onClose={() => setSendDialogOpen(false)}
        />
      )}

      <div className="mb-6 mt-4 space-y-6">
        {quote.sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            currency={quote.currency}
            itemLibrary={itemLibrary}
            onTitleBlur={(title) => updateSectionTitle(section.id, title)}
            onRemoveSection={() => removeSection(section.id)}
            onAddLineItem={(itemLibraryItemId) => addLineItem(section.id, itemLibraryItemId)}
            onCommitLineItem={(lineItemId, patch) => commitLineItem(section.id, lineItemId, patch)}
            onRemoveLineItem={(lineItemId) => removeLineItem(section.id, lineItemId)}
          />
        ))}
      </div>

      <button onClick={addSection} className="mt-4 rounded border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
        + Add section
      </button>

      <div className="mt-8 ml-auto w-64 space-y-1 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>
            {quote.currency} {Number(quote.subtotal).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>VAT</span>
          <span>
            {quote.currency} {Number(quote.vatTotal).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
          <span>Total</span>
          <span>
            {quote.currency} {Number(quote.grandTotal).toFixed(2)}
          </span>
        </div>
      </div>
    </div>

    <ActivitySidebar quote={quote} />
    </div>
  );
}

// Built entirely from the quote's own timestamp fields — no separate audit
// log table. sentAt/acceptedAt/declinedAt/convertedToInvoiceAt are only
// ever set once each, and updatedAt already advances on every section/line
// item change (recomputeQuote touches the Quote row on every edit), so
// "Last edited" reflects real edit activity without any extra tracking.
function ActivitySidebar({ quote }: { quote: QuoteFull }) {
  // Every discrete send/status-change/convert/revert is its own row from
  // quote.activities — a resent quote shows as multiple "Sent" entries,
  // not one that silently doesn't move. "Created" and "Last edited" aren't
  // discrete events (no per-keystroke log, just Quote's own timestamps),
  // so those two are still derived here rather than coming from the table.
  const events: { label: string; date: string; detail?: string | null }[] = [
    { label: 'Created', date: quote.createdAt },
    ...quote.activities.map((a) => ({ label: ACTIVITY_LABELS[a.type] ?? a.type, date: a.createdAt, detail: a.detail })),
  ];
  // A >1s gap filters out the no-op case where updatedAt is just
  // createdAt's own initial value (they're set in the same insert).
  if (new Date(quote.updatedAt).getTime() - new Date(quote.createdAt).getTime() > 1000) {
    events.push({ label: 'Last edited', date: quote.updatedAt });
  }
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sentCount = quote.activities.filter((a) => a.type === 'sent').length;

  return (
    <aside className="w-72 shrink-0 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Activity</h2>
      <p className="mb-3 text-xs text-slate-400">
        {sentCount > 0
          ? `Sent ${sentCount}${sentCount > 1 ? 'x' : ''} · last ${new Date(quote.sentAt!).toLocaleDateString()}`
          : 'Not sent yet'}
      </p>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs ${ACTIVITY_STYLES[e.label] ?? 'bg-slate-100 text-slate-600'}`}>
              {e.label}
            </span>
            <span className="text-right text-xs text-slate-400">
              {e.detail && <span className="mr-1">{e.detail}</span>}
              {new Date(e.date).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Not saved';
  const color = state === 'error' ? 'text-red-600' : 'text-slate-400';
  return <span className={`text-xs ${color}`}>{text}</span>;
}

// Handles all three client states in one panel: pick an existing client,
// create+attach a new one, or (if one's already attached) edit its details
// — all reachable from the quote page itself, no separate mandatory step.
function ClientPanel({
  client,
  clients,
  onAttach,
  onCreate,
  onUpdate,
  onClose,
}: {
  client: Client | null;
  clients: Client[];
  onAttach: (clientId: string) => Promise<void>;
  onCreate: (data: Partial<Client>) => Promise<void>;
  onUpdate: (patch: Partial<Client>) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [pickId, setPickId] = useState('');
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', billingAddress: '' });
  const [editClient, setEditClient] = useState({
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    billingAddress: client?.billingAddress ?? '',
  });

  if (client) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpdate({
            name: editClient.name,
            email: editClient.email || undefined,
            phone: editClient.phone || undefined,
            billingAddress: editClient.billingAddress || undefined,
          });
        }}
        className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <p className="col-span-2 font-medium">Client details</p>
        {(['name', 'email', 'phone', 'billingAddress'] as const).map((field) => (
          <label key={field} className="text-sm">
            <span className="mb-1 block capitalize text-slate-600">{field === 'billingAddress' ? 'Billing address' : field}</span>
            <input
              required={field === 'name'}
              type={field === 'email' ? 'email' : 'text'}
              value={editClient[field]}
              onChange={(e) => setEditClient((c) => ({ ...c, [field]: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
        ))}
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save client details
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('pick')}
          className={`rounded px-3 py-1 ${mode === 'pick' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}
        >
          Choose existing
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`rounded px-3 py-1 ${mode === 'new' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}
        >
          New client
        </button>
      </div>

      {mode === 'pick' ? (
        <div className="flex items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Client</span>
            <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5">
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!pickId}
            onClick={() => onAttach(pickId)}
            className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Attach
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate({
              name: newClient.name,
              email: newClient.email || undefined,
              phone: newClient.phone || undefined,
              billingAddress: newClient.billingAddress || undefined,
            });
          }}
          className="grid grid-cols-2 gap-3"
        >
          {(['name', 'email', 'phone', 'billingAddress'] as const).map((field) => (
            <label key={field} className="text-sm">
              <span className="mb-1 block capitalize text-slate-600">{field === 'billingAddress' ? 'Billing address' : field}</span>
              <input
                required={field === 'name'}
                type={field === 'email' ? 'email' : 'text'}
                value={newClient[field]}
                onChange={(e) => setNewClient((c) => ({ ...c, [field]: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
          ))}
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              Create & attach
            </button>
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SendDialog({
  documentLabel,
  number,
  tenantName,
  defaultToEmail,
  defaultMessage,
  onSend,
  onClose,
}: {
  documentLabel: string;
  number: string;
  tenantName: string;
  defaultToEmail: string;
  defaultMessage: string;
  onSend: (payload: { toEmail: string; subject?: string; message: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [toEmail, setToEmail] = useState(defaultToEmail);
  // Left blank by default rather than pre-filled with a bare "Quote
  // Q-1002" — the backend fills in a nicer branded default ("Quote Q-1002
  // from Your Company") when subject is omitted entirely. Pre-filling here
  // was overriding that every time, which is why the branded subject never
  // actually showed up.
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectPlaceholder = `${documentLabel} ${number}${tenantName ? ` from ${tenantName}` : ''}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await onSend({ toEmail, subject: subject || undefined, message });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <p className="mb-4 text-lg font-semibold">
          Send {documentLabel} {number}
        </p>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">To</span>
          <input
            required
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Subject (optional — leave blank for the default)</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={subjectPlaceholder}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-600">Message (optional — overrides your default intro for this send)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={sending}
            className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionCard({
  section,
  currency,
  itemLibrary,
  onTitleBlur,
  onRemoveSection,
  onAddLineItem,
  onCommitLineItem,
  onRemoveLineItem,
}: {
  section: QuoteFull['sections'][number];
  currency: string;
  itemLibrary: ItemLibraryItem[];
  onTitleBlur: (title: string) => void;
  onRemoveSection: () => void;
  onAddLineItem: (itemLibraryItemId?: string) => void;
  onCommitLineItem: (lineItemId: string, patch: Record<string, unknown>) => void;
  onRemoveLineItem: (lineItemId: string) => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {pickerOpen && (
        <ItemPickerModal
          items={itemLibrary}
          onSelect={(item) => {
            onAddLineItem(item.id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== section.title && onTitleBlur(title)}
          className="rounded border border-transparent px-1 py-0.5 font-medium hover:border-slate-200 focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemoveSection}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Remove section
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-400">
          <tr>
            <th className="pb-1 font-medium">Description</th>
            <th className="w-16 pb-1 font-medium">Qty</th>
            <th className="w-24 pb-1 font-medium">Price</th>
            <th className="w-16 pb-1 font-medium">Disc %</th>
            <th className="w-16 pb-1 font-medium">VAT %</th>
            <th className="w-24 pb-1 text-right font-medium">Amount</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {section.lineItems.map((li) => (
            <LineItemRow key={li.id} lineItem={li} onCommit={(patch) => onCommitLineItem(li.id, patch)} onRemove={() => onRemoveLineItem(li.id)} />
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => onAddLineItem()} className="text-sm text-slate-500 hover:text-slate-800">
            + Add line
          </button>
          {itemLibrary.length > 0 && (
            <button type="button" onClick={() => setPickerOpen(true)} className="text-sm text-slate-500 hover:text-slate-800">
              + Add from library…
            </button>
          )}
        </div>
        <div className="text-sm text-slate-500">
          Subtotal {currency} {Number(section.subtotal).toFixed(2)} · VAT {currency} {Number(section.vatTotal).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function LineItemRow({
  lineItem,
  onCommit,
  onRemove,
}: {
  lineItem: QuoteLineItem;
  onCommit: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({
    description: lineItem.description,
    quantity: lineItem.quantity,
    unitPrice: lineItem.unitPrice,
    discountPercent: lineItem.discountPercent,
    vatRate: lineItem.vatRate,
  });

  function field(name: keyof typeof local, numeric = false) {
    return {
      value: local[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal((l) => ({ ...l, [name]: e.target.value })),
      onBlur: () => {
        const value = local[name];
        if (value === String((lineItem as unknown as Record<string, unknown>)[name])) return;
        onCommit({ [name]: numeric ? Number(value) : value });
      },
    };
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-2">
        <input {...field('description')} className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        {/* step=1 so the spinner arrows move whole units (1, 2, 3…) instead
            of 1, 1.01, 1.02 — typing a fractional quantity by hand is still
            unrestricted, `step` only governs the up/down arrows. */}
        <input type="number" step="1" {...field('quantity', true)} className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="0.1" {...field('unitPrice', true)} className="w-24 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="0.1" {...field('discountPercent', true)} className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="0.1" {...field('vatRate', true)} className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2 text-right text-slate-600">{Number(lineItem.amount).toFixed(2)}</td>
      <td className="py-1 text-right">
        {/* onMouseDown preventDefault stops this click from being preceded
            by a blur-triggered save on whichever field was just being
            edited — without it, a still-in-flight PATCH for a row that's
            about to be deleted can race the DELETE and appear to make the
            delete "not take effect" until an unrelated later save. */}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onRemove} className="text-xs text-slate-300 hover:text-red-600">
          ✕
        </button>
      </td>
    </tr>
  );
}

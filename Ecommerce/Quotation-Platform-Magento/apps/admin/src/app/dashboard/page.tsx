'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DashboardOverview, QuoteActivityType } from '../../lib/types';

type Period = 'all' | 'month' | '30d';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
];

function periodSince(period: Period): string | undefined {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (period === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

// Distinct from the quote detail page's own status colors — here every
// status is shown side by side as peer categories in one bar, so each
// needs to read as visually distinct from its neighbors; on the single-
// quote page only one status is ever shown at a time, so that page reuses
// green more loosely.
const STATUS_META: { key: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'; label: string; bar: string; dot: string }[] = [
  { key: 'draft', label: 'Draft', bar: 'bg-slate-300', dot: 'bg-slate-400' },
  { key: 'sent', label: 'Sent', bar: 'bg-blue-400', dot: 'bg-blue-500' },
  { key: 'accepted', label: 'Accepted', bar: 'bg-green-400', dot: 'bg-green-500' },
  { key: 'declined', label: 'Declined', bar: 'bg-red-400', dot: 'bg-red-500' },
  { key: 'expired', label: 'Expired', bar: 'bg-amber-400', dot: 'bg-amber-500' },
];

const ACTIVITY_META: Record<QuoteActivityType, { label: string; badge: string }> = {
  sent: { label: 'sent', badge: 'bg-blue-50 text-blue-700' },
  accepted: { label: 'accepted', badge: 'bg-green-50 text-green-700' },
  declined: { label: 'declined', badge: 'bg-red-50 text-red-700' },
  converted_to_invoice: { label: 'converted to invoice', badge: 'bg-purple-50 text-purple-700' },
  reverted_to_quote: { label: 'reverted to quote', badge: 'bg-purple-50 text-purple-700' },
};

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('all');
  const [data, setData] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    const since = periodSince(period);
    setData(null);
    api
      .get<DashboardOverview>(`/dashboard/overview${since ? `?since=${encodeURIComponent(since)}` : ''}`)
      .then(setData)
      .catch(() => setData(null));
  }, [period]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.tenant.name}` : ''}</h1>
          <p className="mt-1 text-slate-500">How your quotes are performing.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded px-3 py-1.5 text-sm ${
                period === p.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <StatTiles data={data} />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <StatusBreakdown data={data} />
              <RecentActivity data={data} onOpen={(id) => router.push(`/dashboard/quotes/${id}`)} />
            </div>
            <TopClients data={data} />
          </div>
        </>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/dashboard/quotes', label: 'Quotes', desc: 'Create and send quotes' },
          { href: '/dashboard/clients', label: 'Clients', desc: 'Manage who you quote' },
          { href: '/dashboard/item-library', label: 'Item Library', desc: 'Reusable priced items' },
          { href: '/dashboard/connectors', label: 'Connectors', desc: 'Sync products from Magento' },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400"
          >
            <p className="font-medium">{card.label}</p>
            <p className="mt-1 text-sm text-slate-500">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTiles({ data }: { data: DashboardOverview }) {
  const tiles = [
    { label: 'Total quotes', value: data.totals.quotes.toLocaleString() },
    { label: 'Sent', value: data.totals.sent.toLocaleString() },
    {
      label: 'Acceptance rate',
      value: data.totals.acceptanceRate === null ? '—' : `${data.totals.acceptanceRate}%`,
      hint: data.totals.acceptanceRate === null ? 'No responses yet' : undefined,
    },
    { label: 'Accepted value', value: `£${Number(data.totals.acceptedValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{t.value}</p>
          {t.hint && <p className="mt-0.5 text-xs text-slate-400">{t.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function StatusBreakdown({ data }: { data: DashboardOverview }) {
  const total = data.totals.quotes || 1;
  const segments = STATUS_META.map((s) => ({ ...s, count: data.totals[s.key] })).filter((s) => s.count > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="mb-4 font-medium text-slate-900">Status breakdown</p>
      {data.totals.quotes === 0 ? (
        <p className="text-sm text-slate-400">No quotes yet.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {segments.map((s, i) => (
              <div
                key={s.key}
                title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
                className={`${s.bar} h-full ${i > 0 ? 'ml-0.5' : ''}`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <span className="text-slate-600">{s.label}</span>
                <span className="font-medium text-slate-900">{s.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RecentActivity({ data, onOpen }: { data: DashboardOverview; onOpen: (quoteId: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="mb-4 font-medium text-slate-900">Recent activity</p>
      {data.recentActivity.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing yet — sent quotes and status changes will show up here.</p>
      ) : (
        <ul className="space-y-1">
          {data.recentActivity.map((a) => {
            const meta = ACTIVITY_META[a.type];
            const number = a.documentType === 'invoice' ? a.invoiceNumber : a.quoteNumber;
            return (
              <li key={a.id}>
                <button
                  onClick={() => onOpen(a.quoteId)}
                  className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${meta.badge}`}>{meta.label}</span>
                    <span className="truncate font-medium text-slate-900">{number}</span>
                    {a.clientName && <span className="shrink-0 truncate text-slate-500">· {a.clientName}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TopClients({ data }: { data: DashboardOverview }) {
  const maxValue = useMemo(() => Math.max(1, ...data.topClients.map((c) => Number(c.totalValue))), [data.topClients]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="mb-4 font-medium text-slate-900">Top clients</p>
      {data.topClients.length === 0 ? (
        <p className="text-sm text-slate-400">No client quotes yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.topClients.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="truncate font-medium text-slate-900">{c.name}</span>
                <span className="shrink-0 text-slate-500">£{Number(c.totalValue).toFixed(2)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${(Number(c.totalValue) / maxValue) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {c.quoteCount} quote{c.quoteCount === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

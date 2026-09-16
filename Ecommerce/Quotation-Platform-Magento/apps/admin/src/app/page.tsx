'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

const STEPS = [
  {
    title: 'Connect your store',
    body: "Link your Magento catalog once — products and prices sync straight into your item library, so nothing needs re-typing.",
  },
  {
    title: 'Build the quote',
    body: 'Add sections and line items, search your catalog as you type, and let subtotals, discounts and VAT calculate themselves.',
  },
  {
    title: 'Send and track',
    body: 'Email a branded quote in one click, watch it move from sent to accepted, then convert it to an invoice the moment they say yes.',
  },
];

const FEATURES = [
  {
    title: 'Store-connected item library',
    body: 'Real-time product sync from your storefront means no manual re-typing of SKUs and prices.',
  },
  {
    title: 'Live totals as you build',
    body: 'Sections, line items, discounts and VAT recalculate automatically — no spreadsheet formulas to maintain.',
  },
  {
    title: 'Reusable templates',
    body: 'Save any quote as a template and start your next one from it instead of rebuilding from scratch.',
  },
  {
    title: 'Branded emails',
    body: 'Your logo, brand color, and message on every quote and invoice you send — not a generic PDF attachment.',
  },
  {
    title: 'Quote to invoice, one click',
    body: 'Convert an accepted quote straight into an invoice with its own number, same line items, no rebuilding.',
  },
  {
    title: 'Client history at a glance',
    body: 'See every quote and invoice you have ever sent a client right where you edit their details.',
  },
];

export default function Home() {
  const { hasToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !hasToken) return;
    router.replace('/dashboard');
  }, [loading, hasToken, router]);

  if (loading || hasToken) {
    return <main className="flex min-h-screen items-center justify-center text-slate-400">Loading…</main>;
  }

  return (
    <main>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Quotation Builder</span>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="rounded px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Professional quotes and invoices, built in minutes — not spreadsheets.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Connect your store, pick items from your own catalog, and send a branded quote your clients can approve
          online. No more copy-pasting prices into a Word doc every time someone asks for a quote.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="rounded border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="mb-1 font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-slate-900">Everything you need to quote faster</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-1.5 font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Ready to send your next quote in minutes?</h2>
        <div className="mt-6">
          <Link
            href="/register"
            className="rounded bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Get Started
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Quotation Builder
      </footer>
    </main>
  );
}

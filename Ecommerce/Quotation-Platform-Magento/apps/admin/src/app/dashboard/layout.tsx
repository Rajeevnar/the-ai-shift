'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/quotes', label: 'Quotes' },
  { href: '/dashboard/quote-templates', label: 'Templates' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/item-library', label: 'Item Library' },
  { href: '/dashboard/connectors', label: 'Connectors' },
  { href: '/dashboard/team', label: 'Team' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, hasToken, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !hasToken) router.replace('/login');
  }, [loading, hasToken, router]);

  // Gates on hasToken (a synchronous localStorage check) rather than on
  // `user` (populated by an /auth/me network call) — otherwise every page
  // load/navigation showed a "Loading…" screen for that round trip even
  // though the token was already there. `user` fills in a moment later;
  // the sidebar below tolerates it being briefly null.
  if (loading || !hasToken) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <Link href="/dashboard" className="block border-b border-slate-200 px-4 py-4 hover:bg-slate-50">
          <p className="font-semibold">Quotation Builder</p>
          <p className="text-xs text-slate-500">{user?.tenant.name ?? ' '}</p>
        </Link>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            // Exact match for "/dashboard" itself — startsWith would keep
            // it highlighted on every nested page too (they all start with
            // "/dashboard"), which defeats the point of a "which page am I
            // on" indicator.
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-2 text-sm ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {item.label}
              </Link>
            );
          })}
          {user?.isPlatformAdmin && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <Link
                href="/dashboard/platform-admin"
                className={`rounded px-3 py-2 text-sm ${
                  pathname.startsWith('/dashboard/platform-admin')
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Platform Admin
              </Link>
            </>
          )}
        </nav>
        <button onClick={logout} className="mx-2 mt-4 rounded px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
          Log out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

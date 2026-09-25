import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ClipboardList,
  Contact,
  LayoutDashboard,
  Map,
  Package,
  Settings,
  UtensilsCrossed,
  Users,
  Command as CommandIcon,
  X,
} from "lucide-react";
import { useStore, formatDate } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "1" },
  { to: "/", label: "Daily Dispatch", icon: ClipboardList, key: "2" },
  { to: "/planner", label: "Route Planner", icon: Map, key: "3" },
  { to: "/orders", label: "Orders", icon: Package, key: "4" },
  { to: "/menu", label: "Menu Management", icon: UtensilsCrossed, key: "5" },
  { to: "/subscriptions", label: "Subscriptions", icon: Users, key: "6" },
  { to: "/customers", label: "Customers", icon: Contact, key: "7" },
  { to: "/notifications", label: "Notifications", icon: Bell, key: "8" },
  { to: "/activity", label: "System Activity", icon: Activity, key: "9" },
  { to: "/settings", label: "Settings", icon: Settings, key: "0" },
] as const;

function Toast() {
  const { state, actions } = useStore();
  const t = state.toast;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => actions.dismissToast(), 7000);
    return () => clearTimeout(id);
  }, [t, actions]);
  if (!t) return null;
  return (
    <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
        <span className="text-[13px]">{t.text}</span>
        {t.undo ? (
          <button
            type="button"
            onClick={t.undo}
            className="text-[13px] font-medium text-[var(--brand)] underline underline-offset-2"
          >
            Undo
          </button>
        ) : null}
        <button type="button" onClick={actions.dismissToast} aria-label="Dismiss">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { state, actions } = useStore();
  const [q, setQ] = useState("");
  if (!open) return null;
  const cmds = [
    ...NAV.map((n) => ({ label: `Go to ${n.label}`, run: () => navigate({ to: n.to }) })),
    { label: "Sync today's orders", run: () => actions.syncOrders(state.today) },
    { label: "Generate routes", run: () => actions.generateRoutes(state.today) },
    { label: "Fetch routes", run: () => actions.fetchRoutes() },
    { label: "Advance delivery statuses", run: () => actions.advanceStatuses(state.today) },
  ].filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command…"
          className="w-full border-b border-border bg-transparent px-3 py-2.5 text-[13px] outline-none"
        />
        <div className="max-h-72 overflow-auto py-1">
          {cmds.map((c) => (
            <button
              key={c.label}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-accent"
              onClick={() => {
                c.run();
                onClose();
              }}
            >
              {c.label}
            </button>
          ))}
          {cmds.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No commands</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.key === "Escape") setPalette(false);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const hit = NAV.find((n) => n.key === e.key);
      if (hit) navigate({ to: hit.to });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-background pb-7">
      <aside className="sticky top-0 flex h-[calc(100vh-1.75rem)] w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-brand text-[13px] font-bold text-brand-foreground">
            D
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">GetDishPack</div>
            <div className="text-[11px] text-muted-foreground">Ops console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="flex-1">{n.label}</span>
                <kbd className="rounded border border-border px-1 text-[10px] text-muted-foreground">
                  {n.key}
                </kbd>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="m-2 flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-accent"
        >
          <CommandIcon className="h-3.5 w-3.5" /> Command palette
          <kbd className="ml-auto rounded border border-border px-1 text-[10px]">⌘K</kbd>
        </button>
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground">
          Priya Raval · Admin
          <br />
          {formatDate(state.today)} · America/Vancouver
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-7 items-center justify-center gap-1 border-t border-border bg-sidebar text-[11px] text-muted-foreground">
        Built by
        <a
          href="https://www.rvsmedia.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          RVS Media
        </a>
        <span aria-hidden>·</span>
        <a
          href="https://www.rvsmedia.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          www.rvsmedia.co.uk
        </a>
      </footer>
      <Toast />
      <Palette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-5 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold">{title}</h1>
        {subtitle ? (
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}

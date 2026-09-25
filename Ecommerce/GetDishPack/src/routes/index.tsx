import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCw,
  Search,
  Truck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Btn, Empty, Field, StatusPill, Tile } from "@/components/ui-bits";
import { useLookup, useStore, formatDate, DRIVERS } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daily Dispatch — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Operations dashboard for GetDishPack meal delivery in Vancouver: sync orders, build routes, and track ~700 deliveries a day.",
      },
      { property: "og:title", content: "Daily Dispatch — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Sync orders, build driver routes and track every delivery between 02:00 and 10:00.",
      },
    ],
  }),
  component: DailyOrders,
});

const STATUSES: OrderStatus[] = ["pending", "scheduled", "on_route", "delivered", "failed"];

function timeOf(iso?: string) {
  return iso ? iso.slice(11, 16) : "—";
}

function DailyOrders() {
  const { state, actions } = useStore();
  const look = useLookup();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [driver, setDriver] = useState("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(120);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const today = state.today;
  const dayOrders = useMemo(() => state.orders.filter((o) => o.date === today), [state.orders, today]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: dayOrders.length };
    STATUSES.forEach((s) => (c[s] = 0));
    dayOrders.forEach((o) => (c[o.status] = (c[o.status] ?? 0) + 1));
    return c;
  }, [dayOrders]);

  const unassigned = useMemo(
    () => dayOrders.filter((o) => o.stopNumber == null && o.status !== "pending"),
    [dayOrders],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dayOrders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (driver !== "all" && o.routeId !== driver) return false;
      if (onlyUnassigned && o.stopNumber != null) return false;
      if (!needle) return true;
      const cust = look.custOfSub(o.subscriptionId);
      return (
        o.id.includes(needle) ||
        o.addressSnapshot.toLowerCase().includes(needle) ||
        (cust?.name.toLowerCase().includes(needle) ?? false) ||
        (cust?.phone.includes(needle) ?? false)
      );
    });
  }, [dayOrders, statusFilter, driver, q, onlyUnassigned, look]);

  const visible = rows.slice(0, limit);
  const allSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const clearSel = () => setSelected(new Set());
  const ids = [...selected];

  return (
    <div className="pb-24">
      <PageHeader
        title="Daily Dispatch"
        subtitle={`${formatDate(today)} · ${dayOrders.length} orders · delivery window 02:00–10:00`}
        right={
          <>
            <Btn onClick={() => actions.syncOrders(today)}>
              <RefreshCw className="h-3.5 w-3.5" /> Sync orders
            </Btn>
            <Btn variant="primary" onClick={() => actions.generateRoutes(today)}>
              <Zap className="h-3.5 w-3.5" /> Generate routes
            </Btn>
            <Btn onClick={() => actions.fetchRoutes()} title="Re-pull route assignments (never re-deducts)">
              <RotateCw className="h-3.5 w-3.5" /> Fetch routes
            </Btn>
            <Btn onClick={() => actions.advanceStatuses(today)}>
              <Truck className="h-3.5 w-3.5" /> Advance statuses
            </Btn>
          </>
        }
      />

      <div className="space-y-3 px-5 py-4">
        {state.lastFetchedRoutes ? (
          <div className="text-[11px] text-muted-foreground">
            Routes last fetched {new Date(state.lastFetchedRoutes).toLocaleTimeString("en-CA")} — meal balances
            unchanged (deduction happens once, at first stop assignment).
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Tile label="Total" value={counts["all"]} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          <Tile label="Delivered" value={counts["delivered"]} tone="delivered" active={statusFilter === "delivered"} onClick={() => setStatusFilter("delivered")} />
          <Tile label="On route" value={counts["on_route"]} tone="progress" active={statusFilter === "on_route"} onClick={() => setStatusFilter("on_route")} />
          <Tile label="Scheduled" value={counts["scheduled"]} tone="attention" active={statusFilter === "scheduled"} onClick={() => setStatusFilter("scheduled")} />
          <Tile label="Pending" value={counts["pending"]} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
          <Tile label="Failed" value={counts["failed"]} tone="failed" active={statusFilter === "failed"} onClick={() => setStatusFilter("failed")} />
        </div>

        {unassigned.length > 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-[color-mix(in_oklch,var(--status-failed)_35%,white)] bg-[color-mix(in_oklch,var(--status-failed)_7%,white)] px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-[var(--status-failed)]" />
            <div className="text-[13px]">
              <span className="font-semibold text-[var(--status-failed)]">
                {unassigned.length} order{unassigned.length > 1 ? "s" : ""} generated but never assigned to a route
              </span>{" "}
              — no stop number, no meal deducted. These will not be delivered today.
            </div>
            <Btn className="ml-auto" onClick={() => { setOnlyUnassigned(true); setStatusFilter("all"); }}>
              Show them
            </Btn>
            {onlyUnassigned ? <Btn variant="ghost" onClick={() => setOnlyUnassigned(false)}>Clear</Btn> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, address, phone, order id"
              className="w-64 bg-transparent text-[13px] outline-none"
            />
          </label>
          <Field
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
          />
          <Field
            label="Driver"
            value={driver}
            onChange={setDriver}
            options={[
              { value: "all", label: "All" },
              ...state.routes.map((r) => ({ value: r.id, label: r.driverName })),
            ]}
          />
          <span className="text-[12px] text-muted-foreground">
            {rows.length} matching · showing {visible.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-14 z-10 bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(visible.map((o) => o.id)))
                    }
                    aria-label="Select all visible"
                  />
                </th>
                <th className="w-6" />
                <th className="px-2 py-2 text-left font-medium">Stop</th>
                <th className="px-2 py-2 text-left font-medium">Customer</th>
                <th className="px-2 py-2 text-left font-medium">Address</th>
                <th className="px-2 py-2 text-left font-medium">Meal</th>
                <th className="px-2 py-2 text-left font-medium">Driver</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Meals left</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  expanded={expanded === o.id}
                  onExpand={() => setExpanded(expanded === o.id ? null : o.id)}
                  selected={selected.has(o.id)}
                  onToggle={() => toggle(o.id)}
                />
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty title="No orders match these filters" hint="Try clearing the search or status filter." /> : null}
          {rows.length > visible.length ? (
            <div className="border-t border-border p-2 text-center">
              <Btn onClick={() => setLimit((l) => l + 200)}>Load 200 more</Btn>
            </div>
          ) : null}
        </div>
      </div>

      {ids.length > 0 ? (
        <div className="fixed bottom-10 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
            <span className="text-[13px] font-medium">{ids.length} selected</span>
            <Btn size="xs" onClick={() => { actions.setStatus(ids, "on_route"); clearSel(); }}>Mark on route</Btn>
            <Btn size="xs" onClick={() => { actions.setStatus(ids, "delivered"); clearSel(); }}>Mark delivered</Btn>
            <Btn size="xs" variant="danger" onClick={() => { actions.setStatus(ids, "failed"); clearSel(); }}>Mark failed</Btn>
            <select
              className="h-7 rounded-md border border-border bg-card px-1 text-[12px]"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                actions.reassignDriver(ids, e.target.value);
                clearSel();
              }}
            >
              <option value="">Reassign driver…</option>
              {state.routes.map((r) => (
                <option key={r.id} value={r.id}>{r.driverName}</option>
              ))}
            </select>
            <Btn size="xs" variant="ghost" onClick={clearSel}>Clear</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderRow({
  order,
  expanded,
  onExpand,
  selected,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onExpand: () => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const { state, actions } = useStore();
  const look = useLookup();
  const cust = look.custOfSub(order.subscriptionId);
  const sub = look.sub(order.subscriptionId);
  const route = look.route(order.routeId);
  const entries = state.ledger.filter((l) => l.orderId === order.id);
  const unassignedRow = order.stopNumber == null && order.status !== "pending";

  return (
    <>
      <tr
        className={cn(
          "row-32 border-b border-border/70 hover:bg-accent/50",
          selected && "bg-accent/60",
          unassignedRow && "bg-[color-mix(in_oklch,var(--status-failed)_5%,white)]",
        )}
      >
        <td className="px-2">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${order.id}`} />
        </td>
        <td>
          <button type="button" onClick={onExpand} aria-label="Expand" className="p-1 text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="tnum px-2 whitespace-nowrap">
          {order.stopNumber ?? (
            <span className="rounded border border-[color-mix(in_oklch,var(--status-failed)_35%,white)] px-1 text-[11px] font-medium text-[var(--status-failed)]">
              unassigned
            </span>
          )}
        </td>
        <td className="max-w-[180px] truncate px-2">{cust?.name}</td>
        <td className="max-w-[280px] truncate px-2 text-muted-foreground">{order.addressSnapshot}</td>
        <td className="max-w-[160px] truncate px-2">{order.mealSelection}</td>
        <td className="px-2 whitespace-nowrap text-muted-foreground">{route?.driverName ?? "—"}</td>
        <td className="px-2"><StatusPill status={order.status} /></td>
        <td className="tnum px-2">
          <span className={cn(sub && sub.mealsRemaining <= 3 && "font-semibold text-[var(--status-attention)]")}>
            {sub?.mealsRemaining}
          </span>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border bg-surface-raised">
          <td colSpan={9} className="px-10 py-3">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Delivery</div>
                <div>{cust?.phone} · {cust?.email}</div>
                <div className="text-muted-foreground">
                  {cust?.locationType}{cust?.buzzCode ? ` · buzz ${cust.buzzCode}` : ""}
                </div>
                {cust?.instructions ? <div className="text-muted-foreground">“{cust.instructions}”</div> : null}
                {order.packingNote ? (
                  <div className="inline-block rounded border border-border bg-card px-1.5 py-0.5 text-[12px]">
                    Packing note: {order.packingNote}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Proof of delivery</div>
                {order.pod ? (
                  <>
                    <div>{timeOf(order.pod.timestamp)} · {order.pod.signature ? "signature captured" : "no signature"}</div>
                    <div className="text-muted-foreground">Driver note: {order.pod.driverNote}</div>
                    <div className="mt-1 h-16 w-24 rounded border border-border bg-muted text-center text-[10px] leading-[64px] text-muted-foreground">
                      photo
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Not delivered yet — no POD.</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Meal ledger</div>
                {entries.length === 0 ? (
                  <div className="text-muted-foreground">No ledger entry — meal not deducted for this order.</div>
                ) : (
                  entries.map((l) => (
                    <div key={l.id} className="tnum">
                      {l.amount > 0 ? "+" : ""}{l.amount} · {l.reason.replace(/_/g, " ")} · {timeOf(l.timestamp)} · {l.actor}
                    </div>
                  ))
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    to="/subscriptions/$subId"
                    params={{ subId: order.subscriptionId }}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2 text-[12px] hover:bg-accent"
                  >
                    Open subscription
                  </Link>
                  {order.stopNumber != null ? (
                    <Btn size="xs" onClick={() => actions.unassign(order.id)}>Unassign stop (+1 credit)</Btn>
                  ) : null}
                  {order.status === "failed" ? (
                    <>
                      <Btn size="xs" onClick={() => actions.creditFailed(order.id)}>Credit meal back</Btn>
                      <Btn size="xs" onClick={() => actions.retryDelivery(order.id)}>Re-attempt</Btn>
                    </>
                  ) : null}
                </div>
                {order.status === "failed" ? (
                  <div className="pt-1 text-[12px] text-muted-foreground">
                    Failed deliveries never auto-credit — an admin must issue the credit explicitly.
                  </div>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

void DRIVERS;

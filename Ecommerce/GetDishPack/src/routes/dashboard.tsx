import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, SectionTitle, StatusPill } from "@/components/ui-bits";
import { addDays, formatDate, useLookup, useStore } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Morning overview for GetDishPack: delivery progress, unassigned stops, low meal balances and sync health.",
      },
      { property: "og:title", content: "Dashboard — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "One screen showing today's delivery progress, blockers and plans running out.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStore();
  const look = useLookup();
  const today = state.today;

  const dayOrders = useMemo(() => state.orders.filter((o) => o.date === today), [state.orders, today]);
  const by = (s: string) => dayOrders.filter((o) => o.status === s).length;
  const unassigned = dayOrders.filter((o) => o.stopNumber == null && o.status !== "pending");
  const delivered = by("delivered");
  const pct = dayOrders.length ? Math.round((delivered / dayOrders.length) * 100) : 0;

  const soon = addDays(today, 7);
  const lowBalance = useMemo(
    () =>
      state.subscriptions
        .filter((s) => s.status === "active" && s.mealsRemaining <= 3)
        .sort((a, b) => a.mealsRemaining - b.mealsRemaining)
        .slice(0, 8),
    [state.subscriptions],
  );
  const expiring = state.subscriptions.filter(
    (s) => s.status === "active" && s.endDate >= today && s.endDate <= soon,
  ).length;

  const failed = dayOrders.filter((o) => o.status === "failed").slice(0, 6);
  const syncRuns = state.jobRuns.filter((j) => j.jobName === "delivery-status-sync");
  const failures = state.jobRuns.filter((j) => j.outcome !== "success").length;

  const stats = [
    { label: "Stops today", value: dayOrders.length },
    { label: "Delivered", value: delivered, tone: "var(--status-delivered)" },
    { label: "On route", value: by("on_route"), tone: "var(--status-progress)" },
    { label: "Scheduled", value: by("scheduled"), tone: "var(--status-attention)" },
    { label: "Failed", value: by("failed"), tone: "var(--status-failed)" },
    { label: "Unassigned", value: unassigned.length, tone: "var(--status-failed)" },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Dashboard"
        subtitle={`${formatDate(today)} · delivery window 02:00–10:00 · America/Vancouver`}
      />

      <div className="space-y-4 px-5 py-4">
        {unassigned.length > 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-[color-mix(in_oklch,var(--status-failed)_35%,white)] bg-[color-mix(in_oklch,var(--status-failed)_7%,white)] px-3 py-2 text-[13px]">
            <AlertTriangle className="h-4 w-4 text-[var(--status-failed)]" />
            <span>
              <span className="font-semibold text-[var(--status-failed)]">
                {unassigned.length} order{unassigned.length > 1 ? "s" : ""} unassigned
              </span>{" "}
              — {unassigned.slice(0, 3).map((o) => look.custOfSub(o.subscriptionId)?.name ?? o.id).join(", ")}
              {unassigned.length > 3 ? ` +${unassigned.length - 3} more` : ""}
            </span>
            <Link to="/planner" className="ml-auto underline underline-offset-2">
              Open Route Planner
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md border border-border bg-card p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div
                className="mt-1 text-2xl font-semibold tabular-nums"
                style={s.tone ? { color: s.tone } : undefined}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Delivery progress</span>
            <span className="tabular-nums text-muted-foreground">
              {delivered} / {dayOrders.length} · {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-[var(--status-delivered)]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-md border border-border bg-card">
            <SectionTitle right={<Link to="/subscriptions" className="text-[12px] underline underline-offset-2">All</Link>}>
              Low meal balances (≤3)
            </SectionTitle>
            <ul className="text-[13px]">
              {lowBalance.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-t border-border px-3 py-1.5">
                  <Link to="/subscriptions/$subId" params={{ subId: s.id }} className="underline-offset-2 hover:underline">
                    {look.cust(s.customerId)?.name ?? s.id}
                  </Link>
                  <span className="tabular-nums font-semibold text-[var(--status-attention)]">{s.mealsRemaining}</span>
                </li>
              ))}
            </ul>
            {lowBalance.length === 0 ? <Empty title="No low balances" hint="Every active plan has more than 3 meals." /> : null}
          </div>

          <div className="rounded-md border border-border bg-card">
            <SectionTitle>Failed deliveries today</SectionTitle>
            <ul className="text-[13px]">
              {failed.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
                  <span className="truncate">{look.custOfSub(o.subscriptionId)?.name ?? o.id}</span>
                  <StatusPill status={o.status} />
                </li>
              ))}
            </ul>
            {failed.length === 0 ? <Empty title="No failed stops" hint="Every attempt landed so far." /> : null}
          </div>

          <div className="rounded-md border border-border bg-card">
            <SectionTitle right={<Link to="/activity" className="text-[12px] underline underline-offset-2">Details</Link>}>
              System health
            </SectionTitle>
            <div className="space-y-0 text-[13px]">
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <span>Status-sync runs</span>
                <span className="tabular-nums text-muted-foreground">{syncRuns.length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <span>Job runs with failures</span>
                <span className={`tabular-nums ${failures ? "font-semibold text-[var(--status-failed)]" : "text-muted-foreground"}`}>
                  {failures}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <span>Plans expiring in 7 days</span>
                <span className="tabular-nums text-muted-foreground">{expiring}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <span>Notifications sent</span>
                <span className="tabular-nums text-muted-foreground">
                  {state.notifications.filter((n) => n.status === "sent").length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

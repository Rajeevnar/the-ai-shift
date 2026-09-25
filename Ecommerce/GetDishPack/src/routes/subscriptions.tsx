import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, Field, SubBadge } from "@/components/ui-bits";
import { addDays, formatDate, useLookup, useStore } from "@/lib/store";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Triage meal-plan subscriptions: low balances, expiring plans, paused customers and next delivery dates.",
      },
      { property: "og:title", content: "Subscriptions — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Sorted by meals remaining so plans running out surface first.",
      },
    ],
  }),
  component: SubscriptionsList,
});

function SubscriptionsList() {
  const { state } = useStore();
  const look = useLookup();
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [flag, setFlag] = useState("all");
  const [q, setQ] = useState("");

  const soon = addDays(state.today, 7);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.subscriptions
      .filter((s) => {
        if (status !== "all" && s.status !== status) return false;
        if (plan !== "all" && String(s.mealsPurchased) !== plan) return false;
        if (flag === "low" && s.mealsRemaining > 3) return false;
        if (flag === "expiring" && !(s.endDate <= soon && s.endDate >= state.today)) return false;
        if (!needle) return true;
        const c = look.cust(s.customerId);
        return (c?.name.toLowerCase().includes(needle) ?? false) || (c?.phone.includes(needle) ?? false);
      })
      .sort((a, b) => a.mealsRemaining - b.mealsRemaining);
  }, [state.subscriptions, status, plan, flag, q, soon, state.today, look]);

  const nextDelivery = (days: number[]) => {
    for (let i = 0; i < 8; i++) {
      const d = addDays(state.today, i);
      if (days.includes(new Date(`${d}T12:00:00`).getUTCDay())) return d;
    }
    return "—";
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Subscriptions"
        subtitle={`${rows.length} of ${state.subscriptions.length} · sorted by meals remaining (triage first)`}
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer or phone"
              className="w-56 bg-transparent text-[13px] outline-none"
            />
          </label>
          <Field
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "expired", label: "Expired" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <Field
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "all", label: "All" },
              { value: "25", label: "25 meals" },
              { value: "41", label: "41 meals" },
            ]}
          />
          <Field
            label="Flag"
            value={flag}
            onChange={setFlag}
            options={[
              { value: "all", label: "None" },
              { value: "low", label: "Low balance (≤3)" },
              { value: "expiring", label: "Expiring in 7 days" },
            ]}
          />
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-14 z-10 bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-medium">Customer</th>
                <th className="px-2 py-2 text-left font-medium">Plan</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Meals left</th>
                <th className="px-2 py-2 text-left font-medium">Start</th>
                <th className="px-2 py-2 text-left font-medium">End</th>
                <th className="px-2 py-2 text-left font-medium">Next delivery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const c = look.cust(s.customerId);
                const low = s.mealsRemaining <= 3;
                return (
                  <tr
                    key={s.id}
                    className={`h-8 border-b border-border last:border-0 hover:bg-accent ${
                      low ? "bg-[color-mix(in_oklch,var(--status-attention)_10%,white)]" : ""
                    }`}
                  >
                    <td className="px-2">
                      <Link
                        to="/subscriptions/$subId"
                        params={{ subId: s.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c?.name ?? s.customerId}
                      </Link>
                    </td>
                    <td className="px-2 tabular-nums text-muted-foreground">{s.mealsPurchased} meals</td>
                    <td className="px-2">
                      <SubBadge status={s.status} />
                    </td>
                    <td className={`px-2 tabular-nums ${low ? "font-semibold text-[var(--status-attention)]" : ""}`}>
                      {s.mealsRemaining}
                    </td>
                    <td className="px-2 tabular-nums text-muted-foreground">{formatDate(s.startDate)}</td>
                    <td className="px-2 tabular-nums text-muted-foreground">{formatDate(s.endDate)}</td>
                    <td className="px-2 tabular-nums text-muted-foreground">
                      {s.status === "active" ? formatDate(nextDelivery(s.deliveryDays)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty title="No subscriptions match" hint="Try clearing the filters." /> : null}
        </div>
      </div>
    </div>
  );
}

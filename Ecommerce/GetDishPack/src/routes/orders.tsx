import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Btn, Empty, Field, StatusPill } from "@/components/ui-bits";
import { formatDate, useLookup, useStore } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Search every GetDishPack order across dates, drivers and statuses — the full history behind today's dispatch.",
      },
      { property: "og:title", content: "Orders — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "All-time order history with status, driver, meal selection and stop number.",
      },
    ],
  }),
  component: OrdersPage,
});

const STATUSES: OrderStatus[] = ["pending", "scheduled", "on_route", "delivered", "failed"];

function OrdersPage() {
  const { state } = useStore();
  const look = useLookup();
  const [status, setStatus] = useState("all");
  const [driver, setDriver] = useState("all");
  const [date, setDate] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(150);

  const dates = useMemo(
    () => [...new Set(state.orders.map((o) => o.date))].sort((a, b) => b.localeCompare(a)),
    [state.orders],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.orders
      .filter((o) => {
        if (status !== "all" && o.status !== status) return false;
        if (driver !== "all" && o.routeId !== driver) return false;
        if (date !== "all" && o.date !== date) return false;
        if (!needle) return true;
        const c = look.custOfSub(o.subscriptionId);
        return (
          o.id.includes(needle) ||
          o.addressSnapshot.toLowerCase().includes(needle) ||
          (c?.name.toLowerCase().includes(needle) ?? false) ||
          (c?.phone.includes(needle) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (a.stopNumber ?? 0) - (b.stopNumber ?? 0));
  }, [state.orders, status, driver, date, q, look]);

  const visible = rows.slice(0, limit);

  return (
    <div className="pb-16">
      <PageHeader
        title="Orders"
        subtitle={`${state.orders.length} orders across ${dates.length} business dates · America/Vancouver`}
      />
      <div className="space-y-3 px-5 py-4">
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
            label="Date"
            value={date}
            onChange={setDate}
            options={[{ value: "all", label: "All dates" }, ...dates.map((d) => ({ value: d, label: formatDate(d) }))]}
          />
          <Field
            label="Status"
            value={status}
            onChange={setStatus}
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
                <th className="px-2 py-2 text-left font-medium">Date</th>
                <th className="px-2 py-2 text-left font-medium">Stop</th>
                <th className="px-2 py-2 text-left font-medium">Customer</th>
                <th className="px-2 py-2 text-left font-medium">Address</th>
                <th className="px-2 py-2 text-left font-medium">Meal</th>
                <th className="px-2 py-2 text-left font-medium">Driver</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const c = look.custOfSub(o.subscriptionId);
                return (
                  <tr key={o.id} className="h-8 border-b border-border last:border-0 hover:bg-accent">
                    <td className="px-2 tabular-nums text-muted-foreground">{formatDate(o.date)}</td>
                    <td className="px-2 tabular-nums">{o.stopNumber ?? "—"}</td>
                    <td className="px-2">
                      <Link
                        to="/subscriptions/$subId"
                        params={{ subId: o.subscriptionId }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c?.name ?? o.subscriptionId}
                      </Link>
                    </td>
                    <td className="max-w-[260px] truncate px-2 text-muted-foreground">{o.addressSnapshot}</td>
                    <td className="px-2">{o.mealSelection}</td>
                    <td className="px-2 text-muted-foreground">{look.route(o.routeId)?.driverName ?? "—"}</td>
                    <td className="px-2">
                      <StatusPill status={o.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty title="No orders match these filters" hint="Try clearing the search or date filter." /> : null}
          {rows.length > visible.length ? (
            <div className="border-t border-border p-2 text-center">
              <Btn onClick={() => setLimit((l) => l + 200)}>Load 200 more</Btn>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, Field } from "@/components/ui-bits";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Customer directory for GetDishPack: contact details, buzz codes, location type and messaging opt-ins.",
      },
      { property: "og:title", content: "Customers — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Search every household, condo and workplace on the Vancouver delivery list.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { state, actions } = useStore();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("all");
  const [limit, setLimit] = useState(100);

  const subByCustomer = useMemo(() => {
    const m = new Map<string, string>();
    state.subscriptions.forEach((s) => {
      if (!m.has(s.customerId)) m.set(s.customerId, s.id);
    });
    return m;
  }, [state.subscriptions]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.customers.filter((c) => {
      if (loc !== "all" && c.locationType !== loc) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.phone.includes(needle) ||
        c.email.toLowerCase().includes(needle) ||
        c.address.toLowerCase().includes(needle)
      );
    });
  }, [state.customers, q, loc]);

  const visible = rows.slice(0, limit);

  return (
    <div className="pb-16">
      <PageHeader title="Customers" subtitle={`${rows.length} of ${state.customers.length} customers`} />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email, address"
              className="w-64 bg-transparent text-[13px] outline-none"
            />
          </label>
          <Field
            label="Location"
            value={loc}
            onChange={setLoc}
            options={[
              { value: "all", label: "All" },
              { value: "house", label: "House" },
              { value: "condo", label: "Condo" },
              { value: "workplace", label: "Workplace" },
            ]}
          />
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="sticky top-14 z-10 bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-medium">Customer</th>
                <th className="px-2 py-2 text-left font-medium">Phone</th>
                <th className="px-2 py-2 text-left font-medium">Address</th>
                <th className="px-2 py-2 text-left font-medium">Type</th>
                <th className="px-2 py-2 text-left font-medium">Buzz</th>
                <th className="px-2 py-2 text-left font-medium">SMS</th>
                <th className="px-2 py-2 text-left font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const subId = subByCustomer.get(c.id);
                return (
                  <tr key={c.id} className="h-8 border-b border-border last:border-0 hover:bg-accent">
                    <td className="px-2 font-medium">
                      {subId ? (
                        <Link to="/subscriptions/$subId" params={{ subId }} className="underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="px-2 tabular-nums text-muted-foreground">{c.phone}</td>
                    <td className="max-w-[300px] truncate px-2 text-muted-foreground">{c.address}</td>
                    <td className="px-2 text-muted-foreground">{c.locationType}</td>
                    <td className="px-2 tabular-nums text-muted-foreground">{c.buzzCode ?? "—"}</td>
                    <td className="px-2">
                      <input type="checkbox" checked={c.smsOptIn} onChange={() => actions.toggleOptIn(c.id, "sms")} aria-label={`SMS opt-in for ${c.name}`} />
                    </td>
                    <td className="px-2">
                      <input type="checkbox" checked={c.emailOptIn} onChange={() => actions.toggleOptIn(c.id, "email")} aria-label={`Email opt-in for ${c.name}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty title="No customers match" hint="Try a different search term." /> : null}
          {rows.length > visible.length ? (
            <div className="border-t border-border p-2 text-center">
              <button
                type="button"
                className="text-[13px] text-muted-foreground underline underline-offset-2"
                onClick={() => setLimit((l) => l + 200)}
              >
                Load 200 more
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, Field, SectionTitle } from "@/components/ui-bits";
import { useLookup, useStore } from "@/lib/store";
import type { NotificationEvent } from "@/lib/types";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Delivery SMS and email log with suppressed duplicates, per-event channel toggles and customer opt-outs.",
      },
      { property: "og:title", content: "Notifications — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "One message per customer per date — duplicates stay visible as suppressed rows.",
      },
    ],
  }),
  component: NotificationsCentre,
});

const EVENTS: NotificationEvent[] = [
  "delivery_scheduled",
  "delivery_completed",
  "delivery_reminder",
  "low_meal_balance",
  "subscription_expiring",
];

const STATUS_STYLE: Record<string, string> = {
  sent: "text-[var(--status-delivered)]",
  queued: "text-[var(--status-progress)]",
  failed: "text-[var(--status-failed)]",
  suppressed: "text-[var(--status-attention)]",
};

function NotificationsCentre() {
  const { state, actions } = useStore();
  const look = useLookup();
  const [event, setEvent] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...state.notifications]
      .filter((n) => {
        if (event !== "all" && n.eventType !== event) return false;
        if (channel !== "all" && n.channel !== channel) return false;
        if (status !== "all" && n.status !== status) return false;
        if (!needle) return true;
        return look.cust(n.customerId)?.name.toLowerCase().includes(needle) ?? false;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 400);
  }, [state.notifications, event, channel, status, q, look]);

  const optOutCustomers = state.customers.filter((c) => !c.smsOptIn || !c.emailOptIn).slice(0, 12);

  return (
    <div className="pb-16">
      <PageHeader
        title="Notifications"
        subtitle={`${state.notifications.length} messages · ${state.notifications.filter((n) => n.status === "suppressed").length} suppressed duplicates`}
      />

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-md border border-border bg-card">
          <SectionTitle>Channel toggles</SectionTitle>
          <table className="w-full text-[13px]">
            <tbody>
              {EVENTS.map((e) => (
                <tr key={e} className="border-t border-border">
                  <td className="px-3 py-1.5">{e.replace(/_/g, " ")}</td>
                  {(["sms", "email"] as const).map((ch) => (
                    <td key={ch} className="w-24 px-3 py-1.5">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={state.channelToggles[e]?.[ch] ?? false}
                          onChange={() => actions.toggleChannel(e, ch)}
                        />
                        <span className="text-muted-foreground">{ch}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer" className="w-52 bg-transparent text-[13px] outline-none" />
          </label>
          <Field label="Event" value={event} onChange={setEvent} options={[{ value: "all", label: "All" }, ...EVENTS.map((e) => ({ value: e, label: e.replace(/_/g, " ") }))]} />
          <Field label="Channel" value={channel} onChange={setChannel} options={[{ value: "all", label: "All" }, { value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} />
          <Field label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "queued", label: "Queued" }, { value: "failed", label: "Failed" }, { value: "suppressed", label: "Suppressed" }]} />
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-medium">Customer</th>
                <th className="px-2 py-2 text-left font-medium">Event</th>
                <th className="px-2 py-2 text-left font-medium">Channel</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Duplicate of</th>
                <th className="px-2 py-2 text-left font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="h-8 border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-2">{look.cust(n.customerId)?.name ?? n.customerId}</td>
                  <td className="px-2 text-muted-foreground">{n.eventType.replace(/_/g, " ")}</td>
                  <td className="px-2 text-muted-foreground">{n.channel}</td>
                  <td className={`px-2 font-medium ${STATUS_STYLE[n.status] ?? ""}`}>{n.status}</td>
                  <td className="px-2 tabular-nums text-muted-foreground">{n.suppressedBecauseOf ?? "—"}</td>
                  <td className="px-2 tabular-nums text-muted-foreground">{new Date(n.timestamp).toLocaleString("en-CA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty title="No notifications match" hint="Try a different event or status filter." /> : null}
        </div>

        <div className="rounded-md border border-border bg-card">
          <SectionTitle>Per-customer opt-outs</SectionTitle>
          <table className="w-full text-[13px]">
            <tbody>
              {optOutCustomers.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-1.5">{c.name}</td>
                  <td className="w-28 px-3 py-1.5">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={c.smsOptIn} onChange={() => actions.toggleOptIn(c.id, "sms")} />
                      <span className="text-muted-foreground">SMS</span>
                    </label>
                  </td>
                  <td className="w-28 px-3 py-1.5">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={c.emailOptIn} onChange={() => actions.toggleOptIn(c.id, "email")} />
                      <span className="text-muted-foreground">Email</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

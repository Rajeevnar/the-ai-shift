import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell";
import { SectionTitle } from "@/components/ui-bits";
import { ADMIN, DRIVERS, formatDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Operational settings for GetDishPack: delivery window, timezone, drivers, low-balance threshold and messaging channels.",
      },
      { property: "og:title", content: "Settings — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Delivery window, business timezone, driver roster and notification channel defaults.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, actions } = useStore();
  const [windowStart, setWindowStart] = useState("02:00");
  const [windowEnd, setWindowEnd] = useState("10:00");
  const [lowThreshold, setLowThreshold] = useState(3);
  const [syncEvery, setSyncEvery] = useState(20);

  const row = "flex items-center justify-between gap-4 border-t border-border px-3 py-2 text-[13px]";

  return (
    <div className="pb-16">
      <PageHeader title="Settings" subtitle={`Signed in as ${ADMIN} · business date ${formatDate(state.today)}`} />

      <div className="grid grid-cols-1 gap-4 px-5 py-4 xl:grid-cols-2">
        <div className="rounded-md border border-border bg-card">
          <SectionTitle>Operations</SectionTitle>
          <div className={row}>
            <span>Business timezone</span>
            <span className="tabular-nums text-muted-foreground">America/Vancouver</span>
          </div>
          <div className={row}>
            <span>Delivery window</span>
            <span className="flex items-center gap-2">
              <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 tabular-nums" />
              <span className="text-muted-foreground">to</span>
              <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 tabular-nums" />
            </span>
          </div>
          <div className={row}>
            <span>Status sync interval</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={60}
                value={syncEvery}
                onChange={(e) => setSyncEvery(Number(e.target.value))}
                className="h-8 w-20 rounded-md border border-border bg-card px-2 tabular-nums"
              />
              <span className="text-muted-foreground">minutes</span>
            </span>
          </div>
          <div className={row}>
            <span>Low meal-balance threshold</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Number(e.target.value))}
                className="h-8 w-20 rounded-md border border-border bg-card px-2 tabular-nums"
              />
              <span className="text-muted-foreground">meals — alerts fire once per crossing</span>
            </span>
          </div>
          <div className={row}>
            <span>Saturday deliveries</span>
            <span className="text-muted-foreground">Off by default — set per subscription</span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <SectionTitle right={<span className="text-[12px] text-muted-foreground">{DRIVERS.length} drivers</span>}>
            Driver roster
          </SectionTitle>
          {state.routes.map((r) => (
            <div key={r.id} className={row}>
              <span>{r.driverName}</span>
              <span className="tabular-nums text-muted-foreground">{r.stopCount} stops today</span>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-card xl:col-span-2">
          <SectionTitle>Notification channels</SectionTitle>
          {Object.entries(state.channelToggles).map(([event, ch]) => (
            <div key={event} className={row}>
              <span>{event.replace(/_/g, " ")}</span>
              <span className="flex gap-4">
                {(["sms", "email"] as const).map((c) => (
                  <label key={c} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={ch[c]} onChange={() => actions.toggleChannel(event, c)} />
                    <span className="text-muted-foreground">{c}</span>
                  </label>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

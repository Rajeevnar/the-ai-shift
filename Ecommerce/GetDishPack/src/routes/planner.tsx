import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RotateCw, Zap } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Btn, Empty, SectionTitle, StatusPill } from "@/components/ui-bits";
import { useLookup, useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Route Planner — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Group stops by driver, reorder them, and see the schematic Vancouver route map for today's deliveries.",
      },
      { property: "og:title", content: "Route Planner — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Driver route grouping, drag-reorder stops, and a schematic map of today's delivery run.",
      },
    ],
  }),
  component: Planner,
});

const COLORS = ["var(--status-progress)", "var(--brand)", "var(--status-delivered)"];

function Planner() {
  const { state, actions } = useStore();
  const look = useLookup();
  const [drag, setDrag] = useState<{ routeId: string; stop: number } | null>(null);

  const today = state.today;
  const dayOrders = useMemo(() => state.orders.filter((o) => o.date === today), [state.orders, today]);

  const grouped = useMemo(
    () =>
      state.routes.map((r) => ({
        route: r,
        stops: dayOrders
          .filter((o) => o.routeId === r.id && o.stopNumber != null)
          .sort((a, b) => (a.stopNumber ?? 0) - (b.stopNumber ?? 0)),
      })),
    [state.routes, dayOrders],
  );

  const unassigned = useMemo(
    () => dayOrders.filter((o) => o.stopNumber == null && o.status !== "pending"),
    [dayOrders],
  );

  const confirmGenerate = () => {
    const pending = dayOrders.filter((o) => o.status === "pending" && o.stopNumber == null).length;
    if (
      window.confirm(
        `Generate routes for ${dayOrders.length} orders?\n\n${pending} stop assignments will each deduct exactly 1 meal.\nAlready-assigned stops are never deducted twice.`,
      )
    ) {
      actions.generateRoutes(today);
    }
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Route Planner"
        subtitle={`${grouped.reduce((n, g) => n + g.stops.length, 0)} assigned stops across ${state.routes.length} drivers`}
        right={
          <>
            <Btn variant="primary" onClick={confirmGenerate}>
              <Zap className="h-3.5 w-3.5" /> Generate routes
            </Btn>
            <Btn onClick={() => actions.fetchRoutes()} title="Never re-deducts (R1)">
              <RotateCw className="h-3.5 w-3.5" /> Fetch routes
            </Btn>
          </>
        }
      />

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-md border border-[color-mix(in_oklch,var(--status-failed)_35%,white)] bg-[color-mix(in_oklch,var(--status-failed)_7%,white)] p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--status-failed)]" />
            <span className="text-[13px] font-semibold text-[var(--status-failed)]">
              Unassigned orders ({unassigned.length})
            </span>
            <span className="text-[12px] text-muted-foreground">
              generated, no stop number, no meal deducted — they will not be delivered today
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {unassigned.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">Everything is on a route.</div>
            ) : (
              unassigned.map((o) => (
                <div key={o.id} className="flex items-center gap-3 text-[13px]">
                  <span className="font-medium">{look.custOfSub(o.subscriptionId)?.name ?? "—"}</span>
                  <span className="text-muted-foreground">{o.addressSnapshot}</span>
                  <StatusPill status={o.status} className="ml-auto" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {state.lastFetchedRoutes
            ? `Routes last fetched ${new Date(state.lastFetchedRoutes).toLocaleTimeString("en-CA")} — balances unchanged.`
            : "Routes not fetched yet."}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_520px]">
          <div className="space-y-4">
            {grouped.map((g, gi) => (
              <div key={g.route.id} className="overflow-hidden rounded-md border border-border bg-card">
                <SectionTitle
                  right={<span className="text-[12px] text-muted-foreground">{g.stops.length} stops</span>}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: COLORS[gi % COLORS.length] }}
                    />
                    {g.route.driverName}
                  </span>
                </SectionTitle>
                {g.stops.length === 0 ? (
                  <Empty title="No stops on this route" hint="Run Generate routes to assign stops." />
                ) : (
                  <ul>
                    {g.stops.map((o) => (
                      <StopRow
                        key={o.id}
                        order={o}
                        name={look.custOfSub(o.subscriptionId)?.name ?? "—"}
                        onDragStart={() => setDrag({ routeId: g.route.id, stop: o.stopNumber! })}
                        onDrop={() => {
                          if (drag && drag.routeId === g.route.id) {
                            actions.reorderStops(g.route.id, drag.stop, o.stopNumber!);
                          }
                          setDrag(null);
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="h-fit rounded-md border border-border bg-card p-3">
            <SchematicMap groups={grouped} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StopRow({
  order,
  name,
  onDragStart,
  onDrop,
}: {
  order: Order;
  name: string;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex h-8 cursor-grab items-center gap-3 border-t border-border px-3 text-[13px] hover:bg-accent"
    >
      <span className="w-8 tabular-nums text-muted-foreground">#{order.stopNumber}</span>
      <span className="w-44 truncate font-medium">{name}</span>
      <span className="flex-1 truncate text-muted-foreground">{order.addressSnapshot}</span>
      <StatusPill status={order.status} />
    </li>
  );
}

function SchematicMap({
  groups,
}: {
  groups: { route: { id: string; driverName: string }; stops: Order[] }[];
}) {
  const { state } = useStore();
  const look = useLookup();
  const pts = groups.map((g, gi) => ({
    color: COLORS[gi % COLORS.length],
    driver: g.route.driverName,
    pins: g.stops.map((o) => {
      const c = look.custOfSub(o.subscriptionId);
      const lat = c?.lat ?? 49.25;
      const lng = c?.lng ?? -123.1;
      return {
        id: o.id,
        n: o.stopNumber ?? 0,
        x: ((lng + 123.25) / 0.55) * 480 + 20,
        y: (1 - (lat - 49.05) / 0.32) * 380 + 20,
      };
    }),
  }));

  const empty = pts.every((p) => p.pins.length === 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold">Schematic route map</span>
        <span className="text-[11px] text-muted-foreground">{state.today} · America/Vancouver</span>
      </div>
      {empty ? (
        <Empty title="No stops to plot" hint="Generate routes to see pins and polylines." />
      ) : (
        <svg viewBox="0 0 520 420" className="w-full rounded-md bg-surface-raised">
          {[...Array(9)].map((_, i) => (
            <line key={`v${i}`} x1={i * 65} y1={0} x2={i * 65} y2={420} stroke="var(--border)" strokeWidth={1} />
          ))}
          {[...Array(7)].map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 70} x2={520} y2={i * 70} stroke="var(--border)" strokeWidth={1} />
          ))}
          {pts.map((p) => (
            <g key={p.driver}>
              <polyline
                points={p.pins.map((pin) => `${pin.x},${pin.y}`).join(" ")}
                fill="none"
                stroke={p.color}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
              {p.pins.map((pin) => (
                <g key={pin.id}>
                  <circle cx={pin.x} cy={pin.y} r={9} fill={p.color} />
                  <text
                    x={pin.x}
                    y={pin.y + 3.5}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#fff"
                    className="tabular-nums"
                  >
                    {pin.n}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        {pts.map((p) => (
          <span key={p.driver} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.driver}
          </span>
        ))}
      </div>
    </div>
  );
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadDbState, saveDbChanges } from "./db.functions";
import {
  ADMIN,
  DRIVERS,
  addDays,
  buildSeed,
  businessToday,
  countDeliveryDays,
  dayOfWeek,
  formatDate,
  ts,
  type SeedData,
} from "./seed";
import type {
  LedgerEntry,
  Notification,
  NotificationEvent,
  Order,
  OrderStatus,
} from "./types";

export interface ChannelToggles {
  [event: string]: { sms: boolean; email: boolean };
}

export interface AppState extends SeedData {
  lastFetchedRoutes: string | null;
  channelToggles: ChannelToggles;
  toast: { id: number; text: string; undo?: () => void } | null;
}

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function initialState(): AppState {
  const today = businessToday();
  return {
    ...buildSeed(today),
    lastFetchedRoutes: null,
    channelToggles: {
      delivery_scheduled: { sms: true, email: true },
      delivery_completed: { sms: true, email: false },
      delivery_reminder: { sms: true, email: false },
      low_meal_balance: { sms: true, email: true },
      subscription_expiring: { sms: false, email: true },
    },
    toast: null,
  };
}

interface Ctx {
  state: AppState;
  set: React.Dispatch<React.SetStateAction<AppState>>;
  actions: ReturnType<typeof makeActions>;
}

// Keep one context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __gdpStoreCtx?: React.Context<Ctx | null> };
const StoreContext = (g.__gdpStoreCtx ??= createContext<Ctx | null>(null));

export function useStore() {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

/** R1: idempotent, single-moment deduction. */
function deduct(s: AppState, order: Order, actor: string): AppState {
  const key = `${order.id}:stop_assignment`;
  if (s.ledger.some((l) => l.idempotencyKey === key)) return s; // already deducted, ever
  const entry: LedgerEntry = {
    id: uid("led"),
    subscriptionId: order.subscriptionId,
    orderId: order.id,
    amount: -1,
    reason: "stop_assignment",
    actor,
    timestamp: nowIso(),
    idempotencyKey: key,
  };
  return {
    ...s,
    ledger: [...s.ledger, entry],
    subscriptions: s.subscriptions.map((sub) =>
      sub.id === order.subscriptionId
        ? { ...sub, mealsRemaining: Math.max(0, sub.mealsRemaining - 1) }
        : sub,
    ),
    activity: [
      ...s.activity,
      {
        id: uid("act"),
        subscriptionId: order.subscriptionId,
        timestamp: entry.timestamp,
        actor,
        kind: "deduction" as const,
        text: `Meal deducted (−1) — stop number first assigned to ${order.id}`,
      },
    ],
  };
}

function queueNotification(
  s: AppState,
  customerId: string,
  date: string,
  eventType: NotificationEvent,
  channel: "sms" | "email",
): AppState {
  const cust = s.customers.find((c) => c.id === customerId);
  const toggles = s.channelToggles[eventType];
  const dup = s.notifications.find(
    (n) =>
      n.customerId === customerId &&
      n.date === date &&
      n.eventType === eventType &&
      n.status !== "suppressed",
  );
  let status: Notification["status"] = "queued";
  let because: string | undefined;
  if (dup) {
    status = "suppressed";
    because = dup.id;
  } else if (toggles && !toggles[channel]) {
    status = "suppressed";
    because = `${eventType} disabled for ${channel}`;
  } else if (cust && ((channel === "sms" && !cust.smsOptIn) || (channel === "email" && !cust.emailOptIn))) {
    status = "suppressed";
    because = `customer opted out of ${channel.toUpperCase()}`;
  } else {
    status = "sent";
  }
  const n: Notification = {
    id: uid("not"),
    customerId,
    date,
    eventType,
    channel,
    status,
    suppressedBecauseOf: because,
    timestamp: nowIso(),
  };
  return { ...s, notifications: [...s.notifications, n] };
}

function makeActions(set: React.Dispatch<React.SetStateAction<AppState>>) {
  const toast = (s: AppState, text: string, undo?: () => void): AppState => ({
    ...s,
    toast: { id: Date.now(), text, undo },
  });

  return {
    dismissToast: () => set((s) => ({ ...s, toast: null })),

    /** Sync: generate today's orders from active subscriptions as pending. */
    syncOrders: (date: string) =>
      set((s) => {
        const dow = dayOfWeek(date);
        const existing = new Set(
          s.orders.filter((o) => o.date === date).map((o) => o.subscriptionId + ":" + o.id),
        );
        const have = new Set(s.orders.filter((o) => o.date === date).map((o) => o.subscriptionId));
        const created: Order[] = [];
        s.subscriptions.forEach((sub, i) => {
          if (sub.status !== "active") return;
          if (!sub.deliveryDays.includes(dow)) return;
          if (have.has(sub.id)) return;
          if (sub.mealsRemaining <= 0) return;
          const skip = s.overrides.some((o) => o.subscriptionId === sub.id && o.date === date && o.skip);
          if (skip) return;
          const cust = s.customers.find((c) => c.id === sub.customerId)!;
          const ovr = s.overrides.find((o) => o.subscriptionId === sub.id && o.date === date);
          created.push({
            id: uid("ord"),
            subscriptionId: sub.id,
            date,
            addressSnapshot: ovr?.addressOverride ?? cust.address,
            mealSelection: ovr?.mealOverride ?? sub.defaultMeal,
            packingNote: i % 5 === 0 ? "extra roti" : undefined,
            status: "pending",
          });
        });
        const jobbed = {
          ...s,
          orders: [...s.orders, ...created],
          jobRuns: [
            ...s.jobRuns,
            {
              id: uid("job"),
              jobName: "order-sync",
              startedAt: nowIso(),
              durationMs: 3200,
              recordsProcessed: created.length,
              notificationsSent: 0,
              failures: 0,
              outcome: "success" as const,
            },
          ],
        };
        void existing;
        return toast(jobbed, `Sync complete — ${created.length} new pending orders for ${formatDate(date)}`);
      }),

    /** Generate routes: assign stop numbers → deduct once per order (R1). */
    generateRoutes: (date: string) =>
      set((s) => {
        let next = { ...s };
        const targets = next.orders.filter(
          (o) => o.date === date && o.status === "pending" && o.stopNumber == null,
        );
        // seeded unassigned orders stay unassigned
        const routeCounts: Record<string, number> = {};
        next.routes.forEach((r) => (routeCounts[r.id] = r.stopCount));
        const updated = new Map<string, Partial<Order>>();
        targets.forEach((o, idx) => {
          const route = next.routes[idx % next.routes.length];
          routeCounts[route.id] = (routeCounts[route.id] ?? 0) + 1;
          updated.set(o.id, {
            routeId: route.id,
            stopNumber: routeCounts[route.id],
            status: "scheduled" as OrderStatus,
          });
          next = deduct(next, o, "route-generator (system)");
          const sub = next.subscriptions.find((x) => x.id === o.subscriptionId)!;
          next = queueNotification(next, sub.customerId, date, "delivery_scheduled", "sms");
        });
        next = {
          ...next,
          orders: next.orders.map((o) => (updated.has(o.id) ? { ...o, ...updated.get(o.id) } : o)),
          routes: next.routes.map((r) => ({ ...r, stopCount: routeCounts[r.id] ?? r.stopCount })),
          lastFetchedRoutes: nowIso(),
        };
        return toast(next, `Routes generated — ${targets.length} stops assigned, ${targets.length} meals deducted`);
      }),

    /** Fetch routes: re-pull assignments. Must NEVER re-deduct (R1 proof). */
    fetchRoutes: () =>
      set((s) => {
        let next: AppState = { ...s, lastFetchedRoutes: nowIso() };
        next.orders
          .filter((o) => o.stopNumber != null)
          .forEach((o) => {
            next = deduct(next, o, "route-fetch (system)"); // idempotent no-op
          });
        return toast(next, "Routes fetched — assignments refreshed, 0 meals deducted (idempotent)");
      }),

    /** Advance a batch of statuses; queue completion notifications. */
    advanceStatuses: (date: string, n = 25) =>
      set((s) => {
        let next = { ...s };
        const candidates = next.orders.filter(
          (o) => o.date === date && (o.status === "scheduled" || o.status === "on_route"),
        ).slice(0, n);
        const map = new Map<string, OrderStatus>();
        candidates.forEach((o) => map.set(o.id, o.status === "scheduled" ? "on_route" : "delivered"));
        next = {
          ...next,
          orders: next.orders.map((o) => {
            const st = map.get(o.id);
            if (!st) return o;
            return st === "delivered"
              ? {
                  ...o,
                  status: st,
                  pod: {
                    signature: `sig_${o.id}`,
                    photo: `photo_${o.id}`,
                    driverNote: "Handed to customer",
                    timestamp: nowIso(),
                  },
                }
              : { ...o, status: st };
          }),
        };
        candidates.forEach((o) => {
          if (map.get(o.id) !== "delivered") return;
          const sub = next.subscriptions.find((x) => x.id === o.subscriptionId)!;
          next = queueNotification(next, sub.customerId, date, "delivery_completed", "sms");
        });
        next = {
          ...next,
          jobRuns: [
            ...next.jobRuns,
            {
              id: uid("job"),
              jobName: "delivery-status-sync",
              startedAt: nowIso(),
              durationMs: 2000,
              recordsProcessed: candidates.length,
              notificationsSent: candidates.length,
              failures: 0,
              outcome: "success" as const,
            },
          ],
        };
        return next;
      }),

    setStatus: (ids: string[], status: OrderStatus) =>
      set((s) => {
        const prev = new Map(s.orders.filter((o) => ids.includes(o.id)).map((o) => [o.id, o.status]));
        const next = {
          ...s,
          orders: s.orders.map((o) =>
            ids.includes(o.id)
              ? {
                  ...o,
                  status,
                  pod:
                    status === "delivered"
                      ? o.pod ?? {
                          signature: `sig_${o.id}`,
                          photo: `photo_${o.id}`,
                          driverNote: `Marked delivered by ${ADMIN}`,
                          timestamp: nowIso(),
                        }
                      : o.pod,
                }
              : o,
          ),
          activity: [
            ...s.activity,
            ...ids.map((id) => {
              const o = s.orders.find((x) => x.id === id)!;
              return {
                id: uid("act"),
                subscriptionId: o.subscriptionId,
                timestamp: nowIso(),
                actor: ADMIN,
                kind: "status" as const,
                text: `Order ${id} ${o.status} → ${status}`,
              };
            }),
          ],
        };
        const undo = () =>
          set((cur) => ({
            ...cur,
            orders: cur.orders.map((o) => (prev.has(o.id) ? { ...o, status: prev.get(o.id)! } : o)),
            toast: null,
          }));
        return toast(next, `${ids.length} order(s) marked ${status.replace("_", " ")}`, undo);
      }),

    reassignDriver: (ids: string[], routeId: string) =>
      set((s) => {
        const prev = new Map(s.orders.filter((o) => ids.includes(o.id)).map((o) => [o.id, o.routeId]));
        let next = { ...s };
        const counts: Record<string, number> = {};
        next.routes.forEach((r) => (counts[r.id] = r.stopCount));
        next = {
          ...next,
          orders: next.orders.map((o) => {
            if (!ids.includes(o.id)) return o;
            counts[routeId] = (counts[routeId] ?? 0) + 1;
            return { ...o, routeId, stopNumber: o.stopNumber ?? counts[routeId] };
          }),
        };
        // reassignment must not deduct again
        ids.forEach((id) => {
          const o = next.orders.find((x) => x.id === id)!;
          next = deduct(next, o, "reassign (admin)");
        });
        const driver = next.routes.find((r) => r.id === routeId)?.driverName ?? routeId;
        const undo = () =>
          set((cur) => ({
            ...cur,
            orders: cur.orders.map((o) => (prev.has(o.id) ? { ...o, routeId: prev.get(o.id) } : o)),
            toast: null,
          }));
        return toast(next, `${ids.length} stop(s) reassigned to ${driver} — 0 meals deducted`, undo);
      }),

    /** R2: unassign writes an append-only credit. */
    unassign: (orderId: string) =>
      set((s) => {
        const o = s.orders.find((x) => x.id === orderId)!;
        const entry: LedgerEntry = {
          id: uid("led"),
          subscriptionId: o.subscriptionId,
          orderId: o.id,
          amount: +1,
          reason: "unassignment_credit",
          actor: ADMIN,
          timestamp: nowIso(),
          idempotencyKey: `${o.id}:unassignment:${Date.now()}`,
        };
        const next: AppState = {
          ...s,
          orders: s.orders.map((x) =>
            x.id === orderId ? { ...x, routeId: undefined, stopNumber: undefined, status: "pending" } : x,
          ),
          ledger: [...s.ledger, entry],
          subscriptions: s.subscriptions.map((sub) =>
            sub.id === o.subscriptionId ? { ...sub, mealsRemaining: sub.mealsRemaining + 1 } : sub,
          ),
          activity: [
            ...s.activity,
            {
              id: uid("act"),
              subscriptionId: o.subscriptionId,
              timestamp: entry.timestamp,
              actor: ADMIN,
              kind: "credit" as const,
              text: `Unassignment credit (+1) — ${o.id} removed from route`,
            },
          ],
        };
        return toast(next, `Stop unassigned — 1 meal credited back`);
      }),

    /** R3: failed delivery never auto-credits; admin does it explicitly. */
    creditFailed: (orderId: string) =>
      set((s) => {
        const o = s.orders.find((x) => x.id === orderId)!;
        const key = `${o.id}:failed_delivery_credit`;
        if (s.ledger.some((l) => l.idempotencyKey === key))
          return toast(s, "Already credited for this failed delivery");
        const entry: LedgerEntry = {
          id: uid("led"),
          subscriptionId: o.subscriptionId,
          orderId: o.id,
          amount: +1,
          reason: "failed_delivery_credit",
          actor: ADMIN,
          timestamp: nowIso(),
          idempotencyKey: key,
        };
        const next: AppState = {
          ...s,
          ledger: [...s.ledger, entry],
          subscriptions: s.subscriptions.map((sub) =>
            sub.id === o.subscriptionId ? { ...sub, mealsRemaining: sub.mealsRemaining + 1 } : sub,
          ),
          activity: [
            ...s.activity,
            {
              id: uid("act"),
              subscriptionId: o.subscriptionId,
              timestamp: entry.timestamp,
              actor: ADMIN,
              kind: "credit" as const,
              text: `Failed-delivery credit (+1) issued by ${ADMIN} for ${o.id}`,
            },
          ],
        };
        return toast(next, `Meal credited back to ${o.subscriptionId} by ${ADMIN}`);
      }),

    retryDelivery: (orderId: string) =>
      set((s) =>
        toast(
          {
            ...s,
            orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: "on_route" } : o)),
          },
          "Re-attempt queued — order back on route",
        ),
      ),

    /** R4: pause extends end date by the customer's own delivery days. */
    pause: (subId: string, start: string, end: string) =>
      set((s) => {
        const sub = s.subscriptions.find((x) => x.id === subId)!;
        const missed = countDeliveryDays(start, end, sub.deliveryDays);
        const newEnd = addDays(sub.endDate, missed);
        const next: AppState = {
          ...s,
          subscriptions: s.subscriptions.map((x) =>
            x.id === subId ? { ...x, status: "paused", endDate: newEnd } : x,
          ),
          pauses: [
            ...s.pauses,
            { id: uid("pause"), subscriptionId: subId, startDate: start, endDate: end, deliveryDaysMissed: missed, extensionApplied: true },
          ],
          activity: [
            ...s.activity,
            {
              id: uid("act"),
              subscriptionId: subId,
              timestamp: nowIso(),
              actor: ADMIN,
              kind: "admin" as const,
              text: `Paused ${formatDate(start)} → ${formatDate(end)} · ${missed} delivery days missed · end date extended to ${formatDate(newEnd)}`,
            },
          ],
        };
        return toast(next, `Paused — end date extended ${missed} delivery days to ${formatDate(newEnd)}`);
      }),

    resume: (subId: string) =>
      set((s) =>
        toast(
          {
            ...s,
            subscriptions: s.subscriptions.map((x) => (x.id === subId ? { ...x, status: "active" } : x)),
            activity: [
              ...s.activity,
              {
                id: uid("act"),
                subscriptionId: subId,
                timestamp: nowIso(),
                actor: ADMIN,
                kind: "admin" as const,
                text: "Subscription resumed",
              },
            ],
          },
          "Subscription resumed",
        ),
      ),

    addOverride: (subId: string, date: string, patch: { addressOverride?: string; mealOverride?: string; skip: boolean }) =>
      set((s) =>
        toast(
          {
            ...s,
            overrides: [...s.overrides, { id: uid("ovr"), subscriptionId: subId, date, ...patch }],
            activity: [
              ...s.activity,
              {
                id: uid("act"),
                subscriptionId: subId,
                timestamp: nowIso(),
                actor: ADMIN,
                kind: "admin" as const,
                text: `Override added for ${formatDate(date)}${patch.skip ? " — skip delivery" : patch.addressOverride ? " — alternate address" : " — alternate meal"}`,
              },
            ],
          },
          "Override saved",
        ),
      ),

    toggleChannel: (event: string, channel: "sms" | "email") =>
      set((s) => ({
        ...s,
        channelToggles: {
          ...s.channelToggles,
          [event]: { ...s.channelToggles[event], [channel]: !s.channelToggles[event][channel] },
        },
      })),

    toggleOptIn: (customerId: string, channel: "sms" | "email") =>
      set((s) => ({
        ...s,
        customers: s.customers.map((c) =>
          c.id === customerId
            ? channel === "sms"
              ? { ...c, smsOptIn: !c.smsOptIn }
              : { ...c, emailOptIn: !c.emailOptIn }
            : c,
        ),
      })),

    reorderStops: (routeId: string, fromStop: number, toStop: number) =>
      set((s) => {
        const stops = s.orders
          .filter((o) => o.routeId === routeId && o.stopNumber != null)
          .sort((a, b) => a.stopNumber! - b.stopNumber!);
        const fromIdx = stops.findIndex((o) => o.stopNumber === fromStop);
        const toIdx = stops.findIndex((o) => o.stopNumber === toStop);
        if (fromIdx < 0 || toIdx < 0) return s;
        const arr = [...stops];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        const numbers = new Map(arr.map((o, i) => [o.id, i + 1]));
        return {
          ...s,
          orders: s.orders.map((o) => (numbers.has(o.id) ? { ...o, stopNumber: numbers.get(o.id)! } : o)),
        };
        // reordering never touches the ledger (R1)
      }),
  };
}

const COLLECTIONS = [
  "customers",
  "plans",
  "subscriptions",
  "orders",
  "routes",
  "ledger",
  "pauses",
  "overrides",
  "notifications",
  "jobRuns",
  "activity",
] as const;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, set] = useState<AppState>(initialState);
  const actions = useMemo(() => makeActions(set), []);
  const value = useMemo(() => ({ state, set, actions }), [state, actions]);
  const saved = useRef<AppState | null>(null);

  // Load live data from Neon once on mount.
  useEffect(() => {
    let cancelled = false;
    loadDbState()
      .then(({ collections, meta }) => {
        if (cancelled || !collections["customers"]?.length) return;
        set((s) => {
          const next = { ...s } as AppState;
          for (const k of COLLECTIONS) (next as any)[k] = collections[k] ?? [];
          if (meta["channelToggles"]) next.channelToggles = meta["channelToggles"] as ChannelToggles;
          next.lastFetchedRoutes = (meta["lastFetchedRoutes"] as string | null) ?? null;
          if (typeof meta["today"] === "string") next.today = meta["today"] as string;
          saved.current = next;
          return next;
        });
      })
      .catch((e) => console.error("Failed to load from database", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist changed rows (by reference) back to Neon, debounced.
  useEffect(() => {
    const prev = saved.current;
    if (!prev || prev === state) return;
    const t = setTimeout(() => {
      const upserts: Record<string, unknown[]> = {};
      for (const k of COLLECTIONS) {
        const before = new Set(prev[k] as unknown[]);
        const changed = (state[k] as unknown[]).filter((r) => !before.has(r));
        if (changed.length) upserts[k] = changed;
      }
      const meta: Record<string, unknown> = {};
      if (prev.channelToggles !== state.channelToggles) meta["channelToggles"] = state.channelToggles;
      if (prev.lastFetchedRoutes !== state.lastFetchedRoutes) meta["lastFetchedRoutes"] = state.lastFetchedRoutes;
      saved.current = state;
      if (!Object.keys(upserts).length && !Object.keys(meta).length) return;
      saveDbChanges({ upserts, meta }).catch((e) =>
        console.error("Failed to save to database", e),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLookup() {
  const { state } = useStore();
  return useMemo(() => {
    const subs = new Map(state.subscriptions.map((s) => [s.id, s]));
    const custs = new Map(state.customers.map((c) => [c.id, c]));
    const routes = new Map(state.routes.map((r) => [r.id, r]));
    return {
      sub: (id: string) => subs.get(id),
      cust: (id: string) => custs.get(id),
      custOfSub: (subId: string) => {
        const s = subs.get(subId);
        return s ? custs.get(s.customerId) : undefined;
      },
      route: (id?: string) => (id ? routes.get(id) : undefined),
    };
  }, [state.subscriptions, state.customers, state.routes]);
}

export { ADMIN, DRIVERS, addDays, formatDate, countDeliveryDays, businessToday, ts, dayOfWeek };

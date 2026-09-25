import type {
  ActivityEntry,
  Customer,
  JobRun,
  LedgerEntry,
  Notification,
  Order,
  Override,
  Pause,
  Plan,
  Route,
  Subscription,
} from "./types";

export const TZ = "America/Vancouver";
export const ADMIN = "Priya Raval (admin)";

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Business date (YYYY-MM-DD) in America/Vancouver. */
export function businessToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

export function formatDate(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ts(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`;
}

export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

const FIRST = [
  // Punjabi
  "Harpreet", "Gurpreet", "Manjit", "Baljinder", "Simran", "Jaskaran", "Navdeep", "Rupinder",
  "Amrit", "Tejinder", "Kulwinder", "Sukhwinder", "Parminder", "Jasleen",
  // Gujarati
  "Hiral", "Jignesh", "Krupa", "Nilesh", "Bhavna", "Rutvik", "Dhara", "Chirag", "Falguni", "Mehul",
  // South Indian
  "Lakshmi", "Venkatesh", "Anitha", "Karthik", "Divya", "Srinivas", "Meenakshi", "Rajesh",
  "Padmini", "Ganesh", "Revathi", "Suresh",
  // Bengali
  "Arnab", "Sudeshna", "Debjani", "Rajarshi", "Moumita", "Subhankar", "Ishita", "Pranab",
];

const LAST = [
  "Sidhu", "Grewal", "Dhillon", "Bains", "Sandhu", "Gill", "Randhawa", "Aulakh",
  "Patel", "Shah", "Desai", "Mehta", "Trivedi", "Joshi", "Bhatt",
  "Iyer", "Nair", "Reddy", "Krishnan", "Subramanian", "Pillai", "Menon", "Rao",
  "Chatterjee", "Banerjee", "Mukherjee", "Ghosh", "Sengupta", "Dasgupta",
];

const CITIES = [
  {
    name: "Vancouver",
    fsa: ["V6B", "V5N", "V6A", "V5T", "V6E"],
    streets: ["Main St", "Commercial Dr", "Cambie St", "Granville St", "Kingsway", "Hastings St", "Broadway", "Fraser St", "Oak St", "Davie St"],
    lat: 49.262, lng: -123.10,
  },
  {
    name: "Burnaby",
    fsa: ["V5H", "V5C", "V3N", "V5G"],
    streets: ["Willingdon Ave", "Kingsway", "Canada Way", "Hastings St", "Rumble St", "Sperling Ave", "Beresford St"],
    lat: 49.248, lng: -122.98,
  },
  {
    name: "Surrey",
    fsa: ["V3T", "V3W", "V3S", "V4N"],
    streets: ["King George Blvd", "Scott Rd", "Fraser Hwy", "104 Ave", "128 St", "72 Ave", "152 St"],
    lat: 49.153, lng: -122.85,
  },
  {
    name: "Richmond",
    fsa: ["V6X", "V7C", "V6Y", "V7A"],
    streets: ["No. 3 Rd", "Westminster Hwy", "Granville Ave", "Steveston Hwy", "Blundell Rd", "Garden City Rd"],
    lat: 49.166, lng: -123.13,
  },
];

const LETTERS = "ABCEGHJKLMNPRSTVWXYZ";

const MEALS = [
  "Veg Thali ×2",
  "Veg Thali ×1",
  "Non-veg Thali",
  "Jain — no onion/garlic",
  "Low spice",
  "Veg Thali ×2 (low spice)",
  "Non-veg Thali ×2",
  "Millet Thali",
];

const NOTES = [
  undefined, undefined, undefined,
  "extra roti",
  "no rice",
  "leave at concierge",
  "extra raita",
  "ring twice",
  "no dessert",
];

const INSTRUCTIONS = [
  undefined,
  "Leave at side door",
  "Do not ring — baby sleeping",
  "Hand to reception",
  "Gate code same as buzz",
];

export const DRIVERS = ["Gurdeep Singh", "Manish Kumar", "Tanvir Sekhon"];

export interface SeedData {
  customers: Customer[];
  plans: Plan[];
  subscriptions: Subscription[];
  orders: Order[];
  routes: Route[];
  ledger: LedgerEntry[];
  pauses: Pause[];
  overrides: Override[];
  notifications: Notification[];
  jobRuns: JobRun[];
  activity: ActivityEntry[];
  today: string;
}

export function buildSeed(today: string): SeedData {
  const rand = mulberry32(20260818);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  const plans: Plan[] = [
    { id: "plan_25", mealCount: 25, price: 312 },
    { id: "plan_41", mealCount: 41, price: 492 },
  ];

  const N = 190;
  const customers: Customer[] = [];
  const subscriptions: Subscription[] = [];

  for (let i = 0; i < N; i++) {
    const city = CITIES[i % CITIES.length];
    const fsa = pick(city.fsa);
    const postal = `${fsa} ${int(1, 9)}${LETTERS[int(0, LETTERS.length - 1)]}${int(1, 9)}`;
    const locationType: Customer["locationType"] =
      rand() < 0.42 ? "condo" : rand() < 0.9 ? "house" : "workplace";
    const unit = locationType === "condo" ? `#${int(2, 28)}0${int(1, 9)}–` : "";
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    const address = `${unit}${int(100, 8999)} ${pick(city.streets)}, ${city.name}, BC ${postal}`;
    customers.push({
      id: `cus_${String(i + 1).padStart(3, "0")}`,
      name,
      phone: `(604) ${int(200, 899)}-${String(int(0, 9999)).padStart(4, "0")}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      address,
      buzzCode: locationType === "condo" ? String(int(1000, 9999)) : undefined,
      locationType,
      instructions: pick(INSTRUCTIONS),
      smsOptIn: rand() > 0.08,
      emailOptIn: rand() > 0.15,
      lat: city.lat + (rand() - 0.5) * 0.09,
      lng: city.lng + (rand() - 0.5) * 0.12,
    });

    const plan = rand() < 0.55 ? plans[0] : plans[1];
    const r = rand();
    const status: Subscription["status"] =
      r < 0.82 ? "active" : r < 0.89 ? "paused" : r < 0.95 ? "expired" : "cancelled";
    const remaining = status === "expired" ? int(0, 4) : int(1, plan.mealCount);
    const start = addDays(today, -int(10, 70));
    const deliveryDays = rand() < 0.7 ? [0, 1, 2, 3, 4, 5] : rand() < 0.5 ? [1, 3, 5] : [0, 2, 4];
    subscriptions.push({
      id: `sub_${String(i + 1).padStart(3, "0")}`,
      customerId: `cus_${String(i + 1).padStart(3, "0")}`,
      planId: plan.id,
      mealsPurchased: plan.mealCount,
      mealsRemaining: remaining,
      status,
      startDate: start,
      endDate: addDays(start, plan.mealCount === 25 ? 40 : 66),
      deliveryDays,
      defaultMeal: pick(MEALS),
    });
  }

  // ---- Edge-case subscriptions -------------------------------------------
  const ledger: LedgerEntry[] = [];
  const activity: ActivityEntry[] = [];
  const pauses: Pause[] = [];
  const overrides: Override[] = [];

  // 1 meal remaining, delivering today
  subscriptions[3].status = "active";
  subscriptions[3].mealsRemaining = 1;
  subscriptions[3].deliveryDays = [0, 1, 2, 3, 4, 5];

  // expiring in 2 days with 6 meals unused
  subscriptions[7].status = "active";
  subscriptions[7].mealsRemaining = 6;
  subscriptions[7].endDate = addDays(today, 2);

  // paused mid-pause with extension applied
  const paused = subscriptions[11];
  paused.status = "paused";
  paused.deliveryDays = [0, 1, 2, 3, 4, 5];
  const pStart = addDays(today, -3);
  const pEnd = addDays(today, 4);
  const missed = countDeliveryDays(pStart, pEnd, paused.deliveryDays);
  paused.endDate = addDays(paused.endDate, missed);
  pauses.push({
    id: "pause_seed_1",
    subscriptionId: paused.id,
    startDate: pStart,
    endDate: pEnd,
    deliveryDaysMissed: missed,
    extensionApplied: true,
  });
  activity.push({
    id: "act_pause_1",
    subscriptionId: paused.id,
    timestamp: ts(pStart, 9, 12),
    actor: ADMIN,
    kind: "admin",
    text: `Paused ${formatDate(pStart)} → ${formatDate(pEnd)} · ${missed} delivery days missed · end date extended to ${formatDate(paused.endDate)}`,
  });

  // condo w/ buzz code
  customers[5].locationType = "condo";
  customers[5].buzzCode = "4417";
  customers[5].instructions = "Buzz 4417, elevator to P1 lobby";

  // workplace w/ date-specific override
  customers[9].locationType = "workplace";
  const wsub = subscriptions[9];
  wsub.status = "active";
  overrides.push({
    id: "ovr_seed_1",
    subscriptionId: wsub.id,
    date: today,
    addressOverride: "Suite 1200 – 555 Burrard St, Vancouver, BC V7X 1M8 (office reception)",
    skip: false,
  });
  overrides.push({
    id: "ovr_seed_2",
    subscriptionId: wsub.id,
    date: addDays(today, 3),
    mealOverride: "Jain — no onion/garlic",
    skip: false,
  });
  overrides.push({
    id: "ovr_seed_3",
    subscriptionId: subscriptions[3].id,
    date: addDays(today, 2),
    skip: true,
  });

  // ---- Orders for today ---------------------------------------------------
  const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "paused");
  const orders: Order[] = [];
  const TOTAL = 700;
  for (let i = 0; i < TOTAL; i++) {
    const sub = activeSubs[i % activeSubs.length];
    const cust = customers.find((c) => c.id === sub.customerId)!;
    const ovr = overrides.find((o) => o.subscriptionId === sub.id && o.date === today);
    const r = rand();
    const status: Order["status"] =
      r < 0.55 ? "delivered" : r < 0.7 ? "on_route" : r < 0.9 ? "scheduled" : r < 0.95 ? "pending" : "failed";
    orders.push({
      id: `ord_${String(i + 1).padStart(4, "0")}`,
      subscriptionId: sub.id,
      date: today,
      addressSnapshot: ovr?.addressOverride ?? cust.address,
      mealSelection: ovr?.mealOverride ?? (rand() < 0.7 ? sub.defaultMeal : pick(MEALS)),
      packingNote: pick(NOTES),
      status,
      pod: undefined,
    });
  }

  // The one-meal-left subscription must have an order today
  const oneMealOrder = orders.find((o) => o.subscriptionId === subscriptions[3].id);
  if (oneMealOrder) oneMealOrder.status = "on_route";

  // Assign stop numbers across 3 drivers for ~40 stops (route view)
  const routes: Route[] = DRIVERS.map((d, i) => ({
    id: `rt_${i + 1}`,
    date: today,
    driverName: d,
    stopCount: 0,
    status: "in_progress",
  }));
  const assignable = orders.filter((o) => o.status !== "pending").slice(0, 40);
  assignable.forEach((o, idx) => {
    const route = routes[idx % routes.length];
    route.stopCount += 1;
    o.routeId = route.id;
    o.stopNumber = route.stopCount;
    ledger.push(mkLedger(o, route, idx));
  });

  // Also give every non-pending unassigned order a stop number except one seeded exception
  let seq = 100;
  orders.forEach((o, idx) => {
    if (o.stopNumber || o.status === "pending") return;
    const route = routes[idx % routes.length];
    o.routeId = route.id;
    o.stopNumber = ++seq;
    route.stopCount += 1;
    ledger.push(mkLedger(o, route, idx + 1000));
  });

  function mkLedger(o: Order, route: Route, idx: number): LedgerEntry {
    return {
      id: `led_${o.id}`,
      subscriptionId: o.subscriptionId,
      orderId: o.id,
      amount: -1,
      reason: "stop_assignment",
      actor: "route-generator (system)",
      timestamp: ts(today, 1, 5 + (idx % 40)),
      idempotencyKey: `${o.id}:stop_assignment`,
    };
  }

  // Seeded UNASSIGNED order — generated, no stop number, no deduction
  const unassignedTargets = [orders[137], orders[402], orders[615]];
  unassignedTargets.forEach((o) => {
    o.status = "scheduled";
    o.routeId = undefined;
    o.stopNumber = undefined;
  });
  for (const o of unassignedTargets) {
    const i = ledger.findIndex((l) => l.orderId === o.id);
    if (i >= 0) ledger.splice(i, 1);
  }

  // Proof of delivery for delivered orders + failed one
  orders.forEach((o, i) => {
    if (o.status === "delivered") {
      o.pod = {
        signature: `sig_${o.id}`,
        photo: `photo_${o.id}`,
        driverNote: i % 7 === 0 ? "Left with concierge" : "Handed to customer",
        timestamp: ts(today, 2 + ((i * 7) % 8), (i * 13) % 60),
      };
    }
  });
  const failedOrder = orders.find((o) => o.status === "failed")!;
  failedOrder.pod = {
    signature: "",
    photo: `photo_${failedOrder.id}`,
    driverNote: "buzzer not working, no answer",
    timestamp: ts(today, 6, 42),
  };

  // ---- Notifications ------------------------------------------------------
  const notifications: Notification[] = [];
  let nId = 0;
  const nextId = () => `not_${String(++nId).padStart(4, "0")}`;
  orders.slice(0, 120).forEach((o, i) => {
    const sub = subscriptions.find((s) => s.id === o.subscriptionId)!;
    const cust = customers.find((c) => c.id === sub.customerId)!;
    notifications.push({
      id: nextId(),
      customerId: cust.id,
      date: today,
      eventType: "delivery_scheduled",
      channel: cust.smsOptIn ? "sms" : "email",
      status: cust.smsOptIn ? "sent" : "suppressed",
      suppressedBecauseOf: cust.smsOptIn ? undefined : "customer opted out of SMS",
      timestamp: ts(today, 1, 30 + (i % 25)),
    });
    if (o.status === "delivered") {
      notifications.push({
        id: nextId(),
        customerId: cust.id,
        date: today,
        eventType: "delivery_completed",
        channel: "sms",
        status: "sent",
        timestamp: o.pod!.timestamp,
      });
    }
  });
  // suppressed duplicate delivery_completed
  const original = notifications.find((n) => n.eventType === "delivery_completed")!;
  notifications.push({
    id: nextId(),
    customerId: original.customerId,
    date: today,
    eventType: "delivery_completed",
    channel: "sms",
    status: "suppressed",
    suppressedBecauseOf: original.id,
    timestamp: ts(today, 7, 3),
  });
  // low balance (fires once per threshold crossing)
  notifications.push({
    id: nextId(),
    customerId: subscriptions[3].customerId,
    date: today,
    eventType: "low_meal_balance",
    channel: "sms",
    status: "sent",
    timestamp: ts(today, 2, 15),
  });
  notifications.push({
    id: nextId(),
    customerId: subscriptions[3].customerId,
    date: today,
    eventType: "low_meal_balance",
    channel: "sms",
    status: "suppressed",
    suppressedBecauseOf: `threshold ≤3 already fired on ${formatDate(today)}`,
    timestamp: ts(today, 5, 40),
  });
  notifications.push({
    id: nextId(),
    customerId: subscriptions[7].customerId,
    date: today,
    eventType: "subscription_expiring",
    channel: "email",
    status: "sent",
    timestamp: ts(today, 2, 20),
  });

  // ---- Job runs -----------------------------------------------------------
  const jobRuns: JobRun[] = [];
  let jId = 0;
  jobRuns.push({
    id: `job_${++jId}`,
    jobName: "order-sync",
    startedAt: ts(today, 1, 0),
    durationMs: 8420,
    recordsProcessed: 700,
    notificationsSent: 0,
    failures: 0,
    outcome: "success",
  });
  jobRuns.push({
    id: `job_${++jId}`,
    jobName: "route-generation",
    startedAt: ts(today, 1, 5),
    durationMs: 12310,
    recordsProcessed: 697,
    notificationsSent: 120,
    failures: 3,
    outcome: "partial",
    error: "3 orders could not be geocoded to a route zone (left unassigned)",
  });
  // 20-minute status sync 02:00–10:00 with a gap at 06:20
  for (let h = 2; h <= 10; h++) {
    for (const m of [0, 20, 40]) {
      if (h === 10 && m > 0) continue;
      if (h === 6 && (m === 20 || m === 40)) continue; // 40-minute gap
      const idx = h * 3 + m / 20;
      const failed = h === 8 && m === 20;
      jobRuns.push({
        id: `job_${++jId}`,
        jobName: "delivery-status-sync",
        startedAt: ts(today, h, m),
        durationMs: 1200 + ((idx * 137) % 2600),
        recordsProcessed: 40 + ((idx * 31) % 90),
        notificationsSent: (idx * 7) % 22,
        failures: failed ? 12 : 0,
        outcome: failed ? "failed" : "success",
        error: failed
          ? "Upstream driver-app API returned 503 (Service Unavailable) after 3 retries — 12 status updates dropped"
          : undefined,
      });
    }
  }
  jobRuns.push({
    id: `job_${++jId}`,
    jobName: "notification-dispatch",
    startedAt: ts(today, 2, 10),
    durationMs: 4100,
    recordsProcessed: 124,
    notificationsSent: 121,
    failures: 3,
    outcome: "partial",
    error: "3 SMS rejected by carrier (invalid handset)",
  });

  // ---- Activity seed ------------------------------------------------------
  ledger.slice(0, 400).forEach((l) => {
    activity.push({
      id: `act_${l.id}`,
      subscriptionId: l.subscriptionId,
      timestamp: l.timestamp,
      actor: l.actor,
      kind: "deduction",
      text: `Meal deducted (−1) — stop assignment on ${l.orderId}`,
    });
  });

  return {
    customers,
    plans,
    subscriptions,
    orders,
    routes,
    ledger,
    pauses,
    overrides,
    notifications,
    jobRuns,
    activity,
    today,
  };
}

export function countDeliveryDays(start: string, end: string, days: number[]): number {
  if (!start || !end || end < start) return 0;
  let count = 0;
  let d = start;
  let guard = 0;
  while (d <= end && guard++ < 400) {
    if (days.includes(dayOfWeek(d))) count++;
    d = addDays(d, 1);
  }
  return count;
}

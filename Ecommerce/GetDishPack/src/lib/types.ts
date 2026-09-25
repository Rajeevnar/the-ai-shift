export type LocationType = "house" | "condo" | "workplace";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  buzzCode?: string;
  locationType: LocationType;
  instructions?: string;
  smsOptIn: boolean;
  emailOptIn: boolean;
  lat: number;
  lng: number;
}

export interface Plan {
  id: string;
  mealCount: 25 | 41;
  price: number;
}

export type SubStatus = "active" | "paused" | "expired" | "cancelled";

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  mealsPurchased: number;
  mealsRemaining: number;
  status: SubStatus;
  startDate: string;
  endDate: string;
  deliveryDays: number[];
  defaultMeal: string;
}

export type OrderStatus = "pending" | "scheduled" | "on_route" | "delivered" | "failed";

export interface Pod {
  signature: string;
  photo: string;
  driverNote: string;
  timestamp: string;
}

export interface Order {
  id: string;
  subscriptionId: string;
  date: string;
  addressSnapshot: string;
  mealSelection: string;
  packingNote?: string;
  status: OrderStatus;
  routeId?: string;
  stopNumber?: number;
  pod?: Pod;
}

export interface Route {
  id: string;
  date: string;
  driverName: string;
  stopCount: number;
  status: string;
}

export type LedgerReason =
  | "stop_assignment"
  | "unassignment_credit"
  | "failed_delivery_credit"
  | "admin_adjustment";

export interface LedgerEntry {
  id: string;
  subscriptionId: string;
  orderId?: string;
  amount: number;
  reason: LedgerReason;
  actor: string;
  timestamp: string;
  idempotencyKey: string;
}

export interface Pause {
  id: string;
  subscriptionId: string;
  startDate: string;
  endDate: string;
  deliveryDaysMissed: number;
  extensionApplied: boolean;
}

export interface Override {
  id: string;
  subscriptionId: string;
  date: string;
  addressOverride?: string;
  mealOverride?: string;
  skip: boolean;
}

export type NotificationEvent =
  | "delivery_scheduled"
  | "delivery_completed"
  | "delivery_reminder"
  | "low_meal_balance"
  | "subscription_expiring";

export type NotificationStatus = "queued" | "sent" | "failed" | "suppressed";

export interface Notification {
  id: string;
  customerId: string;
  date: string;
  eventType: NotificationEvent;
  channel: "sms" | "email";
  status: NotificationStatus;
  suppressedBecauseOf?: string;
  timestamp: string;
}

export interface JobRun {
  id: string;
  jobName: string;
  startedAt: string;
  durationMs: number;
  recordsProcessed: number;
  notificationsSent: number;
  failures: number;
  outcome: "success" | "failed" | "partial";
  error?: string;
}

export interface ActivityEntry {
  id: string;
  subscriptionId: string;
  timestamp: string;
  actor: string;
  kind: "status" | "deduction" | "credit" | "notification" | "admin";
  text: string;
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Btn, Empty, SectionTitle, SubBadge } from "@/components/ui-bits";
import { addDays, countDeliveryDays, formatDate, useLookup, useStore } from "@/lib/store";

export const Route = createFileRoute("/subscriptions/$subId")({
  head: () => ({
    meta: [
      { title: "Subscription detail — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Meal balance ledger, pause extensions, date overrides and the full activity timeline for one subscription.",
      },
      { property: "og:title", content: "Subscription detail — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Every meal deduction and credit, with the actor and timestamp behind it.",
      },
    ],
  }),
  component: SubscriptionDetail,
});

function SubscriptionDetail() {
  const { subId } = Route.useParams();
  const { state, actions } = useStore();
  const look = useLookup();
  const sub = state.subscriptions.find((s) => s.id === subId);
  const cust = sub ? look.cust(sub.customerId) : undefined;

  const [pStart, setPStart] = useState(state.today);
  const [pEnd, setPEnd] = useState(addDays(state.today, 14));
  const [ovrDate, setOvrDate] = useState(addDays(state.today, 1));
  const [ovrAddr, setOvrAddr] = useState("");
  const [ovrMeal, setOvrMeal] = useState("");

  const missed = useMemo(
    () => (sub ? countDeliveryDays(pStart, pEnd, sub.deliveryDays) : 0),
    [sub, pStart, pEnd],
  );

  if (!sub || !cust) {
    return <Empty title="Subscription not found" hint="It may have been removed from this session." />;
  }

  const ledger = state.ledger.filter((l) => l.subscriptionId === sub.id);
  const activity = [...state.activity.filter((a) => a.subscriptionId === sub.id)].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  const overrides = state.overrides.filter((o) => o.subscriptionId === sub.id);
  const pauses = state.pauses.filter((p) => p.subscriptionId === sub.id);
  const newEnd = addDays(sub.endDate, missed);

  return (
    <div className="pb-16">
      <PageHeader
        title={cust.name}
        subtitle={`${sub.mealsPurchased}-meal plan · ${sub.mealsRemaining} meals remaining · ends ${formatDate(sub.endDate)}`}
        right={
          <>
            <Link to="/subscriptions" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> All subscriptions
            </Link>
            {sub.status === "paused" ? (
              <Btn variant="primary" onClick={() => actions.resume(sub.id)}>Resume</Btn>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 px-5 py-4 xl:grid-cols-2">
        <div className="rounded-md border border-border bg-card">
          <SectionTitle right={<SubBadge status={sub.status} />}>Customer &amp; delivery</SectionTitle>
          <dl className="grid grid-cols-2 gap-y-2 p-3 text-[13px]">
            <dt className="text-muted-foreground">Phone</dt><dd className="tabular-nums">{cust.phone}</dd>
            <dt className="text-muted-foreground">Email</dt><dd className="truncate">{cust.email}</dd>
            <dt className="text-muted-foreground">Address</dt><dd>{cust.address}</dd>
            <dt className="text-muted-foreground">Location type</dt><dd>{cust.locationType}</dd>
            <dt className="text-muted-foreground">Buzz code</dt><dd className="tabular-nums">{cust.buzzCode ?? "—"}</dd>
            <dt className="text-muted-foreground">Instructions</dt><dd>{cust.instructions ?? "—"}</dd>
            <dt className="text-muted-foreground">Delivery days</dt>
            <dd>{sub.deliveryDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(" · ")}</dd>
            <dt className="text-muted-foreground">Default meal</dt><dd>{sub.defaultMeal}</dd>
          </dl>
        </div>

        <div className="rounded-md border border-border bg-card">
          <SectionTitle
            right={<span className="text-[12px] text-muted-foreground">{ledger.length} entries · append-only</span>}
          >
            Meal balance ledger
          </SectionTitle>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-[12px]">
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="w-10 px-2 py-1.5 tabular-nums font-semibold">
                      {l.amount > 0 ? `+${l.amount}` : l.amount}
                    </td>
                    <td className="px-2 py-1.5">{l.reason.replace(/_/g, " ")}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{l.orderId ?? "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{l.actor}</td>
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                      {new Date(l.timestamp).toLocaleString("en-CA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 ? <Empty title="No ledger entries yet" hint="A meal is deducted at first stop assignment." /> : null}
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <SectionTitle>Pause &amp; extension</SectionTitle>
          <div className="space-y-3 p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">From</span>
                <input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 tabular-nums" />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">To</span>
                <input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 tabular-nums" />
              </label>
            </div>
            <div className="rounded-md border border-border bg-surface-raised p-2">
              <span className="tabular-nums font-semibold">{missed}</span> of this customer&apos;s own delivery days fall
              inside the range — end date would move {formatDate(sub.endDate)} →{" "}
              <span className="font-semibold">{formatDate(newEnd)}</span>.
            </div>
            <Btn variant="primary" onClick={() => actions.pause(sub.id, pStart, pEnd)}>
              Confirm pause
            </Btn>
            {pauses.length > 0 ? (
              <ul className="space-y-1 text-[12px] text-muted-foreground">
                {pauses.map((p) => (
                  <li key={p.id}>
                    {formatDate(p.startDate)} → {formatDate(p.endDate)} · {p.deliveryDaysMissed} delivery days ·{" "}
                    {p.extensionApplied ? "extension applied" : "no extension"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <SectionTitle>Date overrides</SectionTitle>
          <div className="space-y-2 p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={ovrDate} onChange={(e) => setOvrDate(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 tabular-nums" />
              <input value={ovrAddr} onChange={(e) => setOvrAddr(e.target.value)} placeholder="Alternate address" className="h-8 w-52 rounded-md border border-border bg-card px-2" />
              <input value={ovrMeal} onChange={(e) => setOvrMeal(e.target.value)} placeholder="Alternate meal" className="h-8 w-40 rounded-md border border-border bg-card px-2" />
              <Btn onClick={() => actions.addOverride(sub.id, ovrDate, { addressOverride: ovrAddr || undefined, mealOverride: ovrMeal || undefined, skip: false })}>
                Save override
              </Btn>
              <Btn variant="ghost" onClick={() => actions.addOverride(sub.id, ovrDate, { skip: true })}>
                Skip that date
              </Btn>
            </div>
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              {overrides.map((o) => (
                <li key={o.id}>
                  {formatDate(o.date)} — {o.skip ? "skip delivery" : [o.addressOverride, o.mealOverride].filter(Boolean).join(" · ")}
                </li>
              ))}
              {overrides.length === 0 ? <li>No upcoming overrides.</li> : null}
            </ul>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card xl:col-span-2">
          <SectionTitle right={<span className="text-[12px] text-muted-foreground">{activity.length} events</span>}>
            Activity timeline
          </SectionTitle>
          <ul className="max-h-96 overflow-auto p-3 text-[13px]">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 border-l-2 border-border py-1.5 pl-3">
                <span className="w-36 shrink-0 tabular-nums text-[12px] text-muted-foreground">
                  {new Date(a.timestamp).toLocaleString("en-CA")}
                </span>
                <span className="w-24 shrink-0 text-[12px] uppercase tracking-wide text-muted-foreground">{a.kind}</span>
                <span className="flex-1">{a.text}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{a.actor}</span>
              </li>
            ))}
            {activity.length === 0 ? <Empty title="No activity yet" hint="Actions on this subscription will appear here." /> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

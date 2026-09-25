import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, SectionTitle } from "@/components/ui-bits";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "System Activity — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Job-run log and the 02:00–10:00 delivery-status sync timeline, where a missing tick means a sync never ran.",
      },
      { property: "og:title", content: "System Activity — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Every automated run with duration, records processed and failures — gaps included.",
      },
    ],
  }),
  component: SystemActivity,
});

function minutesOf(iso: string) {
  const h = Number(iso.slice(11, 13));
  const m = Number(iso.slice(14, 16));
  return h * 60 + m;
}

function SystemActivity() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const runs = useMemo(
    () => [...state.jobRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [state.jobRuns],
  );

  const syncRuns = useMemo(
    () =>
      state.jobRuns
        .filter((j) => j.jobName === "delivery-status-sync")
        .map((j) => ({ ...j, min: minutesOf(j.startedAt) }))
        .filter((j) => j.min >= 120 && j.min <= 600)
        .sort((a, b) => a.min - b.min),
    [state.jobRuns],
  );

  const expected = useMemo(() => {
    const out: number[] = [];
    for (let m = 120; m <= 600; m += 20) out.push(m);
    return out;
  }, []);

  const present = new Set(syncRuns.map((r) => Math.round(r.min / 20) * 20));
  const gaps = expected.filter((m) => !present.has(m));

  const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  return (
    <div className="pb-16">
      <PageHeader
        title="System Activity"
        subtitle={`${runs.length} job runs · delivery-status sync every 20 min, 02:00–10:00 America/Vancouver`}
      />

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-md border border-border bg-card">
          <SectionTitle
            right={
              gaps.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--status-failed)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {gaps.length} missed run{gaps.length > 1 ? "s" : ""} ({gaps.map(label).join(", ")})
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground">No gaps</span>
              )
            }
          >
            Delivery-status sync timeline
          </SectionTitle>
          <div className="p-4">
            <div className="relative h-16">
              <div className="absolute left-0 right-0 top-7 h-px bg-border" />
              {expected.map((m) => {
                const pct = ((m - 120) / 480) * 100;
                const missing = !present.has(m);
                return (
                  <div key={m} className="absolute -translate-x-1/2" style={{ left: `${pct}%` }}>
                    {missing ? (
                      <div
                        title={`No sync at ${label(m)}`}
                        className="mt-3 h-8 w-3 rounded-sm border-2 border-dashed border-[var(--status-failed)] bg-[color-mix(in_oklch,var(--status-failed)_12%,white)]"
                      />
                    ) : (
                      <div className="mt-4 h-6 w-2 rounded-sm bg-[var(--status-delivered)]" />
                    )}
                    {m % 60 === 0 ? (
                      <div className="mt-1 text-center text-[10px] tabular-nums text-muted-foreground">{label(m)}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {gaps.length > 0 ? (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-[color-mix(in_oklch,var(--status-failed)_35%,white)] bg-[color-mix(in_oklch,var(--status-failed)_7%,white)] px-3 py-2 text-[13px]">
                <AlertTriangle className="h-4 w-4 text-[var(--status-failed)]" />
                <span>
                  Status sync did not run at{" "}
                  <span className="font-semibold tabular-nums">{gaps.map(label).join(", ")}</span> — deliveries in that
                  window were not reported until the next successful run.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-medium">Job</th>
                <th className="px-2 py-2 text-left font-medium">Started</th>
                <th className="px-2 py-2 text-left font-medium">Duration</th>
                <th className="px-2 py-2 text-left font-medium">Records</th>
                <th className="px-2 py-2 text-left font-medium">Notifications</th>
                <th className="px-2 py-2 text-left font-medium">Failures</th>
                <th className="px-2 py-2 text-left font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((j) => (
                <Fragment key={j.id}>
                  <tr
                    onClick={() => setOpen(open === j.id ? null : j.id)}
                    className="h-8 cursor-pointer border-b border-border last:border-0 hover:bg-accent"
                  >
                    <td className="px-2 font-medium">{j.jobName}</td>
                    <td className="px-2 tabular-nums text-muted-foreground">{j.startedAt.slice(11, 16)}</td>
                    <td className="px-2 tabular-nums text-muted-foreground">{(j.durationMs / 1000).toFixed(1)}s</td>
                    <td className="px-2 tabular-nums">{j.recordsProcessed}</td>
                    <td className="px-2 tabular-nums">{j.notificationsSent}</td>
                    <td className={`px-2 tabular-nums ${j.failures > 0 ? "font-semibold text-[var(--status-failed)]" : ""}`}>
                      {j.failures}
                    </td>
                    <td
                      className={`px-2 font-medium ${
                        j.outcome === "success"
                          ? "text-[var(--status-delivered)]"
                          : j.outcome === "partial"
                            ? "text-[var(--status-attention)]"
                            : "text-[var(--status-failed)]"
                      }`}
                    >
                      {j.outcome}
                    </td>
                  </tr>
                  {open === j.id && j.error ? (
                    <tr className="border-b border-border">
                      <td colSpan={7} className="bg-surface-raised px-3 py-2 text-[12px] text-[var(--status-failed)]">
                        {j.error}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {runs.length === 0 ? <Empty title="No job runs yet" hint="Run Sync orders to create the first job." /> : null}
        </div>
      </div>
    </div>
  );
}

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CLUSTER_COLORS, TODAY, useStore, type Priority, type Status, type Workspace } from "@/lib/store";

export const statusVar: Record<Status, string> = {
  Idea: "var(--st-idea)", Drafted: "var(--st-drafted)", "In Review": "var(--st-review)",
  Approved: "var(--st-approved)", Scheduled: "var(--st-scheduled)", Published: "var(--st-published)",
};
const darkText: Status[] = ["Idea", "Published", "Drafted"];

export function StatusPill({ status, className, approver }: { status: Status; className?: string; approver?: string | null }) {
  const { user } = useStore();
  const a = status === "In Review" ? user(approver ?? null) : undefined;
  return (
    <span title={a ? `In ${a.name}'s review queue` : undefined} className={cn("inline-flex h-7 min-w-24 items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-semibold", className)}
      style={{ background: statusVar[status], color: darkText.includes(status) ? "var(--navy)" : "var(--on-status)" }}>
      {status}
      {a && <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ring-1 ring-card" style={{ background: a.color, color: "var(--on-status)" }}>{a.initials}</span>}
    </span>
  );
}
export function DueTimeline({ items }: { items: { label: string; date: string }[] }) {
  const today = TODAY;
  const tone = (d: string) => (d < today ? "var(--destructive)" : d === today ? "var(--due-today)" : "var(--muted-foreground)");
  const word = (d: string) => (d < today ? "overdue" : d === today ? "due today" : "upcoming");
  return (
    <ol className="mt-3 flex items-start">
      {items.map((it, i) => (
        <li key={it.label} className="relative flex flex-1 flex-col items-start text-[11px]" title={`${it.label}: ${it.date || "not set"} · ${it.date ? word(it.date) : ""}`}>
          <div className="flex w-full items-center">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.date ? tone(it.date) : "var(--border)" }} />
            {i < items.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
          </div>
          <span className="mt-1 font-semibold text-muted-foreground">{it.label}</span>
          <span className="font-mono" style={{ color: it.date ? tone(it.date) : "var(--muted-foreground)" }}>{it.date ? format(new Date(it.date), "d MMM") : "—"}{it.date && it.date <= today ? ` · ${word(it.date)}` : ""}</span>
        </li>
      ))}
    </ol>
  );
}
export const priorityVar: Record<Priority, string> = { P0: "var(--p0)", P1: "var(--st-drafted)", P2: "var(--st-idea)" };
export function PriorityChip({ p }: { p: Priority }) {
  return <span className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold" style={{ background: priorityVar[p], color: p === "P0" ? "var(--on-status)" : "var(--navy)" }}>{p}</span>;
}
export function clusterColor(ws: Workspace | undefined, cluster: string) {
  const i = ws ? Math.max(0, ws.clusters.indexOf(cluster)) : 0;
  return CLUSTER_COLORS[i % CLUSTER_COLORS.length];
}
export function ClusterChip({ ws, cluster }: { ws?: Workspace; cluster: string }) {
  const c = clusterColor(ws, cluster);
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `color-mix(in oklab, ${c} 18%, transparent)`, color: "var(--navy)" }}>
    <span className="size-1.5 rounded-full" style={{ background: c }} />{cluster}</span>;
}
export function Avatar({ id, size = 24 }: { id: string | null; size?: number }) {
  const { user } = useStore();
  const u = user(id);
  if (!u) return <span className="inline-block rounded-full border border-dashed border-border" style={{ width: size, height: size }} />;
  return <span title={u.name} className="inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-card"
    style={{ width: size, height: size, fontSize: size * 0.38, background: u.color, color: "var(--on-status)" }}>{u.initials}</span>;
}
export function OverdueChip() {
  return <span title="Overdue" aria-label="Overdue" className="inline-block size-2 shrink-0 rounded-full bg-destructive" />;
}

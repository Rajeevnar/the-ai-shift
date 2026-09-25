import { format, formatDistanceToNow } from "date-fns";
import { Bar, BarChart, Cell, Funnel, FunnelChart, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { STAGES, STATUSES, TIERS, TODAY, addDays, isOverdue, useStore, type Piece, type Workspace } from "@/lib/store";
import { Avatar, StatusPill, clusterColor, statusVar } from "./ui";

function Widget({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}><h3 className="mb-3 text-sm font-bold text-navy">{title}</h3>{children}</div>;
}

export function DashboardView({ pieces, ws, onOpen }: { pieces: Piece[]; ws: Workspace; onOpen: (id: string) => void }) {
  const { activity, users, user } = useStore();
  const byStatus = STATUSES.map((s) => ({ name: s, value: pieces.filter((p) => p.status === s).length }));
  const byCluster = ws.clusters.map((c) => ({ name: c, value: pieces.filter((p) => p.cluster === c).length, fill: clusterColor(ws, c) }));
  const funnel = STAGES.map((s, i) => ({ name: s, value: pieces.filter((p) => p.stage === s).length, fill: [`var(--c3)`, `var(--c1)`, `var(--lime)`][i] }));
  const byTier = TIERS.map((t) => ({ name: t, ...Object.fromEntries(STATUSES.map((s) => [s, pieces.filter((p) => p.tier === t && p.status === s).length])) }));
  const byMember = users.map((u) => ({ name: u.name.split(" ")[0], value: pieces.filter((p) => [p.writer, p.designer, p.seo].includes(u.id)).length })).filter((x) => x.value);
  const overdue = pieces.filter(isOverdue);
  const week = pieces.filter((p) => p.publishDate >= TODAY && p.publishDate <= addDays(TODAY, 7)).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  const queue = pieces.filter((p) => p.status === "In Review");
  const feed = activity.filter((a) => a.workspaceId === ws.id).slice(0, 8);

  return (
    <div className="grid h-full auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-4">
      <Widget title="Overdue"><p className="text-5xl font-black" style={{ color: overdue.length ? "var(--p0)" : "var(--lime-deep)" }}>{overdue.length}</p><p className="text-xs text-muted-foreground">pieces past date or approval SLA</p></Widget>
      <Widget title="Published"><p className="text-5xl font-black text-lime-deep">{byStatus[5]?.value}</p><p className="text-xs text-muted-foreground">of {pieces.length} pieces in {ws.name}</p></Widget>
      <Widget title="Pieces by status" className="md:col-span-2 xl:row-span-2">
        <div className="h-64"><ResponsiveContainer><PieChart><Pie data={byStatus} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={2}>{byStatus.map((s) => <Cell key={s.name} fill={statusVar[s.name as Piece["status"]]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        <div className="flex flex-wrap gap-2">{byStatus.map((s) => <span key={s.name} className="flex items-center gap-1 text-xs"><span className="size-2.5 rounded-sm" style={{ background: statusVar[s.name as Piece["status"]] }} />{s.name} {s.value}</span>)}</div>
      </Widget>
      <Widget title="Pieces by cluster" className="md:col-span-2">
        <div className="h-40"><ResponsiveContainer><BarChart data={byCluster} layout="vertical"><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={4}>{byCluster.map((c) => <Cell key={c.name} fill={c.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
      </Widget>
      <Widget title="This week's publishing" className="md:col-span-2">
        <ul className="space-y-2">{week.length ? week.map((p) => <li key={p.id} onClick={() => onOpen(p.id)} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted"><span className="w-14 text-xs font-bold text-muted-foreground">{format(new Date(p.publishDate), "EEE d")}</span><span className="flex-1 truncate text-sm text-navy">{p.title}</span><StatusPill status={p.status} approver={p.approver1 ?? p.approver2} /></li>) : <li className="text-sm text-muted-foreground">Nothing scheduled.</li>}</ul>
      </Widget>
      <Widget title="Approval queue" className="md:col-span-2">
        <ul className="space-y-2">{queue.length ? queue.map((p) => <li key={p.id} onClick={() => onOpen(p.id)} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted"><Avatar id={p.approver1 ?? p.approver2} /><span className="flex-1 truncate text-sm text-navy">{p.title}</span><span className="text-[10px] font-semibold text-muted-foreground">{p.approver1 ? "Tier 1 · 48h" : "Tier 2 · 24h"}</span>{isOverdue(p) && <span className="text-[10px] font-bold text-destructive">SLA</span>}</li>) : <li className="text-sm text-muted-foreground">Queue is clear.</li>}</ul>
      </Widget>
      <Widget title="Decision stage funnel">
        <div className="h-48"><ResponsiveContainer><FunnelChart><Tooltip /><Funnel dataKey="value" data={funnel} isAnimationActive><LabelList position="center" dataKey="name" fill="var(--navy)" fontSize={11} /></Funnel></FunnelChart></ResponsiveContainer></div>
      </Widget>
      <Widget title="By team member">
        <div className="h-48"><ResponsiveContainer><BarChart data={byMember}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} width={20} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="var(--c3)" radius={4} /></BarChart></ResponsiveContainer></div>
      </Widget>
      <Widget title="Revenue tier × status" className="md:col-span-2">
        <div className="h-48"><ResponsiveContainer><BarChart data={byTier}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={20} tick={{ fontSize: 10 }} /><Tooltip />{STATUSES.map((s) => <Bar key={s} dataKey={s} stackId="a" fill={statusVar[s]} />)}</BarChart></ResponsiveContainer></div>
      </Widget>
      <Widget title="Success metrics" className="md:col-span-2">
        <ul className="space-y-1.5">{pieces.filter((p) => p.status === "Published").map((p) => <li key={p.id} className="text-sm"><span className="font-medium text-navy">{p.title}</span><br /><span className="text-xs text-muted-foreground">🎯 {p.successMetric || "—"}</span></li>)}</ul>
      </Widget>
      <Widget title="Recent activity" className="md:col-span-2">
        <ul className="space-y-2">{feed.length ? feed.map((a) => <li key={a.id} className="flex items-start gap-2 text-sm"><Avatar id={a.actor} size={20} /><span className="flex-1"><b className="text-navy">{user(a.actor)?.name}</b> {a.text}</span><span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.at))}</span></li>) : <li className="text-sm text-muted-foreground">Move a card or leave a comment — activity shows here.</li>}</ul>
      </Widget>
    </div>
  );
}

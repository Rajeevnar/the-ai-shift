import { useState } from "react";
import { ArrowUpDown, Download, Trash2 } from "lucide-react";
import { STATUSES, TODAY, addDays, canApprove, isManager, isOverdue, useStore, type Piece, type Workspace } from "@/lib/store";
import { ClusterChip, OverdueChip, statusVar } from "./ui";
import { Button } from "@/components/ui/button";

export const SAVED_VIEWS = ["All pieces", "My work this week", "Awaiting my approval", "Overdue", "This week's publishing", "By cluster"] as const;
export type SavedView = (typeof SAVED_VIEWS)[number];

export function applySavedView(v: SavedView, pieces: Piece[], meId: string, approver: boolean) {
  const weekEnd = addDays(TODAY, 7);
  switch (v) {
    case "My work this week": return pieces.filter((p) => [p.writer, p.designer, p.seo].includes(meId) && p.publishDate >= TODAY && p.publishDate <= weekEnd);
    case "Awaiting my approval": return pieces.filter((p) => p.status === "In Review" && approver && (p.approver1 === meId || p.approver2 === meId));
    case "Overdue": return pieces.filter(isOverdue);
    case "This week's publishing": return pieces.filter((p) => p.publishDate >= TODAY && p.publishDate <= weekEnd);
    case "By cluster": return [...pieces].sort((a, b) => a.cluster.localeCompare(b.cluster));
    default: return pieces;
  }
}

type Col = { key: keyof Piece; label: string; w: string; plain?: boolean };
const COLS: Col[] = [
  { key: "title", label: "Title", w: "min-w-72" }, { key: "status", label: "Status", w: "w-32", plain: true },
  { key: "cluster", label: "Cluster", w: "w-40" }, { key: "writer", label: "Writer", w: "w-40", plain: true }, { key: "publishDate", label: "Publish", w: "w-36" },
  { key: "format", label: "Format", w: "w-32", plain: true }, { key: "keyword", label: "Primary keyword", w: "w-56" }, { key: "volume", label: "UK vol.", w: "w-24" },
  { key: "difficulty", label: "KD", w: "w-20" },
];

export function TableView({ pieces, ws, onOpen }: { pieces: Piece[]; ws: Workspace; onOpen: (id: string) => void }) {
  const { updatePiece, deletePieces, users, me } = useStore();
  const [sort, setSort] = useState<{ k: keyof Piece; dir: 1 | -1 }>({ k: "publishDate", dir: 1 });
  const [sel, setSel] = useState<string[]>([]);
  const rows = [...pieces].sort((a, b) => String(a[sort.k]).localeCompare(String(b[sort.k]), undefined, { numeric: true }) * sort.dir);
  const canDelete = isManager(me);

  const exportCsv = () => {
    const keys: (keyof Piece)[] = ["title", "status", "priority", "cluster", "publishDate", "format", "keyword", "volume", "difficulty", "stage", "tier", "voice", "successMetric"];
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${ws.name}-content.csv`; a.click();
  };

  const cell = (p: Piece, k: keyof Piece) => {
    const base = "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-ring rounded";
    switch (k) {
      case "title": return <div className="flex items-center gap-2 pl-1.5">{isOverdue(p) && <OverdueChip />}<input className={base + " font-medium text-navy"} defaultValue={p.title} onBlur={(e) => e.target.value !== p.title && updatePiece(p.id, { title: e.target.value })} /></div>;
      case "status": return <select value={p.status} onChange={(e) => updatePiece(p.id, { status: e.target.value as Piece["status"] })} className="h-9 w-full cursor-pointer appearance-none text-center font-mono text-xs outline-none" style={{ background: statusVar[p.status], color: "var(--navy)" }}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>;
      case "cluster": return <div className="px-2"><ClusterChip ws={ws} cluster={p.cluster} /></div>;
      case "writer": return <span className="block px-2 font-mono text-xs text-navy">{users.find((u) => u.id === p.writer)?.name ?? "Unassigned"}</span>;
      case "publishDate": return <input type="date" className={base} value={p.publishDate} onChange={(e) => updatePiece(p.id, { publishDate: e.target.value })} />;
      case "volume": case "difficulty": return <input type="number" className={base + " font-mono"} defaultValue={p[k] as number} onBlur={(e) => updatePiece(p.id, { [k]: Number(e.target.value) })} />;
      case "keyword": return <input className={base + " font-mono text-xs"} defaultValue={p.keyword} onBlur={(e) => e.target.value !== p.keyword && updatePiece(p.id, { keyword: e.target.value })} />;
      default: return <span className="px-2 font-mono text-xs text-muted-foreground">{String(p[k])}</span>;
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 flex items-center gap-2">
        {sel.length > 0 ? (<>
          <span className="text-sm font-semibold text-navy">{sel.length} selected</span>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-sm" defaultValue="" onChange={(e) => { sel.forEach((id) => updatePiece(id, { status: e.target.value as Piece["status"] })); setSel([]); }}>
            <option value="" disabled>Change status…</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-sm" defaultValue="" onChange={(e) => { sel.forEach((id) => updatePiece(id, { writer: e.target.value })); setSel([]); }}>
            <option value="" disabled>Assign writer…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          {canDelete && <Button size="sm" variant="destructive" onClick={() => { deletePieces(sel); setSel([]); }}><Trash2 /> Delete</Button>}
        </>) : <span className="text-sm text-muted-foreground">{rows.length} pieces · click any cell to edit</span>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}><Download /> Export CSV</Button>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-2"><input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
              {COLS.map((c) => <th key={c.key} className={`${c.w}${c.plain ? "" : " border-l border-border"} px-2 py-2 ${c.plain ? "font-normal" : "font-semibold"}`}>
                <button className="flex items-center gap-1" onClick={() => setSort({ k: c.key, dir: sort.k === c.key ? (sort.dir === 1 ? -1 : 1) : 1 })}>{c.label}<ArrowUpDown className="size-3" /></button></th>)}
              <th className="w-24 px-2 py-2 font-normal">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/30" style={{ boxShadow: `inset 4px 0 0 ${statusVar[p.status]}` }}>
                <td className="px-2 text-center"><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /></td>
                {COLS.map((c) => <td key={c.key} className={`${c.plain ? "" : "border-l border-border"} p-0`}>{cell(p, c.key)}</td>)}
                <td className="px-2 text-center"><button onClick={() => onOpen(p.id)} className="inline-flex h-8 items-center font-mono text-xs text-muted-foreground transition hover:text-navy hover:underline">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches this view{!canApprove(me) ? "" : ""}.</p>}
      </div>
    </div>
  );
}

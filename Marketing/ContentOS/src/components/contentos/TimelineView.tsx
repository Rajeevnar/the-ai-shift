import { useRef, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TODAY, addDays, useStore, type Piece, type Workspace } from "@/lib/store";
import { clusterColor, statusVar } from "./ui";

const DAY = 28;
export function TimelineView({ pieces, ws, onOpen }: { pieces: Piece[]; ws: Workspace; onOpen: (id: string) => void }) {
  const { updatePiece } = useStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const start = addDays(TODAY, -21);
  const total = 70;
  const x = (d: string) => differenceInCalendarDays(new Date(d), new Date(start)) * DAY;
  const drag = useRef<{ id: string; edge: "start" | "end" | "move"; startX: number; p: Piece } | null>(null);

  const onMove = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const delta = Math.round((e.clientX - d.startX) / DAY);
    if (delta === 0) return;
    const { p } = d;
    if (d.edge === "start") updatePiece(p.id, { draftDue: addDays(p.draftDue, delta) }, `shifted draft due on “${p.title}”`);
    else if (d.edge === "end") updatePiece(p.id, { publishDate: addDays(p.publishDate, delta) });
    else updatePiece(p.id, { draftDue: addDays(p.draftDue, delta), designDue: addDays(p.designDue, delta), publishDate: addDays(p.publishDate, delta) });
    drag.current = null;
  };
  const begin = (e: React.PointerEvent, p: Piece, edge: "start" | "end" | "move") => {
    e.stopPropagation();
    drag.current = { id: p.id, edge, startX: e.clientX, p };
    const up = (ev: PointerEvent) => { onMove(ev); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="relative inline-block min-w-full rounded-lg border border-border bg-card">
        <div className="sticky top-0 z-10 flex border-b border-border bg-card">
          <div className="w-72 shrink-0 border-r border-border px-3 py-2 text-xs font-bold text-muted-foreground">Piece</div>
          <div className="flex">
            {Array.from({ length: total }, (_, i) => { const d = addDays(start, i); return (
              <div key={d} className={`shrink-0 border-r border-border/60 py-2 text-center text-[10px] ${d === TODAY ? "bg-lime font-bold text-navy" : "text-muted-foreground"}`} style={{ width: DAY }}>
                {format(new Date(d), "d")}<br />{format(new Date(d), "EEEEE")}</div>); })}
          </div>
        </div>
        {ws.clusters.map((cl) => {
          const rows = pieces.filter((p) => p.cluster === cl);
          if (!rows.length) return null;
          const c = clusterColor(ws, cl);
          return (
            <div key={cl}>
              <button onClick={() => setCollapsed({ ...collapsed, [cl]: !collapsed[cl] })} className="flex w-full items-center gap-1 border-b border-border px-3 py-2 text-left text-sm font-bold" style={{ color: c }}>
                {collapsed[cl] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}{cl} <span className="font-normal text-muted-foreground">· {rows.length}</span>
              </button>
              {!collapsed[cl] && rows.map((p) => {
                const left = x(p.draftDue), right = x(p.publishDate) + DAY, mid = x(p.designDue);
                return (
                  <div key={p.id} className="flex border-b border-border/60 hover:bg-muted/40">
                    <button onClick={() => onOpen(p.id)} className="w-72 shrink-0 truncate border-r border-border px-3 py-2 text-left text-sm text-navy" style={{ borderLeft: `4px solid ${c}` }}>{p.title}</button>
                    <div className="relative" style={{ width: total * DAY, height: 40 }}>
                      <div className="absolute top-0 bottom-0 w-px bg-lime" style={{ left: x(TODAY) + DAY / 2 }} />
                      <div onPointerDown={(e) => begin(e, p, "move")} className="absolute top-2 flex h-6 cursor-grab items-center overflow-hidden rounded-full text-[10px] font-semibold shadow-sm"
                        style={{ left, width: Math.max(right - left, DAY), background: `color-mix(in oklab, ${statusVar[p.status]} 70%, transparent)` }}>
                        <span onPointerDown={(e) => begin(e, p, "start")} className="h-full w-2 cursor-ew-resize bg-navy/20" />
                        <span className="absolute h-full w-0.5 bg-navy/40" style={{ left: mid - left }} title="Design due" />
                        <span className="flex-1 truncate px-2 text-navy">{p.status}</span>
                        <span onPointerDown={(e) => begin(e, p, "end")} className="h-full w-2 cursor-ew-resize bg-navy/20" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Bars run from draft due → publish date (tick = design due). Drag a bar to shift it, or drag its ends.</p>
    </div>
  );
}

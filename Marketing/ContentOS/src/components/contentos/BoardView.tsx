import { useState } from "react";
import { format } from "date-fns";
import { Plus, Link2 } from "lucide-react";
import { STATUSES, isOverdue, useStore, type Piece, type Status, type Workspace } from "@/lib/store";
import { Avatar, ClusterChip, OverdueChip, PriorityChip, statusVar } from "./ui";

export function BoardView({ pieces, ws, onOpen, onAdd }: { pieces: Piece[]; ws: Workspace; onOpen: (id: string) => void; onAdd: (s: Partial<Piece>) => void }) {
  const { updatePiece } = useStore();
  const [over, setOver] = useState<Status | null>(null);
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {STATUSES.map((s) => {
        const col = pieces.filter((p) => p.status === s);
        return (
          <div key={s}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) updatePiece(id, { status: s }); }}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/60 transition-colors"
            style={over === s ? { background: `color-mix(in oklab, ${statusVar[s]} 20%, transparent)` } : undefined}>
            <div className="flex items-center justify-between rounded-t-lg px-3 py-2" style={{ borderTop: `4px solid ${statusVar[s]}` }}>
              <span className="text-sm font-bold text-navy">{s} <span className="ml-1 font-normal text-muted-foreground">{col.length}</span></span>
              <button onClick={() => onAdd({ status: s })} className="rounded p-1 text-muted-foreground hover:bg-card"><Plus className="size-4" /></button>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {col.map((p) => (
                <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)} onClick={() => onOpen(p.id)}
                  className="cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                  style={{ borderLeft: `4px solid ${statusVar[s]}` }}>
                  <div className="mb-2 flex flex-wrap items-center gap-1"><PriorityChip p={p.priority} /><ClusterChip ws={ws} cluster={p.cluster} />{isOverdue(p) && <OverdueChip />}</div>
                  <p className="text-sm font-semibold leading-snug text-navy">{p.title}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(p.publishDate), "d MMM")} · {p.format}</span>
                    <span className="flex items-center gap-1.5">{p.caseIds.length > 0 && <span className="flex items-center gap-0.5"><Link2 className="size-3" />{p.caseIds.length}</span>}<Avatar id={p.writer} size={22} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

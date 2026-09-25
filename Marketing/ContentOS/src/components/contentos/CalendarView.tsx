import { useState } from "react";
import { addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TODAY, useStore, type Piece, type Workspace } from "@/lib/store";
import { clusterColor } from "./ui";
import { Button } from "@/components/ui/button";

export function CalendarView({ pieces, ws, onOpen, onAdd }: { pieces: Piece[]; ws: Workspace; onOpen: (id: string) => void; onAdd: (s: Partial<Piece>) => void }) {
  const { updatePiece } = useStore();
  const [cursor, setCursor] = useState(new Date(TODAY));
  const [mode, setMode] = useState<"month" | "week">("month");
  const days = mode === "month"
    ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) })
    : eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) });
  const step = (n: number) => setCursor(mode === "month" ? addMonths(cursor, n) : addWeeks(cursor, n));
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => step(-1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" onClick={() => step(1)}><ChevronRight /></Button>
        <h2 className="ml-2 text-lg font-bold text-navy">{format(cursor, mode === "month" ? "MMMM yyyy" : "'Week of' d MMM yyyy")}</h2>
        <div className="ml-auto flex rounded-md border border-border bg-card p-0.5">
          {(["month", "week"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1 text-xs font-semibold capitalize ${mode === m ? "bg-navy text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border text-xs font-semibold text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-r border-border bg-card px-2 py-1">{d}</div>)}
      </div>
      <div className={`grid flex-1 grid-cols-7 border-l border-border ${mode === "month" ? "auto-rows-fr" : ""}`}>
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = pieces.filter((p) => p.publishDate === key);
          return (
            <div key={key} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) updatePiece(id, { publishDate: key }); }}
              onDoubleClick={() => onAdd({ publishDate: key })}
              className={`group min-h-24 border-b border-r border-border p-1 ${isSameMonth(d, cursor) || mode === "week" ? "bg-card" : "bg-muted/50"}`}>
              <div className="flex items-center justify-between">
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${key === TODAY ? "bg-lime font-bold text-navy" : "text-muted-foreground"}`}>{format(d, "d")}</span>
                <button onClick={() => onAdd({ publishDate: key })} className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">+</button>
              </div>
              <div className="mt-1 space-y-1">
                {items.map((p) => {
                  const c = clusterColor(ws, p.cluster);
                  return <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)} onClick={() => onOpen(p.id)}
                    className="cursor-grab truncate rounded px-1.5 py-1 text-[11px] font-medium text-navy" style={{ background: `color-mix(in oklab, ${c} 25%, transparent)`, borderLeft: `3px solid ${c}` }}>{p.title}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Drag pieces between days to reschedule · double-click a day to add a piece</p>
    </div>
  );
}

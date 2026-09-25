import { useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CASE_STATUSES, PERMISSIONS, TIERS, isManager, newCaseId, useStore, type ClientCase, type Workspace } from "@/lib/store";
import { StatusPill } from "./ui";

const permColor: Record<string, string> = { "Not requested": "var(--st-idea)", Requested: "var(--st-drafted)", Granted: "var(--lime)", Denied: "var(--p0)" };
const inp = "w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function CaseBook({ ws, openCaseId, setOpenCaseId, onOpenPiece }: { ws: Workspace; openCaseId: string | null; setOpenCaseId: (id: string | null) => void; onOpenPiece: (id: string) => void }) {
  const s = useStore();
  const [mode, setMode] = useState<"table" | "permissions">("table");
  const [adding, setAdding] = useState(false);
  const cases = s.cases.filter((c) => c.workspaceIds.includes(ws.id) || mode === "table");
  const mine = cases.filter((c) => c.workspaceIds.includes(ws.id));
  const shared = cases.filter((c) => !c.workspaceIds.includes(ws.id));
  const canManage = isManager(s.me);
  const open = s.cases.find((c) => c.id === openCaseId);

  if (open) {
    const linked = s.pieces.filter((p) => p.caseIds.includes(open.id));
    const up = (patch: Partial<ClientCase>) => s.upsertCase({ ...open, ...patch });
    return (
      <div className="h-full overflow-y-auto p-6">
        <button onClick={() => setOpenCaseId(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-navy"><ArrowLeft className="size-4" /> Case Book</button>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <input disabled={!canManage} className="w-full bg-transparent text-3xl font-black text-navy outline-none" value={open.client} onChange={(e) => up({ client: e.target.value })} />
            <p className="text-sm text-muted-foreground">{open.industry} · {open.status} · {open.tier}</p>
            <blockquote className="rounded-xl border-l-8 border-lime bg-navy p-6 text-xl font-semibold italic text-primary-foreground">“{open.verbatim}”</blockquote>
            {(["story", "delivered", "learned"] as const).map((k) => (
              <div key={k}><h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">{k === "story" ? "The story" : k === "delivered" ? "What we delivered" : "What we learned"}</h3>
                <textarea disabled={!canManage} className={inp} rows={3} value={open[k]} onChange={(e) => up({ [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-2 text-sm font-bold text-navy">Permission</h3>
              <select disabled={!canManage} className="h-9 w-full rounded-md px-2 text-sm font-bold" style={{ background: permColor[open.permission], color: "var(--navy)" }} value={open.permission} onChange={(e) => up({ permission: e.target.value as ClientCase["permission"] })}>{PERMISSIONS.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-2 text-sm font-bold text-navy">Informs brands</h3>
              {s.workspaces.map((w) => <label key={w.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" disabled={!canManage} checked={open.workspaceIds.includes(w.id)} onChange={(e) => up({ workspaceIds: e.target.checked ? [...open.workspaceIds, w.id] : open.workspaceIds.filter((x) => x !== w.id) })} />{w.name}</label>)}</div>
            <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-2 text-sm font-bold text-navy">Linked pieces ({linked.length})</h3>
              <ul className="space-y-2">{linked.map((p) => <li key={p.id} onClick={() => onOpenPiece(p.id)} className="flex cursor-pointer items-center gap-2 text-sm hover:underline"><StatusPill status={p.status} approver={p.approver1 ?? p.approver2} className="h-5 min-w-16 text-[10px]" /><span className="truncate">{p.title}</span></li>)}</ul>
              <select className={inp + " mt-3"} value="" onChange={(e) => { const p = s.pieces.find((x) => x.id === e.target.value); if (p) s.updatePiece(p.id, { caseIds: [...p.caseIds, open.id] }, `linked case ${open.client} to “${p.title}”`); }}>
                <option value="">+ Link a content piece…</option>{s.pieces.filter((p) => !p.caseIds.includes(open.id) && open.workspaceIds.includes(p.workspaceId)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const Row = ({ c }: { c: ClientCase }) => (
    <tr onClick={() => setOpenCaseId(c.id)} className="cursor-pointer border-t border-border hover:bg-muted/40">
      <td className="px-3 py-2.5 font-semibold text-navy">{c.client}</td><td className="px-3 text-sm text-muted-foreground">{c.industry}</td>
      <td className="px-3 text-sm">{c.status}</td><td className="px-3 text-sm">{c.tier}</td>
      <td className="px-3"><span className="rounded-sm px-2 py-1 text-xs font-bold text-navy" style={{ background: permColor[c.permission] }}>{c.permission}</span></td>
      <td className="max-w-md truncate px-3 text-sm italic text-muted-foreground">“{c.verbatim}”</td>
      <td className="px-3 text-center text-sm">{s.pieces.filter((p) => p.caseIds.includes(c.id)).length}</td>
    </tr>
  );

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-md border border-border bg-card p-0.5">{(["table", "permissions"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1 text-xs font-semibold ${mode === m ? "bg-navy text-primary-foreground" : "text-muted-foreground"}`}>{m === "table" ? "All cases" : "Permission tracker"}</button>)}</div>
        {canManage && <Button size="sm" className="ml-auto" onClick={() => setAdding(true)}><Plus /> Add case</Button>}
      </div>
      {mode === "table" ? (
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Client", "Industry", "Status", "Tier", "Permission", "Verbatim", "Pieces"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{mine.map((c) => <Row key={c.id} c={c} />)}
              {shared.length > 0 && <tr><td colSpan={7} className="bg-muted/50 px-3 py-1.5 text-xs font-bold text-muted-foreground">Shared from other brands</td></tr>}
              {shared.map((c) => <Row key={c.id} c={c} />)}</tbody></table>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-4 gap-3">
          {PERMISSIONS.map((perm) => (
            <div key={perm} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const c = s.cases.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (c && canManage) s.upsertCase({ ...c, permission: perm }); }}
              className="rounded-lg bg-muted/60" style={{ borderTop: `4px solid ${permColor[perm]}` }}>
              <p className="px-3 py-2 text-sm font-bold text-navy">{perm}</p>
              <div className="space-y-2 px-2">{mine.filter((c) => c.permission === perm).map((c) => <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)} onClick={() => setOpenCaseId(c.id)} className="cursor-grab rounded-md border border-border bg-card p-3 shadow-sm"><p className="text-sm font-semibold text-navy">{c.client}</p><p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">“{c.verbatim}”</p></div>)}</div>
            </div>
          ))}
        </div>
      )}
      <AddCase open={adding} onClose={() => setAdding(false)} ws={ws} onCreated={setOpenCaseId} />
    </div>
  );
}

function AddCase({ open, onClose, ws, onCreated }: { open: boolean; onClose: () => void; ws: Workspace; onCreated: (id: string) => void }) {
  const { upsertCase } = useStore();
  const [f, setF] = useState({ client: "", industry: "", status: "Live", tier: "Project", verbatim: "", story: "" });
  const submit = () => {
    if (!f.client || !f.verbatim) return;
    const id = newCaseId();
    upsertCase({ id, ...f, permission: "Not requested", delivered: "", learned: "", workspaceIds: [ws.id] });
    setF({ client: "", industry: "", status: "Live", tier: "Project", verbatim: "", story: "" }); onClose(); onCreated(id);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent><DialogHeader><DialogTitle>Add client case</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <input className={inp} placeholder="Client name" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
          <input className={inp} placeholder="Industry" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
          <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{CASE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
          <select className={inp} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>{TIERS.map((x) => <option key={x}>{x}</option>)}</select>
          <textarea className={inp + " col-span-2 italic"} rows={2} placeholder="Verbatim customer language" value={f.verbatim} onChange={(e) => setF({ ...f, verbatim: e.target.value })} />
          <textarea className={inp + " col-span-2"} rows={3} placeholder="The story" value={f.story} onChange={(e) => setF({ ...f, story: e.target.value })} />
        </div>
        <Button onClick={submit}>Save case</Button>
      </DialogContent>
    </Dialog>
  );
}

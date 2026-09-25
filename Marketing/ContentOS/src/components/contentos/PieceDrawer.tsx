import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bold, Check, Italic, List, Heading2, Undo2, ArrowUpRight, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CHANNELS, FORMATS, PRIORITIES, STAGES, STATUSES, TIERS, VOICES, canApprove, hasRole, isOverdue, isReadOnly, permissionWarning, useStore, type Piece } from "@/lib/store";
import { ArticleEditor } from "./ArticleEditor";
import { Maximize2 } from "lucide-react";
import { Avatar, ClusterChip, DueTimeline, OverdueChip, StatusPill, statusVar } from "./ui";

const TABS = ["Details", "Brief", "Draft", "Cases", "Comments"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}
const inp = "w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function PieceDrawer({ id, onClose, onOpenCase }: { id: string | null; onClose: () => void; onOpenCase: (id: string) => void }) {
  const s = useStore();
  const p = s.pieces.find((x) => x.id === id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Details");
  const [comment, setComment] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => { setTab("Details"); setFull(false); }, [id]);
  useEffect(() => { if (tab === "Draft" && editor.current && p) editor.current.innerHTML = p.body; }, [tab, p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Sheet open={false} onOpenChange={onClose}><SheetContent /></Sheet>;
  const ws = s.workspaces.find((w) => w.id === p.workspaceId)!;
  const up = (patch: Partial<Piece>) => s.updatePiece(p.id, patch);
  const warn = permissionWarning(p, s.cases);
  const approver = canApprove(s.me);
  const isWriterRole = hasRole(s.me, "Writer") && !canApprove(s.me);
  const userSel = (key: "writer" | "designer" | "seo" | "approver2" | "approver1") => (
    <select className={inp} value={p[key] ?? ""} onChange={(e) => up({ [key]: e.target.value || null })}>
      {key === "approver1" && <option value="">— none (Tier 2 only)</option>}
      {s.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.roles.join(", ")}</option>)}
    </select>
  );
  const sendComment = (body = comment) => { if (!body.trim()) return; s.addComment(p.id, body); setComment(""); };

  if (full) return <ArticleEditor piece={p} onClose={() => setFull(false)} />;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-border p-5" style={{ borderTop: `6px solid ${statusVar[p.status]}` }}>
          <div className="mb-2 flex flex-wrap items-center gap-2 pr-8 text-xs text-muted-foreground"><span className="font-semibold">{ws.name}</span><ClusterChip ws={ws} cluster={p.cluster} />{isOverdue(p) && <OverdueChip />}<span className="font-mono">#{p.id}</span></div>
          <SheetTitle asChild><input className="w-full bg-transparent text-xl font-bold text-navy outline-none placeholder:text-destructive" placeholder="Title is required" value={p.title} onChange={(e) => up({ title: e.target.value })} onBlur={(e) => { if (!e.target.value.trim()) { up({ title: "Untitled piece" }); toast("A title is required"); } }} /></SheetTitle>
          <DueTimeline items={[{ label: "Draft due", date: p.draftDue }, { label: "Design due", date: p.designDue }, { label: "Publish", date: p.publishDate }]} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={p.status} onChange={(e) => up({ status: e.target.value as Piece["status"] })} disabled={isReadOnly(s.me)}
              className="h-8 cursor-pointer rounded-sm px-3 text-xs font-bold outline-none" style={{ background: statusVar[p.status], color: "var(--navy)" }}>
              {STATUSES.filter((st) => !isWriterRole || STATUSES.indexOf(st) <= 2 || st === p.status).map((st) => <option key={st}>{st}</option>)}
            </select>
            <Button size="sm" className="bg-lime font-bold text-navy hover:bg-lime/90" onClick={() => setFull(true)}><Maximize2 /> Open editor{(p.inline ?? []).filter((c) => !c.resolved).length > 0 && ` · ${(p.inline ?? []).filter((c) => !c.resolved).length} feedback`}</Button>
            {p.status === "Drafted" && <Button size="sm" onClick={() => { up({ status: "In Review" }); toast.success(`Sent to ${s.user(p.approver1 ?? p.approver2)?.name} for review`); }}><Send /> Submit for review</Button>}
            {p.status === "In Review" && approver && (<>
              <Button size="sm" className="bg-st-approved text-on-status hover:bg-st-approved/90" onClick={() => { up({ status: "Approved" }); toast.success("Approved"); }}><Check /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => { if (!comment.trim()) { setTab("Comments"); toast("Add a comment explaining the changes first"); return; } sendComment(`Changes requested: ${comment}`); up({ status: "Drafted" }); toast("Returned to Drafted with feedback"); }}><Undo2 /> Request changes</Button>
              {p.approver1 && isOverdue(p) && <Button size="sm" variant="destructive" onClick={() => { up({ approver1: null }); sendComment("Escalated to Marketing Lead — Tier 1 SLA breached"); toast("Escalated to Sakshi Nar"); }}><ArrowUpRight /> Escalate</Button>}
            </>)}
          </div>
          {warn.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-st-drafted bg-st-drafted/15 p-2.5 text-xs text-navy">
              <AlertTriangle className="size-4 shrink-0 text-st-drafted" />
              <span><b>Client permission not granted</b> for {warn.map((c) => `${c.client} (${c.permission})`).join(", ")}. Check before approving.</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 border-b border-border px-5">
          {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t ? "border-lime-deep text-navy" : "border-transparent text-muted-foreground"}`}>
            {t}{t === "Comments" && p.comments.length ? ` (${p.comments.length})` : ""}{t === "Cases" && p.caseIds.length ? ` (${p.caseIds.length})` : ""}</button>)}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "Details" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Field label="Public title"><input className={inp} value={p.publicTitle} onChange={(e) => up({ publicTitle: e.target.value })} /></Field></div>
              <Field label="Cluster"><select className={inp} value={p.cluster} onChange={(e) => up({ cluster: e.target.value })}>{ws.clusters.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Priority"><select className={inp} value={p.priority} onChange={(e) => up({ priority: e.target.value as Piece["priority"] })}>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Format"><select className={inp} value={p.format} onChange={(e) => up({ format: e.target.value })}>{FORMATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Decision stage"><select className={inp} value={p.stage} onChange={(e) => up({ stage: e.target.value })}>{STAGES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Revenue tier"><select className={inp} value={p.tier} onChange={(e) => up({ tier: e.target.value })}>{TIERS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Author voice"><select className={inp} value={p.voice} onChange={(e) => up({ voice: e.target.value, approver1: e.target.value === "Founder-signed" ? "u1" : p.approver1 })}>{VOICES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Draft due"><input type="date" className={inp} value={p.draftDue} onChange={(e) => up({ draftDue: e.target.value })} /></Field>
              <Field label="Design due"><input type="date" className={inp} value={p.designDue} onChange={(e) => up({ designDue: e.target.value })} /></Field>
              <Field label="Publish date"><input type="date" className={inp} value={p.publishDate} onChange={(e) => up({ publishDate: e.target.value })} /></Field>
              <Field label="Word count target"><input type="number" className={inp} value={p.wordCount} onChange={(e) => up({ wordCount: Number(e.target.value) })} /></Field>
              <Field label="Writer">{userSel("writer")}</Field>
              <Field label="Designer">{userSel("designer")}</Field>
              <Field label="SEO">{userSel("seo")}</Field>
              <Field label="Approver — Tier 2 (brand)">{userSel("approver2")}</Field>
              <Field label="Approver — Tier 1 (founder)">{userSel("approver1")}</Field>
              <div className="col-span-2"><Field label="Channels"><div className="flex flex-wrap gap-1.5">{CHANNELS.map((c) => { const on = p.channels.includes(c); return <button key={c} onClick={() => up({ channels: on ? p.channels.filter((x) => x !== c) : [...p.channels, c] })} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-navy bg-navy text-primary-foreground" : "border-border text-muted-foreground"}`}>{c}</button>; })}</div></Field></div>
              <div className="col-span-2"><Field label="Notes"><textarea className={inp} rows={3} value={p.notes} onChange={(e) => up({ notes: e.target.value })} /></Field></div>
            </div>
          )}
          {tab === "Brief" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3"><Field label="Primary keyword"><input className={inp + " font-mono"} value={p.keyword} onChange={(e) => up({ keyword: e.target.value })} /></Field></div>
              <Field label="UK search volume"><input type="number" className={inp + " font-mono"} value={p.volume} onChange={(e) => up({ volume: Number(e.target.value) })} /></Field>
              <Field label="Keyword difficulty"><input type="number" min={0} max={100} className={inp + " font-mono"} value={p.difficulty} onChange={(e) => up({ difficulty: Number(e.target.value) })} /></Field>
              <div />
              <div className="col-span-3"><Field label="Secondary keywords"><textarea className={inp + " font-mono"} rows={2} value={p.secondaryKeywords} onChange={(e) => up({ secondaryKeywords: e.target.value })} /></Field></div>
              <div className="col-span-3"><Field label="Customer language anchor"><textarea className={inp + " italic"} rows={2} value={p.anchor} onChange={(e) => up({ anchor: e.target.value })} /></Field></div>
              <div className="col-span-3"><Field label="Distribution mechanic"><textarea className={inp} rows={2} value={p.distribution} onChange={(e) => up({ distribution: e.target.value })} /></Field></div>
              <div className="col-span-3"><Field label="Repurposing plan"><textarea className={inp} rows={2} value={p.repurposing} onChange={(e) => up({ repurposing: e.target.value })} /></Field></div>
              <div className="col-span-3"><Field label="Success metric"><input className={inp} value={p.successMetric} onChange={(e) => up({ successMetric: e.target.value })} /></Field></div>
            </div>
          )}
          {tab === "Draft" && (
            <div className="flex gap-4">
              <div className="flex-1">
                <button onClick={() => setFull(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-lime bg-lime/10 p-3 text-sm font-semibold text-navy hover:bg-lime/20"><Maximize2 className="size-4" /> Open full-screen editor — upload, edit and comment on sections</button>
                <div className="mb-2 flex gap-1 rounded-md border border-border bg-muted p-1">
                  {[{ i: Bold, c: "bold" }, { i: Italic, c: "italic" }, { i: List, c: "insertUnorderedList" }].map(({ i: I, c }) => <button key={c} onMouseDown={(e) => { e.preventDefault(); document.execCommand(c); }} className="rounded p-1.5 hover:bg-card"><I className="size-4" /></button>)}
                  <button onMouseDown={(e) => { e.preventDefault(); document.execCommand("formatBlock", false, "h2"); }} className="rounded p-1.5 hover:bg-card"><Heading2 className="size-4" /></button>
                  <span className="ml-auto self-center pr-2 text-xs text-muted-foreground">Target {p.wordCount} words</span>
                </div>
                <div ref={editor} contentEditable suppressContentEditableWarning onBlur={(e) => up({ body: e.currentTarget.innerHTML })}
                  className="prose-draft min-h-96 rounded-md border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {p.caseIds.length > 0 && <aside className="w-52 shrink-0 space-y-2"><p className="text-[11px] font-semibold uppercase text-muted-foreground">Source material</p>
                {p.caseIds.map((cid) => { const c = s.cases.find((x) => x.id === cid); return c && <div key={cid} className="rounded-md border-l-4 border-lime bg-muted p-2 text-xs"><b className="text-navy">{c.client}</b><p className="mt-1 italic">“{c.verbatim}”</p></div>; })}</aside>}
            </div>
          )}
          {tab === "Cases" && (
            <div className="space-y-3">
              {p.caseIds.map((cid) => { const c = s.cases.find((x) => x.id === cid); if (!c) return null; return (
                <div key={cid} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2"><button onClick={() => onOpenCase(c.id)} className="font-bold text-navy hover:underline">{c.client}</button><span className="text-xs text-muted-foreground">{c.industry}</span>
                    <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${c.permission === "Granted" ? "bg-lime text-navy" : "bg-st-drafted text-navy"}`}>{c.permission}</span>
                    <button onClick={() => up({ caseIds: p.caseIds.filter((x) => x !== cid) })} className="text-muted-foreground"><X className="size-4" /></button></div>
                  <blockquote className="mt-2 border-l-4 border-lime pl-3 text-sm italic text-navy">“{c.verbatim}”</blockquote>
                  <p className="mt-2 text-sm text-muted-foreground">{c.story}</p>
                </div>); })}
              <Field label="Link a case"><select className={inp} value="" onChange={(e) => e.target.value && up({ caseIds: [...p.caseIds, e.target.value] })}>
                <option value="">Choose from the Case Book…</option>{s.cases.filter((c) => !p.caseIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.client} — {c.industry}</option>)}</select></Field>
            </div>
          )}
          {tab === "Comments" && (
            <div className="space-y-3">
              {p.comments.map((c) => <div key={c.id} className="flex gap-2"><Avatar id={c.author} size={28} /><div className="flex-1 rounded-lg bg-muted p-2.5"><p className="text-xs"><b className="text-navy">{s.user(c.author)?.name}</b> <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.at))} ago</span></p>
                <p className="mt-1 text-sm" dangerouslySetInnerHTML={{ __html: c.body.replace(/</g, "&lt;").replace(/@([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g, '<span class="font-semibold text-lime-deep">@$1</span>') }} /></div></div>)}
              <div className="flex gap-2"><Avatar id={s.currentUser} size={28} />
                <div className="flex-1"><textarea className={inp} rows={3} placeholder="Write a comment… use @Name to mention" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div className="mt-1 flex flex-wrap gap-1">{s.users.map((u) => <button key={u.id} onClick={() => setComment(comment + `@${u.name} `)} className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground hover:text-navy">@{u.name.split(" ")[0]}</button>)}</div>
                  <Button size="sm" className="mt-2" onClick={() => sendComment()}>Comment</Button></div></div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-5 py-2 text-xs text-muted-foreground"><StatusPill status={p.status} approver={p.approver1 ?? p.approver2} className="h-5 min-w-0" /> Writer <Avatar id={p.writer} size={18} /> · Approver <Avatar id={p.approver1 ?? p.approver2} size={18} /></div>
      </SheetContent>
    </Sheet>
  );
}

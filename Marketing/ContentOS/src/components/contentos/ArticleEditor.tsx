import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bold, Check, CheckCircle2, Heading1, Heading2, Heading3, History, Italic, Link2, List, ListOrdered, MessageSquarePlus, MessageSquare, Quote, RotateCcw, Send, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STATUSES, canApprove, isReadOnly, useStore, type InlineComment, type Piece } from "@/lib/store";
import { Avatar, StatusPill } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function fileToHtml(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
    return r.value;
  }
  const text = await f.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) return text;
  // txt / md: light markdown
  return text.split(/\n{2,}/).map((b) => {
    const t = b.trim(); if (!t) return "";
    if (t.startsWith("### ")) return `<h3>${esc(t.slice(4))}</h3>`;
    if (t.startsWith("## ")) return `<h2>${esc(t.slice(3))}</h2>`;
    if (t.startsWith("# ")) return `<h1>${esc(t.slice(2))}</h1>`;
    if (/^[-*] /m.test(t)) return `<ul>${t.split("\n").map((l) => `<li>${esc(l.replace(/^[-*] /, ""))}</li>`).join("")}</ul>`;
    return `<p>${esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

export function ArticleEditor({ piece: p, onClose }: { piece: Piece; onClose: () => void }) {
  const s = useStore();
  const ed = useRef<HTMLDivElement>(null);
  const saveT = useRef<number | undefined>(undefined);
  const pendingRange = useRef<Range | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const [words, setWords] = useState(0);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<"comments" | "general" | "history">("comments");
  const [showResolved, setShowResolved] = useState(false);
  const [general, setGeneral] = useState("");
  const inline = p.inline ?? [];
  const versions = p.versions ?? [];
  const readOnly = isReadOnly(s.me);
  const approver = canApprove(s.me);
  const up = (patch: Partial<Piece>) => s.updatePiece(p.id, patch);

  const count = () => setWords((ed.current?.innerText.trim().match(/\S+/g) ?? []).length);
  useEffect(() => { if (ed.current) { ed.current.innerHTML = p.body || "<h2>Introduction</h2><p>Start writing here…</p>"; count(); } }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // sync mark classes with comment state
  useEffect(() => {
    ed.current?.querySelectorAll("mark[data-c]").forEach((m) => {
      const c = inline.find((x) => x.id === m.getAttribute("data-c"));
      m.classList.toggle("is-resolved", !c || c.resolved);
      m.classList.toggle("is-active", m.getAttribute("data-c") === active);
    });
  }, [inline, active]);

  const save = (immediate = false) => {
    setSaved("saving"); window.clearTimeout(saveT.current);
    const run = () => { if (ed.current) up({ body: ed.current.innerHTML }); setSaved("saved"); };
    if (immediate) run(); else saveT.current = window.setTimeout(run, 700);
  };
  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); ed.current?.focus(); save(); count(); };

  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ed.current?.contains(sel.anchorNode)) { setBubble(null); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setBubble({ x: r.left + r.width / 2, y: r.top - 8 });
  };
  const startComment = () => {
    const sel = window.getSelection(); if (!sel || sel.isCollapsed) return;
    pendingRange.current = sel.getRangeAt(0).cloneRange();
    setPending(sel.toString()); setDraft(""); setBubble(null); setPanel("comments");
  };
  const submitComment = () => {
    const range = pendingRange.current; if (!range || !draft.trim() || !pending) return;
    const id = uid(); const mark = document.createElement("mark"); mark.setAttribute("data-c", id);
    mark.appendChild(range.extractContents()); range.insertNode(mark);
    const c: InlineComment = { id, quote: pending.slice(0, 160), author: s.currentUser, body: draft.trim(), at: now(), resolved: false, replies: [] };
    up({ inline: [...inline, c], body: ed.current?.innerHTML ?? p.body });
    setPending(null); setDraft(""); setActive(id); pendingRange.current = null;
    window.getSelection()?.removeAllRanges();
  };
  const patchC = (id: string, patch: Partial<InlineComment>) => up({ inline: inline.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const focusC = (id: string) => { setActive(id); ed.current?.querySelector(`mark[data-c="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const html = await fileToHtml(f);
      if (ed.current?.innerText.trim() && !confirm("Replace the current draft with this file? The current draft is saved in version history.")) return;
      const snap = { id: uid(), at: now(), author: s.currentUser, label: "Before upload", body: ed.current?.innerHTML ?? "" };
      if (ed.current) ed.current.innerHTML = html;
      up({ body: html, versions: [...versions, snap, { id: uid(), at: now(), author: s.currentUser, label: `Uploaded ${f.name}`, body: html }] });
      count(); toast.success(`Imported ${f.name}`);
    } catch { toast.error("Couldn't read that file. Try .docx, .txt, .md or .html"); }
  };
  const saveVersion = () => { const label = prompt("Name this version", `Version ${versions.length + 1}`); if (!label) return; up({ versions: [...versions, { id: uid(), at: now(), author: s.currentUser, label, body: ed.current?.innerHTML ?? "" }] }); toast.success("Version saved"); };
  const restore = (body: string) => { if (!confirm("Restore this version? Current text will be saved first.")) return; const cur = ed.current?.innerHTML ?? ""; if (ed.current) ed.current.innerHTML = body; up({ body, versions: [...versions, { id: uid(), at: now(), author: s.currentUser, label: "Auto-save before restore", body: cur }] }); count(); };

  const open = inline.filter((c) => !c.resolved);
  const shown = useMemo(() => (showResolved ? inline : open), [inline, open, showResolved]);
  const pct = Math.min(100, Math.round((words / Math.max(1, p.wordCount)) * 100));
  const tb = "rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-navy disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={() => { save(true); onClose(); }}><ArrowLeft /> Back</Button>
        <div className="min-w-0 flex-1">
          <input className="w-full truncate bg-transparent text-lg font-bold text-navy outline-none" value={p.title} onChange={(e) => up({ title: e.target.value })} readOnly={readOnly} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusPill status={p.status} approver={p.approver1 ?? p.approver2} className="h-5 min-w-0" /> Writer <Avatar id={p.writer} size={16} /> {s.user(p.writer)?.name}
            <span>·</span><span>{saved === "saving" ? "Saving…" : "All changes saved"}</span>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"><Upload className="size-4" /> Upload draft
          <input type="file" accept=".docx,.txt,.md,.html,.htm" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <Button variant="outline" size="sm" onClick={saveVersion}><History /> Save version</Button>
        {(p.status === "Drafted" || p.status === "Idea" || STATUSES.indexOf(p.status) < STATUSES.indexOf("In Review")) && <Button size="sm" onClick={() => { save(true); up({ status: "In Review" }); toast.success(`Sent to ${s.user(p.approver1 ?? p.approver2)?.name} for review`); }}><Send /> Submit for review</Button>}
        {p.status === "In Review" && approver && (<>
          <Button size="sm" className="bg-st-approved text-on-status hover:bg-st-approved/90" disabled={open.length > 0} title={open.length ? "Resolve open comments first" : ""} onClick={() => { up({ status: "Approved" }); toast.success("Approved"); }}><Check /> Approve</Button>
          <Button size="sm" variant="outline" onClick={() => { if (!open.length) { toast("Leave at least one comment on the text first"); return; } s.addComment(p.id, `Changes requested — ${open.length} open comment${open.length > 1 ? "s" : ""} in the draft`); up({ status: "Drafted" }); toast("Sent back to the writer"); }}><Undo2 /> Request changes</Button>
        </>)}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Document */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-muted">
          <div className="sticky top-0 z-10 flex justify-center border-b border-border bg-card/95 py-1.5 backdrop-blur">
            <div className="flex items-center gap-0.5">
              {[[Heading1, "formatBlock", "h1"], [Heading2, "formatBlock", "h2"], [Heading3, "formatBlock", "h3"]].map(([I, c, v], i) => { const Ic = I as typeof Bold; return <button key={i} title={`Heading ${i + 1}`} disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd(c as string, v as string); }} className={tb}><Ic className="size-4" /></button>; })}
              <span className="mx-1 h-5 w-px bg-border" />
              <button title="Bold" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} className={tb}><Bold className="size-4" /></button>
              <button title="Italic" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd("italic"); }} className={tb}><Italic className="size-4" /></button>
              <button title="Link" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); const u = prompt("Link URL"); if (u) cmd("createLink", u); }} className={tb}><Link2 className="size-4" /></button>
              <span className="mx-1 h-5 w-px bg-border" />
              <button title="Bullet list" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }} className={tb}><List className="size-4" /></button>
              <button title="Numbered list" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd("insertOrderedList"); }} className={tb}><ListOrdered className="size-4" /></button>
              <button title="Quote" disabled={readOnly} onMouseDown={(e) => { e.preventDefault(); cmd("formatBlock", "blockquote"); }} className={tb}><Quote className="size-4" /></button>
              <span className="mx-1 h-5 w-px bg-border" />
              <button title="Comment on selected text" onMouseDown={(e) => { e.preventDefault(); startComment(); }} className={`${tb} flex items-center gap-1 text-xs font-semibold`}><MessageSquarePlus className="size-4" /> Comment</button>
            </div>
          </div>
          <div className="mx-auto my-8 max-w-3xl rounded-lg bg-card px-16 py-12 shadow-sm">
            <div ref={ed} contentEditable={!readOnly} suppressContentEditableWarning spellCheck
              onInput={() => { save(); count(); }} onBlur={() => save(true)} onMouseUp={onMouseUp} onKeyUp={onMouseUp}
              onClick={(e) => { const m = (e.target as HTMLElement).closest("mark[data-c]"); if (m) { setActive(m.getAttribute("data-c")); setPanel("comments"); } }}
              className="prose-doc min-h-[60vh] outline-none" />
          </div>
          <p className="pb-10 text-center text-xs text-muted-foreground">Tip: highlight any sentence and click <b>Comment</b> to leave feedback on that exact section.</p>
        </div>

        {/* Side panel */}
        <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between text-xs"><span className="font-semibold text-navy">{words.toLocaleString()} / {p.wordCount.toLocaleString()} words</span><span className="text-muted-foreground">{pct}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="flex border-b border-border text-sm">
            {([["comments", `Feedback · ${open.length}`], ["general", `General · ${p.comments.length}`], ["history", `Versions · ${versions.length}`]] as const).map(([k, l]) =>
              <button key={k} onClick={() => setPanel(k)} className={`flex-1 border-b-2 py-2 ${panel === k ? "border-navy font-semibold text-navy" : "border-transparent text-muted-foreground"}`}>{l}</button>)}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {panel === "comments" && (<>
              {pending !== null && (
                <div className="rounded-lg border-2 border-lime p-3">
                  <p className="mb-2 border-l-4 border-lime pl-2 text-xs italic text-muted-foreground">“{pending.slice(0, 140)}”</p>
                  <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What should change here?" className="w-full rounded-md border border-input p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }} />
                  <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button><Button size="sm" onClick={submitComment} disabled={!draft.trim()}>Comment</Button></div>
                </div>
              )}
              {!pending && !shown.length && <div className="py-10 text-center text-sm text-muted-foreground"><MessageSquare className="mx-auto mb-2 size-8" />No open feedback.<br />Highlight text in the draft to comment.</div>}
              {shown.map((c) => (
                <div key={c.id} onClick={() => focusC(c.id)} className={`cursor-pointer rounded-lg border p-3 transition ${active === c.id ? "border-navy shadow-sm" : "border-border"} ${c.resolved ? "opacity-60" : ""}`}>
                  <p className="mb-2 line-clamp-2 border-l-4 border-lime pl-2 text-xs italic text-muted-foreground">“{c.quote}”</p>
                  {[{ id: c.id, author: c.author, body: c.body, at: c.at }, ...c.replies].map((r) => (
                    <div key={r.id} className="mb-2 flex gap-2"><Avatar id={r.author} size={22} /><div className="min-w-0 flex-1"><p className="text-xs"><b className="text-navy">{s.user(r.author)?.name}</b> <span className="text-muted-foreground">{formatDistanceToNow(new Date(r.at))} ago</span></p><p className="whitespace-pre-wrap text-sm">{r.body}</p></div></div>
                  ))}
                  {active === c.id && !c.resolved && (
                    <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input value={reply[c.id] ?? ""} onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })} placeholder="Reply…" className="flex-1 rounded-md border border-input px-2 py-1 text-sm outline-none"
                        onKeyDown={(e) => { if (e.key === "Enter" && reply[c.id]?.trim()) { patchC(c.id, { replies: [...c.replies, { id: uid(), author: s.currentUser, body: reply[c.id]!.trim(), at: now() }] }); setReply({ ...reply, [c.id]: "" }); } }} />
                    </div>
                  )}
                  <div className="mt-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    {c.resolved ? <button onClick={() => patchC(c.id, { resolved: false })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-navy"><RotateCcw className="size-3" /> Reopen</button>
                      : <button onClick={() => { patchC(c.id, { resolved: true }); toast.success("Marked as resolved"); }} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCircle2 className="size-3.5" /> Resolve</button>}
                  </div>
                </div>
              ))}
              {inline.some((c) => c.resolved) && <button onClick={() => setShowResolved(!showResolved)} className="w-full text-center text-xs text-muted-foreground hover:text-navy">{showResolved ? "Hide" : "Show"} resolved ({inline.filter((c) => c.resolved).length})</button>}
            </>)}
            {panel === "general" && (<>
              {p.comments.map((c) => <div key={c.id} className="flex gap-2"><Avatar id={c.author} size={24} /><div className="flex-1 rounded-lg bg-muted p-2"><p className="text-xs"><b className="text-navy">{s.user(c.author)?.name}</b> <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.at))} ago</span></p><p className="text-sm">{c.body}</p></div></div>)}
              <textarea rows={3} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Overall feedback on the article…" className="w-full rounded-md border border-input p-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button size="sm" disabled={!general.trim()} onClick={() => { s.addComment(p.id, general.trim()); setGeneral(""); }}>Post</Button>
            </>)}
            {panel === "history" && (<>
              {!versions.length && <p className="py-10 text-center text-sm text-muted-foreground">No saved versions yet. Use <b>Save version</b> before big edits.</p>}
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-md border border-border p-2.5">
                  <Avatar id={v.author} size={22} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy">{v.label}</p><p className="text-xs text-muted-foreground">{s.user(v.author)?.name} · {formatDistanceToNow(new Date(v.at))} ago</p></div>
                  {!readOnly && <Button size="sm" variant="ghost" onClick={() => restore(v.body)}>Restore</Button>}
                </div>
              ))}
            </>)}
          </div>
        </aside>
      </div>

      {bubble && (
        <button onMouseDown={(e) => { e.preventDefault(); startComment(); }} style={{ left: bubble.x, top: bubble.y }}
          className="fixed z-[70] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"><MessageSquarePlus className="size-3.5" /> Comment</button>
      )}
    </div>
  );
}

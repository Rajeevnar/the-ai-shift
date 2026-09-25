import { useMemo, useState } from "react";
import { Plus, Trash2, Clapperboard, LayoutGrid, Rows3, Table2, Upload, MessageSquare, Send, FileVideo, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isReadOnly, useStore, type Workspace } from "@/lib/store";

export const V_STATUSES = ["Idea", "Scripting", "Filming", "Editing", "In Review", "Scheduled", "Published"] as const;
export const V_FORMATS = ["Reel / Short", "Long-form", "Story", "Carousel video", "Live", "Testimonial", "Explainer"] as const;
export const V_PLATFORMS = ["LinkedIn", "Instagram", "TikTok", "YouTube", "YouTube Shorts", "Facebook", "X"] as const;
const ASPECTS = ["9:16", "1:1", "4:5", "16:9"] as const;

export interface Video {
  id: string; workspaceId: string; publishDate: string; publishTime: string; topic: string; title: string;
  format: string; platforms: string[]; aspect: string; duration: string; status: string;
  hook: string; script: string; shotList: string; onScreenText: string; caption: string; hashtags: string; cta: string;
  thumbnail: string; audio: string; subtitles: boolean; filmDate: string; editDue: string;
  scriptWriter: string | null; editor: string | null; assetsLink: string; notes: string;
  reviewer: string | null; deliverables: Deliverable[]; comments: VComment[];
}
export interface Deliverable { id: string; name: string; url: string; by: string; at: string; version: number; note: string }
export interface VComment { id: string; author: string; body: string; at: string; kind?: "comment" | "approved" | "changes" | "submitted" | undefined }

const uid = () => Math.random().toString(36).slice(2, 9);
const blank = (workspaceId: string, date: string): Video => ({
  id: uid(), workspaceId, publishDate: date, publishTime: "09:00", topic: "", title: "Untitled video", format: "Reel / Short",
  platforms: ["LinkedIn"], aspect: "9:16", duration: "30s", status: "Idea", hook: "", script: "", shotList: "", onScreenText: "",
  caption: "", hashtags: "", cta: "", thumbnail: "", audio: "", subtitles: true, filmDate: "", editDue: "",
  scriptWriter: null, editor: null, assetsLink: "", notes: "",
  reviewer: null, deliverables: [], comments: [],
});
export const SEED: Video[] = [
  { ...blank("w2", "2026-10-01"), id: "v1", title: "Do you need an app — or a PWA?", topic: "WEB DEVELOPMENT TRENDS IN THE UK — 2026", status: "Editing", platforms: ["LinkedIn", "Instagram"], duration: "45s",
    hook: "Your website doesn't always need a separate app.", script: "Open on phone installing a website from the browser.\nVO: Progressive Web Apps bring app-like experiences to the browser…\nThree benefits on screen.\nClose: Would your users actually benefit from one?",
    shotList: "1. Close-up phone, 'Add to home screen'\n2. Split screen: app store vs browser\n3. Presenter to camera — 3 benefits\n4. End card with logo", onScreenText: "01 | PROGRESSIVE WEB APPS\nInstallable • Fast • Works offline",
    caption: "Your website doesn't always need a separate app. Progressive Web Apps can bring app-like experiences to the browser.", hashtags: "#WebDevelopment #PWA #UKBusiness #RVSMedia", cta: "Explore web development with RVS Media: https://www.rvsmedia.co.uk/",
    thumbnail: "Presenter pointing at phone, text 'App or PWA?'", audio: "Light corporate beat, low under VO", filmDate: "2026-09-26", editDue: "2026-09-29", scriptWriter: "u3", editor: "u6", reviewer: "u2",
    deliverables: [{ id: "d1", name: "pwa-cut-v1.mp4", url: "", by: "u6", at: "2026-09-24T10:00", version: 1, note: "First cut, music placeholder" }],
    comments: [{ id: "c1", author: "u2", body: "Hook is great. Can we tighten shot 3 by 2 seconds?", at: "2026-09-24T12:30", kind: "changes" }] },
  { ...blank("w2", "2026-10-03"), id: "v2", title: "Your site goes down at 10pm. Who do you call?", topic: "Website support", status: "Scripting", format: "Reel / Short", platforms: ["LinkedIn", "TikTok"], duration: "20s",
    hook: "Your website goes down at 10pm. Who do you call?", onScreenText: "Developer? Hosting provider? IT team? No idea 😬", caption: "Most businesses don't think about support until something breaks.", hashtags: "#CloudHosting #WebsiteSupport #RVSMedia", cta: "Vote in the comments 👇", filmDate: "2026-09-29", editDue: "2026-10-01", scriptWriter: "u7" },
];

const STATUS_TONE: Record<string, string> = {
  Idea: "bg-muted text-muted-foreground", Scripting: "bg-secondary text-secondary-foreground", Filming: "bg-accent text-accent-foreground",
  Editing: "bg-accent text-accent-foreground", "In Review": "bg-primary/15 text-primary", Scheduled: "bg-lime text-navy", Published: "bg-navy text-primary-foreground",
};
const dayName = (d: string) => (d ? new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "long" }) : "—");
const fmt = (d: string) => (d ? new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

/** Best-practice checks shown on each video. */
function checks(v: Video) {
  return [
    { ok: v.hook.trim().length > 0 && v.hook.split(" ").length <= 14, label: "Hook in first 3 sec (≤14 words)" },
    { ok: !!v.cta.trim(), label: "Clear call to action" },
    { ok: v.subtitles, label: "Subtitles / captions burned in" },
    { ok: !!v.thumbnail.trim() || v.format === "Story", label: "Thumbnail / cover brief" },
    { ok: !(v.format === "Reel / Short" && v.aspect !== "9:16"), label: "Vertical 9:16 for short-form" },
    { ok: !(v.format === "Reel / Short" && parseInt(v.duration) > 90), label: "Short-form under 90s" },
    { ok: !!v.shotList.trim() || !!v.script.trim(), label: "Script or shot list ready" },
    { ok: !!v.editDue && !!v.publishDate && v.editDue < v.publishDate, label: "Edit due before publish date" },
  ];
}

export function VideoSchedule({ ws }: { ws: Workspace }) {
  const s = useStore();
  // Videos load and save with the rest of the workspace (see StoreProvider); fill in fields older rows lack.
  const videos = useMemo(() => s.videos.map((v) => ({ ...blank(v.workspaceId, v.publishDate), ...v })), [s.videos]);
  const setVideos = s.setVideos;
  const [mode, setMode] = useState<"schedule" | "table" | "sheet">("schedule");
  const [open, setOpen] = useState<string | null>(null);
  const [statusF, setStatusF] = useState("");

  const list = useMemo(() => videos.filter((v) => v.workspaceId === ws.id && (!statusF || v.status === statusF)).sort((a, b) => a.publishDate.localeCompare(b.publishDate)), [videos, ws.id, statusF]);
  const update = (id: string, patch: Partial<Video>) => setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const add = () => { const v = blank(ws.id, "2026-10-05"); setVideos((vs) => [...vs, v]); setOpen(v.id); };
  const current = videos.find((v) => v.id === open) ?? null;
  const name = (id: string | null) => s.users.find((u) => u.id === id)?.name ?? "Unassigned";

  const counts = V_STATUSES.map((st) => [st, videos.filter((v) => v.workspaceId === ws.id && v.status === st).length] as const);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border bg-card p-0.5">
          <button onClick={() => setMode("schedule")} className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${mode === "schedule" ? "bg-navy text-primary-foreground" : ""}`}><LayoutGrid className="size-4" /> Schedule</button>
          <button onClick={() => setMode("table")} className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${mode === "table" ? "bg-navy text-primary-foreground" : ""}`}><Table2 className="size-4" /> Table</button>
          <button onClick={() => setMode("sheet")} className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${mode === "sheet" ? "bg-navy text-primary-foreground" : ""}`}><Rows3 className="size-4" /> Sheet view</button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setStatusF("")} className={`rounded-full px-2.5 py-0.5 text-xs ${!statusF ? "bg-navy text-primary-foreground" : "bg-muted"}`}>All</button>
          {counts.map(([st, n]) => <button key={st} onClick={() => setStatusF(st)} className={`rounded-full px-2.5 py-0.5 text-xs ${statusF === st ? "bg-navy text-primary-foreground" : "bg-muted"}`}>{st} · {n}</button>)}
        </div>
        {!isReadOnly(s.me) && <Button className="ml-auto" onClick={add}><Plus /> Schedule video</Button>}
      </div>

      {list.length === 0 && <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><Clapperboard className="mx-auto mb-2 size-8" />No videos scheduled yet for {ws.name}.</div>}

      {mode === "schedule" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => {
            const c = checks(v); const done = c.filter((x) => x.ok).length;
            return (
              <button key={v.id} onClick={() => setOpen(v.id)} className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary">
                <div className="flex items-start gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-navy-deep py-1.5 text-primary-foreground">
                    <span className="text-[10px] uppercase">{dayName(v.publishDate).slice(0, 3)}</span><span className="text-lg font-black leading-none">{fmt(v.publishDate).split(" ")[0]}</span><span className="text-[10px]">{fmt(v.publishDate).split(" ")[1]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{v.topic || "No topic"}</p>
                    <p className="font-semibold leading-snug text-navy">{v.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_TONE[v.status]}`}>{v.status}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{v.format}</span><span className="rounded bg-muted px-1.5 py-0.5">{v.aspect} · {v.duration}</span>
                    </div>
                  </div>
                </div>
                {v.hook && <p className="mt-3 line-clamp-2 border-l-2 border-lime pl-2 text-sm italic">“{v.hook}”</p>}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{v.platforms.join(" · ")}</span>
                  <span className={done === c.length ? "font-semibold text-primary" : ""}>{done}/{c.length} best practices</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Edit: {name(v.editor)} · Review: {name(v.reviewer)} · {v.comments.length} comments</div>
              </button>
            );
          })}
        </div>
      )}

      {mode === "table" && list.length > 0 && (
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>
              {["Publish", "Title", "Status", "Type", "Platforms", "Editor", "Reviewer", "Edit due", "Latest upload", "Comments", "Checks"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((v) => { const c = checks(v); const last = v.deliverables[v.deliverables.length - 1]; const late = v.editDue && v.editDue < "2026-09-24" && !["Scheduled", "Published", "In Review"].includes(v.status); return (
                <tr key={v.id} className="border-t border-border hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2">{fmt(v.publishDate)} <span className="text-xs text-muted-foreground">{dayName(v.publishDate).slice(0, 3)}</span></td>
                  <td className="px-3 py-2"><button onClick={() => setOpen(v.id)} className="text-left font-semibold text-navy hover:underline">{v.title}</button><p className="text-[11px] text-muted-foreground">{v.topic}</p></td>
                  <td className="px-3 py-2"><select value={v.status} onChange={(e) => update(v.id, { status: e.target.value })} className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_TONE[v.status]}`}>{V_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{v.format}<br /><span className="text-muted-foreground">{v.aspect} · {v.duration}</span></td>
                  <td className="px-3 py-2 text-xs">{v.platforms.join(", ")}</td>
                  <td className="px-3 py-2"><select value={v.editor ?? ""} onChange={(e) => update(v.id, { editor: e.target.value || null })} className="rounded border border-input bg-background px-1 py-0.5 text-xs"><option value="">Unassigned</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td className="px-3 py-2"><select value={v.reviewer ?? ""} onChange={(e) => update(v.id, { reviewer: e.target.value || null })} className="rounded border border-input bg-background px-1 py-0.5 text-xs"><option value="">Unassigned</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs ${late ? "font-bold text-destructive" : ""}`}>{fmt(v.editDue)}{late && " · late"}</td>
                  <td className="px-3 py-2 text-xs">{last ? <>v{last.version} · {last.name}</> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-xs">{v.comments.length}</td>
                  <td className="px-3 py-2 text-xs">{c.filter((x) => x.ok).length}/{c.length}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      )}

      {mode === "sheet" && list.length > 0 && (
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
              {([
                ["Date to be Published", (v) => fmt(v.publishDate) + " · " + v.publishTime],
                ["Day", (v) => dayName(v.publishDate)],
                ["Topic", (v) => v.topic],
                ["Video Type", (v) => `${v.format} · ${v.aspect} · ${v.duration}`],
                ["Platforms", (v) => v.platforms.join(", ")],
                ["Status", (v) => v.status],
                ["Hook (first 3 sec)", (v) => v.hook],
                ["Script / Voiceover", (v) => v.script],
                ["Shot List", (v) => v.shotList],
                ["On-screen Text", (v) => v.onScreenText],
                ["Caption / Copy", (v) => v.caption],
                ["Hashtags", (v) => v.hashtags],
                ["CTA", (v) => v.cta],
                ["Thumbnail Brief", (v) => v.thumbnail],
                ["Music / Audio", (v) => v.audio],
                ["Film / Edit due", (v) => `${fmt(v.filmDate)} / ${fmt(v.editDue)}`],
                ["Owners", (v) => `Script: ${name(v.scriptWriter)}\nEdit: ${name(v.editor)}\nReview: ${name(v.reviewer)}`],
              ] as [string, (v: Video) => string][]).map(([label, get], i) => (
                <tr key={label} className={i < 2 ? "bg-secondary/60" : i === 2 ? "bg-accent/40" : ""}>
                  <th className="sticky left-0 w-48 border border-border bg-card px-3 py-2 text-left align-top font-semibold text-navy">{label}</th>
                  {list.map((v) => <td key={v.id} onClick={() => setOpen(v.id)} className="min-w-64 max-w-80 cursor-pointer whitespace-pre-wrap border border-border px-3 py-2 align-top hover:bg-muted/50">{get(v) || <span className="text-muted-foreground">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!current} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {current && <Editor v={current} users={s.users} me={s.currentUser} onChange={(p) => update(current.id, p)} onDelete={() => { setVideos((vs) => vs.filter((x) => x.id !== current.id)); setOpen(null); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-semibold text-navy">{label}</span>{children}{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function Editor({ v, users, me, onChange, onDelete }: { v: Video; users: { id: string; name: string }[]; me: string; onChange: (p: Partial<Video>) => void; onDelete: () => void }) {
  const c = checks(v);
  const T = (k: keyof Video, label: string, hint?: string, rows = 3) => <Field label={label} hint={hint}><Textarea rows={rows} value={v[k] as string} onChange={(e) => onChange({ [k]: e.target.value })} /></Field>;
  const [body, setBody] = useState(""); const [note, setNote] = useState("");
  const uname = (id: string | null) => users.find((u) => u.id === id)?.name ?? "Unassigned";
  const now = () => new Date().toISOString().slice(0, 16);
  const log = (kind: VComment["kind"], text: string, patch: Partial<Video> = {}) => onChange({ ...patch, comments: [...v.comments, { id: uid(), author: me, body: text, at: now(), kind }] });
  const upload = (f: File | undefined) => { if (!f) return; const version = v.deliverables.length + 1;
    onChange({ deliverables: [...v.deliverables, { id: uid(), name: f.name, url: URL.createObjectURL(f), by: me, at: now(), version, note }], status: v.status === "Idea" || v.status === "Scripting" || v.status === "Filming" ? "Editing" : v.status }); setNote(""); };
  const KIND: Record<string, string> = { approved: "Approved", changes: "Requested changes", submitted: "Submitted for review", comment: "" };
  return (
    <div className="space-y-5 pb-10">
      <SheetHeader><SheetTitle className="sr-only">Edit video</SheetTitle>
        <Input value={v.title} onChange={(e) => onChange({ title: e.target.value })} className="border-none px-0 text-xl font-black text-navy shadow-none focus-visible:ring-0" />
      </SheetHeader>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-2 flex items-center gap-1 text-xs font-bold text-navy">{c.every((x) => x.ok) ? <CheckCircle2 className="size-4 text-primary" /> : <AlertTriangle className="size-4 text-destructive" />} Best-practice checklist · {c.filter((x) => x.ok).length}/{c.length}</p>
        <div className="grid grid-cols-2 gap-1 text-xs">{c.map((x) => <span key={x.label} className={`flex items-center gap-1 ${x.ok ? "" : "text-muted-foreground"}`}>{x.ok ? <CheckCircle2 className="size-3.5 text-primary" /> : <Circle className="size-3.5" />}{x.label}</span>)}</div>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-3"><h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Edit &amp; review</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Video editor"><select className={sel} value={v.editor ?? ""} onChange={(e) => onChange({ editor: e.target.value || null })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Reviewer"><select className={sel} value={v.reviewer ?? ""} onChange={(e) => onChange({ reviewer: e.target.value || null })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-navy">Completed work</p>
          {v.deliverables.length === 0 && <p className="text-xs text-muted-foreground">Nothing uploaded yet.</p>}
          {[...v.deliverables].reverse().map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <FileVideo className="size-4 shrink-0" />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">v{d.version} · {d.name}</p><p className="text-muted-foreground">{uname(d.by)} · {d.at.replace("T", " ")}{d.note && ` · ${d.note}`}</p></div>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Open</a>}
            </div>
          ))}
          {d0(v) && <video src={d0(v)} controls className="w-full rounded-md bg-navy-deep" />}
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for this version (optional)" />
            <label className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-navy px-3 text-sm font-medium text-primary-foreground"><Upload className="size-4" /> Upload<input type="file" accept="video/*,image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!v.deliverables.length} onClick={() => log("submitted", `Submitted v${v.deliverables.length} for review to ${uname(v.reviewer)}`, { status: "In Review" })}><Send /> Submit for review</Button>
          <Button size="sm" disabled={v.status !== "In Review"} onClick={() => log("approved", "Approved — ready to schedule", { status: "Scheduled" })}><CheckCircle2 /> Approve</Button>
          <Button size="sm" variant="outline" disabled={v.status !== "In Review"} onClick={() => { const t = prompt("What needs changing?"); if (t) log("changes", t, { status: "Editing" }); }}>Request changes</Button>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-navy"><MessageSquare className="size-3.5" /> Comments · {v.comments.length}</p>
          {v.comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-2 text-xs">
              <p><span className="font-semibold">{uname(c.author)}</span> <span className="text-muted-foreground">{c.at.replace("T", " ")}</span>{c.kind && KIND[c.kind] && <span className={`ml-1 rounded px-1 ${c.kind === "approved" ? "bg-lime text-navy" : c.kind === "changes" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{KIND[c.kind]}</span>}</p>
              <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          <div className="flex gap-2"><Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave feedback, e.g. 0:12 — cut the pause here" />
            <Button size="sm" disabled={!body.trim()} onClick={() => { log("comment", body.trim()); setBody(""); }}>Post</Button></div>
        </div>
      </section>

      <section className="space-y-3"><h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date to be published" hint={dayName(v.publishDate)}><Input type="date" value={v.publishDate} onChange={(e) => onChange({ publishDate: e.target.value })} /></Field>
          <Field label="Time" hint="Post when your audience is active"><Input type="time" value={v.publishTime} onChange={(e) => onChange({ publishTime: e.target.value })} /></Field>
          <Field label="Status"><select className={sel} value={v.status} onChange={(e) => onChange({ status: e.target.value })}>{V_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Filming date"><Input type="date" value={v.filmDate} onChange={(e) => onChange({ filmDate: e.target.value })} /></Field>
          <Field label="Edit due"><Input type="date" value={v.editDue} onChange={(e) => onChange({ editDue: e.target.value })} /></Field>
          <Field label="Topic / series"><Input value={v.topic} onChange={(e) => onChange({ topic: e.target.value })} /></Field>
          <Field label="Script writer"><select className={sel} value={v.scriptWriter ?? ""} onChange={(e) => onChange({ scriptWriter: e.target.value || null })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Editor (also above)"><select className={sel} value={v.editor ?? ""} onChange={(e) => onChange({ editor: e.target.value || null })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
      </section>

      <section className="space-y-3"><h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Format</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Video type"><select className={sel} value={v.format} onChange={(e) => onChange({ format: e.target.value })}>{V_FORMATS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Aspect ratio" hint="9:16 for Reels, Shorts, TikTok"><select className={sel} value={v.aspect} onChange={(e) => onChange({ aspect: e.target.value })}>{ASPECTS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Length" hint="Short-form: 15–60s works best"><Input value={v.duration} onChange={(e) => onChange({ duration: e.target.value })} /></Field>
        </div>
        <Field label="Platforms"><div className="flex flex-wrap gap-1.5">{V_PLATFORMS.map((p) => { const on = v.platforms.includes(p); return <button type="button" key={p} onClick={() => onChange({ platforms: on ? v.platforms.filter((x) => x !== p) : [...v.platforms, p] })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-navy bg-navy text-primary-foreground" : "border-border"}`}>{p}</button>; })}</div></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.subtitles} onChange={(e) => onChange({ subtitles: e.target.checked })} /> Subtitles burned in (most people watch on mute)</label>
      </section>

      <section className="space-y-3"><h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Creative</h3>
        {T("hook", "Hook — first 3 seconds", "One punchy line or visual that stops the scroll", 2)}
        {T("script", "Script / voiceover", "Keep one idea per video", 6)}
        {T("shotList", "Shot list / storyboard", "Number each shot: framing, action, B-roll", 5)}
        {T("onScreenText", "On-screen text", "Short, readable, kept inside safe zones", 3)}
        {T("thumbnail", "Thumbnail / cover brief", "Face + 3–5 word title reads best", 2)}
        {T("audio", "Music / audio", "Use licensed or platform-trending audio", 2)}
      </section>

      <section className="space-y-3"><h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Publishing copy</h3>
        {T("caption", "Caption / copy", "First line matters most — it shows before 'see more'", 5)}
        {T("hashtags", "Hashtags", "3–5 relevant hashtags", 2)}
        {T("cta", "Call to action", "Tell viewers exactly what to do next", 2)}
        <Field label="Raw footage / assets link"><Input value={v.assetsLink} placeholder="Drive or Frame.io link" onChange={(e) => onChange({ assetsLink: e.target.value })} /></Field>
        {T("notes", "Notes", undefined, 2)}
      </section>

      <Button variant="outline" className="text-destructive" onClick={() => { if (confirm("Delete this video?")) onDelete(); }}><Trash2 /> Delete video</Button>
    </div>
  );
}

const d0 = (v: Video) => { const l = v.deliverables[v.deliverables.length - 1]; return l && l.url.startsWith("blob:") && /\.(mp4|mov|webm|m4v)$/i.test(l.name) ? l.url : ""; };

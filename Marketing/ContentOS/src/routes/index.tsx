import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, BookOpen, CalendarDays, GanttChart, Kanban, LayoutDashboard, Plus, Search, Star, Table2, Users, FileText, Clapperboard, LogOut, KeyRound, ArrowLeft, Settings } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoreProvider, canApprove, hasRole, isManager, isOverdue, useStore, type Piece } from "@/lib/store";
import { getMe, logout, openMerchant, type Me } from "@/lib/auth.functions";
import { ChangePasswordDialog } from "@/components/contentos/Account";
import { BoardView } from "@/components/contentos/BoardView";
import { CalendarView } from "@/components/contentos/CalendarView";
import { TimelineView } from "@/components/contentos/TimelineView";
import { TableView, SAVED_VIEWS, applySavedView, type SavedView } from "@/components/contentos/TableView";
import { DashboardView } from "@/components/contentos/DashboardView";
import { PieceDrawer } from "@/components/contentos/PieceDrawer";
import { CaseBook } from "@/components/contentos/CaseBook";
import { Team } from "@/components/contentos/Team";
import { CommandMenu } from "@/components/contentos/CommandMenu";
import { Avatar } from "@/components/contentos/ui";
import { VideoSchedule } from "@/components/contentos/VideoSchedule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContentOS — Multi-brand content planning" },
      { name: "description", content: "Plan, approve and publish content across every brand, with client stories linked to every piece." },
      { property: "og:title", content: "ContentOS — Multi-brand content planning" },
      { property: "og:description", content: "Board, calendar, timeline, table and dashboard views for your content pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const me = await getMe();
    if (!me || me.mustChangePassword) throw redirect({ to: "/login" });
    if (me.isOwner && !me.merchant) throw redirect({ to: "/owner" });
    return { me };
  },
  component: Home,
});

function Home() {
  const { me } = Route.useRouteContext();
  return <StoreProvider><App auth={me} /></StoreProvider>;
}

const VIEWS = [
  { id: "board", label: "Board", icon: Kanban }, { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timeline", label: "Timeline", icon: GanttChart }, { id: "table", label: "Table", icon: Table2 }, { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;
type View = (typeof VIEWS)[number]["id"];
type Section = "content" | "video" | "cases" | "team";

function App({ auth }: { auth: Me }) {
  const s = useStore();
  const [pwOpen, setPwOpen] = useState(false);
  const [wsId, setWsId] = useState("w1");
  const [section, setSection] = useState<Section>("content");
  const [pendingAdd, setPendingAdd] = useState<Partial<Piece> | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [view, setView] = useState<View>("board");
  const [saved, setSaved] = useState<SavedView>("All pieces");
  const [writerF, setWriterF] = useState("");
  const [clusterF, setClusterF] = useState("");
  const [prioF, setPrioF] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [cmd, setCmd] = useState(false);
  const ws = s.workspaces.find((w) => w.id === wsId) ?? s.workspaces[0];

  const pieces = useMemo(() => {
    if (!ws) return [];
    let list = s.pieces.filter((p) => p.workspaceId === ws.id);
    list = applySavedView(saved, list, s.currentUser, canApprove(s.me));
    if (writerF) list = list.filter((p) => p.writer === writerF);
    if (clusterF) list = list.filter((p) => p.cluster === clusterF);
    if (prioF) list = list.filter((p) => p.priority === prioF);
    return list;
  }, [s.pieces, ws?.id, saved, writerF, clusterF, prioF, s.currentUser, s.me]);

  const notifications = useMemo(() => {
    const mine = s.pieces.filter((p) => p.status === "In Review" && (p.approver1 === s.currentUser || (!p.approver1 && p.approver2 === s.currentUser)));
    const overdue = isManager(s.me) ? s.pieces.filter(isOverdue) : [];
    const mentions = s.pieces.filter((p) => p.comments.some((c) => c.body.includes(`@${s.me.name}`) && c.author !== s.currentUser));
    return [...mine.map((p) => ({ p, t: "awaits your approval" })), ...overdue.map((p) => ({ p, t: "is overdue" })), ...mentions.map((p) => ({ p, t: "— you were mentioned" }))];
  }, [s.pieces, s.currentUser, s.me]);

  const signOut = async () => { await logout(); window.location.href = "/login"; };
  const backToConsole = async () => { await openMerchant({ data: { merchantId: null } }); window.location.href = "/owner"; };

  if (!ws) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-center">
      <p className="text-2xl font-black text-navy">No workspaces yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">You haven't been given access to any workspace in {auth.merchant?.name}. Ask your Admin or Marketing Lead to add you.</p>
      <Button variant="outline" onClick={signOut}><LogOut /> Sign out</Button>
    </div>
  );

  const canCreate = hasRole(s.me, "Admin", "Marketing Lead", "Writer", "SEO", "Social");
  const add = (patch: Partial<Piece>) => {
    if (!canCreate) return;
    setNewTitle(""); setPendingAdd(patch);
  };
  const confirmAdd = () => {
    const title = newTitle.trim();
    if (!title || !pendingAdd) return;
    const p = s.addPiece({ workspaceId: ws.id, ...pendingAdd, title });
    setPendingAdd(null); setOpenId(p.id);
  };
  const switchWs = (id: string) => { setWsId(id); setCaseId(null); setClusterF(""); };
  const favs = [...s.workspaces].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));
  const pieceProps = { pieces, ws, onOpen: setOpenId, onAdd: add };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col bg-navy-deep text-primary-foreground">
        <div className="flex items-center gap-2 px-4 py-4"><span className="flex size-8 items-center justify-center rounded-lg bg-lime font-black text-navy">C</span><span className="text-lg font-black tracking-tight">ContentOS</span></div>
        <button onClick={() => setCmd(true)} className="mx-3 mb-3 flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-2 text-sm text-primary-foreground/70 hover:bg-primary-foreground/15"><Search className="size-4" /> Search <kbd className="ml-auto rounded bg-primary-foreground/10 px-1.5 text-[10px]">⌘K</kbd></button>
        <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">Workspaces</p>
        <nav className="space-y-0.5 px-2">
          {favs.map((w) => {
            const n = s.pieces.filter((p) => p.workspaceId === w.id && p.status === "In Review").length;
            return (
              <div key={w.id} className={`group flex items-center gap-2 rounded-md px-2 py-1.5 ${w.id === ws.id ? "bg-primary-foreground/15" : "hover:bg-primary-foreground/5"}`}>
                <button onClick={() => switchWs(w.id)} className="flex flex-1 items-center gap-2 text-left text-sm">
                  <span className="flex size-6 items-center justify-center rounded text-[10px] font-black text-navy" style={{ background: w.color }}>{w.short}</span>
                  <span className="flex-1 truncate">{w.name}</span>
                  {n > 0 && <span className="rounded-full bg-lime px-1.5 text-[10px] font-bold text-navy">{n}</span>}
                </button>
                <button onClick={() => s.toggleFav(w.id)} className={w.favourite ? "text-lime" : "text-primary-foreground/30 opacity-0 group-hover:opacity-100"}><Star className="size-3.5" fill={w.favourite ? "currentColor" : "none"} /></button>
              </div>
            );
          })}
          {hasRole(s.me, "Admin") && <button onClick={() => { const n = prompt("New workspace (client brand) name"); if (n) s.addWorkspace(n); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary-foreground/60 hover:bg-primary-foreground/5"><Plus className="size-4" /> New workspace</button>}
        </nav>
        <p className="mt-5 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">{ws.name}</p>
        <nav className="space-y-0.5 px-2">
          {([["content", "Content", FileText], ["video", "Video", Clapperboard], ["cases", "Client Case Book", BookOpen], ["team", "Team", Users]] as const).map(([id, label, I]) => (
            <button key={id} onClick={() => { setSection(id); setCaseId(null); }} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${section === id ? "bg-lime font-semibold text-navy" : "hover:bg-primary-foreground/5"}`}><I className="size-4" />{label}</button>
          ))}
        </nav>
        <div className="mt-auto border-t border-primary-foreground/10 p-3">
          {auth.actingAsOwner && <button onClick={backToConsole} className="mb-3 flex w-full items-center justify-center gap-1 rounded-md bg-lime px-2 py-1.5 text-xs font-bold text-navy hover:bg-lime/90"><ArrowLeft className="size-3.5" /> Back to owner console</button>}
          <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">{auth.merchant?.name}</p>
          <div className="flex items-center gap-2"><Avatar id={s.currentUser} size={28} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.me.name}</p><p className="truncate text-[11px] text-primary-foreground/60">{s.me.roles.join(" · ")}</p></div>
            <Popover><PopoverTrigger asChild><button title="Account" className="rounded p-1 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"><Settings className="size-4" /></button></PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-52 p-1">
                <p className="truncate px-2 py-1 text-xs text-muted-foreground">{auth.email}</p>
                <button onClick={() => setPwOpen(true)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><KeyRound className="size-4" /> Change password</button>
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><LogOut className="size-4" /> Sign out</button>
              </PopoverContent></Popover>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card">
          <div className="flex items-center gap-3 px-5 pt-4">
            <span className="flex size-9 items-center justify-center rounded-lg text-sm font-black text-navy" style={{ background: ws.color }}>{ws.short}</span>
            <div><h1 className="text-xl font-black leading-tight text-navy">{section === "content" ? ws.name : section === "video" ? `${ws.name} · Video` : section === "cases" ? "Client Case Book" : "Team"}</h1><p className="text-xs text-muted-foreground">{ws.tagline}</p></div>
            <div className="ml-auto flex items-center gap-2">
              <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" className="relative"><Bell />{notifications.length > 0 && <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{notifications.length}</span>}</Button></PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-2"><p className="px-2 py-1 text-xs font-bold text-muted-foreground">Notifications for {s.me.name}</p>
                  {notifications.length ? notifications.slice(0, 12).map(({ p, t }, i) => <button key={p.id + i} onClick={() => { switchWs(p.workspaceId); setSection("content"); setOpenId(p.id); }} className="block w-full rounded p-2 text-left text-sm hover:bg-muted"><b className="text-navy">{p.title}</b> <span className="text-muted-foreground">{t}</span></button>) : <p className="p-2 text-sm text-muted-foreground">All caught up.</p>}
                </PopoverContent></Popover>
              {section === "content" && canCreate && <Button onClick={() => add({})} className="bg-lime font-bold text-navy hover:bg-lime/90"><Plus /> New piece</Button>}
            </div>
          </div>
          {section === "content" && (<>
            <div className="mt-3 flex gap-1 px-5">
              {VIEWS.map(({ id, label, icon: I }) => <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${view === id ? "border-lime-deep text-navy" : "border-transparent text-muted-foreground hover:text-navy"}`}><I className="size-4" />{label}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-5 py-2">
              <select value={saved} onChange={(e) => setSaved(e.target.value as SavedView)} className="h-8 rounded-md border border-border bg-card px-2 text-xs font-semibold text-navy">{SAVED_VIEWS.map((v) => <option key={v}>{v}</option>)}</select>
              <select value={writerF} onChange={(e) => setWriterF(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs"><option value="">All writers</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <select value={clusterF} onChange={(e) => setClusterF(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs"><option value="">All clusters</option>{ws.clusters.map((c) => <option key={c}>{c}</option>)}</select>
              <select value={prioF} onChange={(e) => setPrioF(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs"><option value="">All priorities</option>{["P0", "P1", "P2"].map((c) => <option key={c}>{c}</option>)}</select>
              {(saved !== "All pieces" || writerF || clusterF || prioF) && <button onClick={() => { setSaved("All pieces"); setWriterF(""); setClusterF(""); setPrioF(""); }} className="text-xs text-muted-foreground underline">Clear</button>}
              <span className="ml-auto text-xs text-muted-foreground">{pieces.length} pieces</span>
            </div>
          </>)}
        </header>
        <div className="min-h-0 flex-1">
          {section === "content" && view === "board" && <BoardView {...pieceProps} />}
          {section === "content" && view === "calendar" && <CalendarView {...pieceProps} />}
          {section === "content" && view === "timeline" && <TimelineView {...pieceProps} />}
          {section === "content" && view === "table" && <TableView {...pieceProps} />}
          {section === "content" && view === "dashboard" && <DashboardView {...pieceProps} />}
          {section === "cases" && <CaseBook ws={ws} openCaseId={caseId} setOpenCaseId={setCaseId} onOpenPiece={setOpenId} />}
          {section === "team" && <Team ws={ws} />}
          {section === "video" && <VideoSchedule ws={ws} />}
        </div>
      </main>

      <PieceDrawer id={openId} onClose={() => setOpenId(null)} onOpenCase={(id) => { setOpenId(null); setSection("cases"); setCaseId(id); }} />
      <Dialog open={!!pendingAdd} onOpenChange={(o) => !o && setPendingAdd(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New piece</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); confirmAdd(); }} className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title <span className="text-destructive">*</span>
              <input autoFocus required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. How to choose a Shopify agency"
                className="mt-1 w-full rounded-md border border-input bg-card px-2.5 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring" /></label>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setPendingAdd(null)}>Cancel</Button>
              <Button type="submit" disabled={!newTitle.trim()} className="bg-lime font-bold text-navy hover:bg-lime/90">Create piece</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CommandMenu open={cmd} setOpen={setCmd} onPiece={(w, id) => { switchWs(w); setSection("content"); setOpenId(id); }} onCase={(id) => { setSection("cases"); setCaseId(id); }} onWorkspace={(id) => { switchWs(id); setSection("content"); }} onTeam={() => setSection("team")} />
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <Toaster />
    </div>
  );
}

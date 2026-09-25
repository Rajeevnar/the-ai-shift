import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode, type Context } from "react";
import { toast } from "sonner";
import { loadAll, saveChanges } from "@/lib/data.functions";
import { ROLES, type Role } from "@/lib/roles";
import type { Video } from "@/components/contentos/VideoSchedule";

export const STATUSES = ["Idea", "Drafted", "In Review", "Approved", "Scheduled", "Published"] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ["P0", "P1", "P2"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const STAGES = ["Awareness", "Consideration", "Decision"] as const;
export const TIERS = ["Entry", "Retainer", "Project", "Brand-only"] as const;
export const VOICES = ["Company", "Founder-signed", "Named team member"] as const;
export const FORMATS = ["Article", "Case Study", "Product Page", "Framework", "Comparison", "Video Script", "Carousel", "Interactive Tool"] as const;
export const CHANNELS = ["eCommerceXcellence Blog", "RVS Media Blog", "LinkedIn Company", "LinkedIn Personal", "Newsletter"] as const;
export { ROLES, type Role };
export const CASE_STATUSES = ["Won", "Lost", "Live", "Prospect", "Signal"] as const;
export const PERMISSIONS = ["Not requested", "Requested", "Granted", "Denied"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const CLUSTER_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

export interface Workspace { id: string; name: string; short: string; color: string; tagline: string; clusters: string[]; favourite?: boolean }
/** `role` is the primary role (first of `roles`), kept for display. */
export interface User { id: string; name: string; initials: string; role: Role; roles: Role[]; fn: string; color: string }
export interface Comment { id: string; author: string; body: string; at: string }
export interface InlineComment { id: string; quote: string; author: string; body: string; at: string; resolved: boolean; replies: Comment[] }
export interface Version { id: string; at: string; author: string; label: string; body: string }
export interface Activity { id: string; workspaceId: string; actor: string; text: string; at: string }
export interface Piece {
  id: string; workspaceId: string; title: string; publicTitle: string; cluster: string;
  stage: string; tier: string; voice: string; writer: string; designer: string; seo: string;
  approver1: string | null; approver2: string; status: Status; publishDate: string;
  draftDue: string; designDue: string; channels: string[]; format: string; wordCount: number;
  keyword: string; secondaryKeywords: string; volume: number; difficulty: number; priority: Priority;
  anchor: string; caseIds: string[]; distribution: string; repurposing: string; successMetric: string;
  notes: string; body: string; reviewSince: string | null; comments: Comment[];
  inline?: InlineComment[] | undefined; versions?: Version[] | undefined;
}
export interface ClientCase {
  id: string; client: string; industry: string; status: string; tier: string; permission: Permission;
  verbatim: string; story: string; delivered: string; learned: string; workspaceIds: string[];
}

export const TODAY = "2026-09-24";
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export { addDays };

const USERS: User[] = ([
  { id: "u1", name: "Rajeev Nar", initials: "RN", role: "Admin", fn: "Founder — Tier 1 approvals", color: "var(--c3)" },
  { id: "u2", name: "Sakshi Nar", initials: "SN", role: "Marketing Lead", fn: "Head of Marketing — Tier 2 approvals", color: "var(--c1)" },
  { id: "u3", name: "Tarun", initials: "TA", role: "Writer", fn: "Content writer", color: "var(--c2)" },
  { id: "u4", name: "Ashish", initials: "AS", role: "SEO", fn: "SEO lead", color: "var(--c4)" },
  { id: "u5", name: "Sakshi Chauhan", initials: "SC", role: "SEO", fn: "SEO support", color: "var(--c5)" },
  { id: "u6", name: "Balwinder", initials: "BA", role: "Designer", fn: "Design lead", color: "var(--c6)" },
  { id: "u7", name: "Shreesha", initials: "SH", role: "Social", fn: "Social media", color: "var(--c2)" },
  { id: "u8", name: "Chhavi", initials: "CH", role: "Admin", fn: "Project lead — publishing ops", color: "var(--c4)" },
] as Omit<User, "roles">[]).map((u) => ({ ...u, roles: [u.role] }));

const WORKSPACES: Workspace[] = [
  { id: "w1", name: "eCommerceXcellence", short: "EX", color: "var(--lime)", tagline: "Customer-facing brand", clusters: ["Shopify Growth", "Conversion", "Replatforming", "Retention"], favourite: true },
  { id: "w2", name: "RVS Media", short: "RV", color: "var(--c3)", tagline: "Delivery entity", clusters: ["Delivery", "Culture", "Process"] },
  { id: "w3", name: "Velocity AI", short: "VA", color: "var(--c1)", tagline: "AI development division", clusters: ["AI Agents", "Automation", "Case Studies"] },
  { id: "w4", name: "The AI Shift", short: "AI", color: "var(--c5)", tagline: "Rajeev's newsletter", clusters: ["Essays", "Tools", "Interviews"] },
];

const CASES: ClientCase[] = [
  { id: "c1", client: "Northbrook Outdoor", industry: "Outdoor retail", status: "Won", tier: "Retainer", permission: "Granted", verbatim: "We were losing a third of mobile shoppers at checkout and nobody could tell us why.", story: "Mid-size outdoor retailer on Magento 1 needing a faster, mobile-first store before peak season.", delivered: "Shopify Plus replatform, custom checkout extensions, 11-week delivery.", learned: "Checkout speed matters more than design polish for this segment.", workspaceIds: ["w1", "w2"] },
  { id: "c2", client: "Anonymised — Beauty DTC", industry: "Beauty", status: "Live", tier: "Project", permission: "Not requested", verbatim: "Our agency keeps sending reports. We just want more repeat customers.", story: "DTC skincare brand plateaued at 18% repeat rate.", delivered: "Retention programme: flows, loyalty, subscription.", learned: "Founders want outcomes, not dashboards.", workspaceIds: ["w1"] },
  { id: "c3", client: "Hale & Co", industry: "Homeware", status: "Won", tier: "Entry", permission: "Requested", verbatim: "I didn't know we were allowed to ask for this much.", story: "Small homeware brand, first proper CRO audit.", delivered: "CRO audit + 6 quick wins, +22% CVR.", learned: "Entry work converts to retainers when wins are visible.", workspaceIds: ["w1"] },
  { id: "c4", client: "Fleetline Logistics", industry: "Logistics", status: "Live", tier: "Project", permission: "Granted", verbatim: "Our ops team spent four hours a day copying data between systems.", story: "B2B logistics firm drowning in manual order entry.", delivered: "AI agent reading emails into their TMS.", learned: "Agents sell on hours saved, not on AI.", workspaceIds: ["w3", "w4"] },
  { id: "c5", client: "Anonymised — Fashion", industry: "Fashion", status: "Lost", tier: "Retainer", permission: "Denied", verbatim: "You're more expensive but I believe you. The board doesn't.", story: "Lost on price to an offshore agency.", delivered: "Pitch + discovery only.", learned: "Need board-ready ROI material.", workspaceIds: ["w1"] },
  { id: "c6", client: "Brightwell Foods", industry: "Food & drink", status: "Prospect", tier: "Project", permission: "Not requested", verbatim: "Everyone says AI. Show me one thing it does for a food brand.", story: "Inbound prospect sceptical of AI claims.", delivered: "—", learned: "Concrete demos beat decks.", workspaceIds: ["w3", "w4"] },
];

type Seed = [string, string, Status, number, Priority, string, string, string, string[]];
const PIECE_SEED: Record<string, Seed[]> = {
  w1: [
    ["Shopify Plus vs Magento: the honest 2026 comparison", "Replatforming", "Published", -6, "P0", "Comparison", "u3", "shopify plus vs magento", ["c1"]],
    ["Why your mobile checkout leaks a third of shoppers", "Conversion", "Scheduled", 4, "P0", "Article", "u3", "mobile checkout abandonment", ["c1", "c3"]],
    ["The 11-week replatform: Northbrook case study", "Replatforming", "In Review", 9, "P0", "Case Study", "u3", "shopify replatform case study", ["c1"]],
    ["Repeat rate is the only metric founders care about", "Retention", "In Review", 12, "P1", "Article", "u3", "ecommerce repeat purchase rate", ["c2"]],
    ["CRO audit checklist for small Shopify brands", "Conversion", "Drafted", 15, "P1", "Framework", "u3", "shopify cro checklist", ["c3"]],
    ["Loyalty programmes that don't feel like coupons", "Retention", "Drafted", 18, "P2", "Carousel", "u3", "shopify loyalty programme", ["c2"]],
    ["Shopify growth calculator", "Shopify Growth", "Idea", 26, "P1", "Interactive Tool", "u3", "shopify revenue calculator", []],
    ["What a £20k Shopify build actually includes", "Shopify Growth", "Approved", 7, "P0", "Product Page", "u3", "shopify plus agency cost", ["c3"]],
    ["Board-ready ROI for your ecommerce agency spend", "Shopify Growth", "Idea", 30, "P2", "Article", "u3", "ecommerce agency roi", ["c5"]],
    ["Subscription flows: 5 patterns we reuse", "Retention", "Scheduled", 2, "P1", "Article", "u3", "shopify subscription", ["c2"]],
    ["Founder note: why we stopped sending reports", "Retention", "Drafted", 21, "P1", "Article", "u3", "ecommerce agency reporting", ["c2"]],
    ["Checkout extensions explained in 60 seconds", "Conversion", "Idea", 34, "P2", "Video Script", "u3", "checkout extensibility", []],
    ["Magento 1 end of life: your 90-day plan", "Replatforming", "Published", -12, "P1", "Framework", "u3", "magento 1 migration", ["c1"]],
    ["Six CRO quick wins from Hale & Co", "Conversion", "Approved", 10, "P1", "Case Study", "u3", "cro quick wins", ["c3"]],
  ],
  w2: [
    ["How we run 11-week delivery sprints", "Process", "Drafted", 8, "P1", "Article", "u3", "agency delivery process", ["c1"]],
    ["Inside our QA checklist", "Delivery", "Idea", 20, "P2", "Framework", "u3", "shopify qa checklist", []],
    ["Hiring: what we look for in developers", "Culture", "Published", -3, "P2", "Article", "u3", "", []],
  ],
  w3: [
    ["The AI agent that saved Fleetline 4 hours a day", "Case Studies", "In Review", 6, "P0", "Case Study", "u3", "ai agent logistics", ["c4"]],
    ["One thing AI does for a food brand", "AI Agents", "Idea", 22, "P1", "Article", "u3", "ai for food brands", ["c6"]],
    ["Email-to-TMS automation, step by step", "Automation", "Drafted", 14, "P1", "Video Script", "u3", "email automation tms", ["c4"]],
  ],
  w4: [
    ["Stop saying AI. Start saying hours.", "Essays", "Scheduled", 3, "P0", "Article", "u3", "", ["c4"]],
    ["The sceptic's guide to AI for SMEs", "Essays", "Drafted", 11, "P1", "Article", "u3", "ai for small business", ["c6"]],
    ["5 tools I use every week", "Tools", "Idea", 25, "P2", "Carousel", "u3", "", []],
  ],
};

function buildPieces(): Piece[] {
  const out: Piece[] = [];
  let n = 1;
  for (const [wid, seeds] of Object.entries(PIECE_SEED)) {
    seeds.forEach((s, i) => {
      const [title, cluster, status, offset, priority, format, writer, keyword, caseIds] = s;
      const publishDate = addDays(TODAY, offset);
      const founder = wid === "w4" || title.startsWith("Founder");
      out.push({
        id: `p${n++}`, workspaceId: wid, title, publicTitle: title, cluster,
        stage: STAGES[i % 3]!, tier: TIERS[i % 4]!, voice: founder ? "Founder-signed" : "Company",
        writer, designer: "u6", seo: i % 2 ? "u5" : "u4", approver1: founder ? "u1" : null, approver2: "u2",
        status, publishDate, draftDue: addDays(publishDate, -10), designDue: addDays(publishDate, -4),
        channels: wid === "w4" ? ["LinkedIn Personal", "Newsletter"] : wid === "w2" ? ["RVS Media Blog"] : ["eCommerceXcellence Blog", "LinkedIn Company"],
        format, wordCount: 1200 + (i % 4) * 400, keyword, secondaryKeywords: "", volume: keyword ? 200 + ((i * 370) % 2400) : 0,
        difficulty: keyword ? 10 + ((i * 17) % 70) : 0, priority,
        anchor: caseIds.length ? CASES.find((c) => c.id === caseIds[0])!.verbatim : "",
        caseIds, distribution: "Company page post day 1, founder reshare day 2, Shreesha to cut 3 quote cards.",
        repurposing: "LinkedIn carousel + newsletter section.", successMetric: "3 qualified discovery calls attributed",
        notes: "", body: status === "Idea" ? "" : `<p>Opening hook for <b>${title}</b>…</p>`,
        reviewSince: status === "In Review" ? addDays(TODAY, -(i % 4)) : null,
        comments: status === "In Review" ? [{ id: `cm${n}`, author: "u3", body: "Ready for review — @Sakshi Nar", at: addDays(TODAY, -1) }] : [],
      });
    });
  }
  return out;
}

export interface State { workspaces: Workspace[]; users: User[]; pieces: Piece[]; cases: ClientCase[]; activity: Activity[]; videos: Video[]; currentUser: string }
/** Demo data — used only by db/seed.ts. The app always loads from the database. */
export const seed = (): State => ({ workspaces: WORKSPACES, users: USERS, pieces: buildPieces(), cases: CASES, activity: [], videos: [], currentUser: "u2" });

interface Ctx extends State {
  ready: boolean;
  me: User;
  user: (id: string | null) => User | undefined;
  updatePiece: (id: string, patch: Partial<Piece>, note?: string) => void;
  addPiece: (p: Partial<Piece> & { workspaceId: string }) => Piece;
  deletePieces: (ids: string[]) => void;
  addComment: (pieceId: string, body: string) => void;
  upsertCase: (c: ClientCase) => void;
  addWorkspace: (name: string) => void;
  toggleFav: (id: string) => void;
  setVideos: (fn: (vs: Video[]) => Video[]) => void;
  /** Re-fetch the member list after the team changes. */
  reloadUsers: () => Promise<void>;
}
const G = globalThis as unknown as { __contentosCtx?: Context<Ctx | null> };
const C = G.__contentosCtx ?? (G.__contentosCtx = createContext<Ctx | null>(null));
let idc = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${idc++}`;

type Table = "pieces" | "videos" | "workspaces" | "cases" | "activity";
const TABLES: Table[] = ["pieces", "videos", "workspaces", "cases", "activity"];
const DELETABLE = ["pieces", "videos"] as const;
const snapshot = (rows: { id: string }[]) => new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
const EMPTY: State = { workspaces: [], users: [], pieces: [], cases: [], activity: [], videos: [], currentUser: "" };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[] | null>(null);
  // What the database last confirmed, per table (id -> JSON). Saves send only the difference,
  // so two people editing different pieces never overwrite or delete each other's work.
  const synced = useRef<Record<Table, Map<string, string>>>({ pieces: new Map(), videos: new Map(), workspaces: new Map(), cases: new Map(), activity: new Map() });
  const latest = useRef(s);
  latest.current = s;
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loadAll().then((d) => {
      const st: State = { users: d.users as User[], workspaces: d.workspaces, pieces: d.pieces, cases: d.cases, activity: d.activity, videos: d.videos, currentUser: d.meId };
      for (const t of TABLES) synced.current[t] = snapshot(st[t]);
      try { const raw = localStorage.getItem(`contentos-favs-${d.meId}`); if (raw) setFavs(JSON.parse(raw)); } catch { /* ignore */ }
      setS(st);
      setReady(true);
    }).catch((e: Error) => setError(e.message || "Couldn't load your workspace."));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      // Queued so saves reach the server in order.
      queue.current = queue.current.then(async () => {
        const cur = latest.current;
        const upsert: Partial<Record<Table, { id: string }[]>> = {};
        const remove: Partial<Record<(typeof DELETABLE)[number], string[]>> = {};
        let changed = false;
        for (const tb of TABLES) {
          const rows = (cur[tb] as { id: string }[]).filter((r) => synced.current[tb].get(r.id) !== JSON.stringify(r));
          if (rows.length) { upsert[tb] = rows; changed = true; }
        }
        for (const tb of DELETABLE) {
          const live = new Set(cur[tb].map((r) => r.id));
          const gone = [...synced.current[tb].keys()].filter((id) => !live.has(id));
          if (gone.length) { remove[tb] = gone; changed = true; }
        }
        if (!changed) return;
        try {
          await saveChanges({ data: { upsert, remove } });
          for (const tb of TABLES) for (const r of upsert[tb] ?? []) synced.current[tb].set(r.id, JSON.stringify(r));
          for (const tb of DELETABLE) for (const id of remove[tb] ?? []) synced.current[tb].delete(id);
        } catch (e) {
          toast.error(`Not saved: ${(e as Error).message || "please check your connection."}`);
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [s.pieces, s.videos, s.workspaces, s.cases, s.activity, ready]);

  const log = (st: State, workspaceId: string, text: string): Activity[] =>
    [{ id: uid("a"), workspaceId, actor: st.currentUser, text, at: new Date().toISOString() }, ...st.activity].slice(0, 100);

  const updatePiece = useCallback((id: string, patch: Partial<Piece>, note?: string) => setS((st) => {
    const p = st.pieces.find((x) => x.id === id); if (!p) return st;
    const next = { ...p, ...patch };
    if (patch.status === "In Review" && p.status !== "In Review") next.reviewSince = TODAY;
    if (patch.status && patch.status !== "In Review") next.reviewSince = null;
    const text = note ?? (patch.status && patch.status !== p.status ? `moved “${p.title}” to ${patch.status}` : patch.publishDate && patch.publishDate !== p.publishDate ? `rescheduled “${p.title}” to ${patch.publishDate}` : `edited “${p.title}”`);
    return { ...st, pieces: st.pieces.map((x) => (x.id === id ? next : x)), activity: log(st, p.workspaceId, text) };
  }), []);

  if (error) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-navy-deep text-primary-foreground">
      <p className="text-2xl font-black text-lime">ContentOS</p><p className="text-sm">{error}</p>
      <a href="/login" className="text-sm underline">Go to sign in</a>
    </div>
  );
  if (!ready) return <div className="flex h-screen items-center justify-center bg-navy-deep text-lime font-black text-2xl">ContentOS</div>;

  const me = s.users.find((u) => u.id === s.currentUser)!;
  /** Default assignee for a new piece: the first member holding that role. */
  const firstWith = (role: Role) => s.users.find((u) => u.roles.includes(role))?.id ?? "";

  const addPiece = (p: Partial<Piece> & { workspaceId: string }) => {
    const ws = s.workspaces.find((w) => w.id === p.workspaceId)!;
    const date = p.publishDate ?? addDays(TODAY, 14);
    const piece: Piece = {
      id: uid("p"), title: "Untitled piece", publicTitle: "", cluster: ws.clusters[0] ?? "General", stage: "Awareness", tier: "Entry", voice: "Company",
      writer: me.roles.includes("Writer") ? me.id : firstWith("Writer") || me.id, designer: firstWith("Designer"), seo: firstWith("SEO"),
      approver1: null, approver2: firstWith("Marketing Lead") || firstWith("Admin"), status: "Idea", publishDate: date,
      draftDue: addDays(date, -10), designDue: addDays(date, -4), channels: [], format: "Article", wordCount: 1200, keyword: "",
      secondaryKeywords: "", volume: 0, difficulty: 0, priority: "P2", anchor: "", caseIds: [], distribution: "", repurposing: "",
      successMetric: "", notes: "", body: "", reviewSince: null, comments: [], ...p,
    };
    setS((st) => ({ ...st, pieces: [...st.pieces, piece], activity: log(st, piece.workspaceId, `created “${piece.title}”`) }));
    return piece;
  };

  const favSet = favs ?? s.workspaces.filter((w) => w.favourite).map((w) => w.id);
  const ctx: Ctx = {
    ...s, ready, me,
    workspaces: s.workspaces.map((w) => ({ ...w, favourite: favSet.includes(w.id) })),
    user: (id) => s.users.find((u) => u.id === id),
    updatePiece, addPiece,
    deletePieces: (ids) => setS((st) => ({ ...st, pieces: st.pieces.filter((p) => !ids.includes(p.id)) })),
    addComment: (pieceId, body) => setS((st) => {
      const p = st.pieces.find((x) => x.id === pieceId)!;
      return { ...st, pieces: st.pieces.map((x) => x.id === pieceId ? { ...x, comments: [...x.comments, { id: uid("cm"), author: st.currentUser, body, at: new Date().toISOString() }] } : x), activity: log(st, p.workspaceId, `commented on “${p.title}”`) };
    }),
    upsertCase: (c) => setS((st) => ({ ...st, cases: st.cases.some((x) => x.id === c.id) ? st.cases.map((x) => (x.id === c.id ? c : x)) : [...st.cases, c] })),
    addWorkspace: (name) => setS((st) => ({ ...st, workspaces: [...st.workspaces, { id: uid("w"), name, short: name.slice(0, 2).toUpperCase(), color: "var(--c6)", tagline: "Client brand", clusters: ["General"] }] })),
    // Favourites are personal, so they live in this browser rather than on the shared workspace.
    toggleFav: (id) => {
      const next = favSet.includes(id) ? favSet.filter((x) => x !== id) : [...favSet, id];
      setFavs(next);
      try { localStorage.setItem(`contentos-favs-${s.currentUser}`, JSON.stringify(next)); } catch { /* ignore */ }
    },
    setVideos: (fn) => setS((st) => ({ ...st, videos: fn(st.videos) })),
    reloadUsers: () => loadAll().then((d) => setS((st) => ({ ...st, users: d.users as User[] }))),
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

export const useStore = () => { const c = useContext(C); if (!c) throw new Error("no store"); return c; };
export const newCaseId = () => uid("c");

export function isOverdue(p: Piece) {
  if (p.status === "Published") return false;
  if (p.publishDate < TODAY) return true;
  if (p.status === "In Review" && p.reviewSince) {
    const hours = (new Date(TODAY).getTime() - new Date(p.reviewSince).getTime()) / 36e5;
    return hours > (p.approver1 ? 48 : 24);
  }
  return false;
}
export function permissionWarning(p: Piece, cases: ClientCase[]) {
  return p.caseIds.map((id) => cases.find((c) => c.id === id)).filter((c) => c && c.permission !== "Granted") as ClientCase[];
}
export const hasRole = (u: User | undefined, ...roles: Role[]) => !!u && u.roles.some((r) => roles.includes(r));
export const isManager = (u: User) => hasRole(u, "Admin", "Marketing Lead");
/** Viewer-only accounts can't change anything. */
export const isReadOnly = (u: User) => u.roles.every((r) => r === "Viewer");
export function canApprove(me: User) { return hasRole(me, "Admin", "Marketing Lead", "Approver"); }

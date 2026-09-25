# ContentOS — Project Specification & Roadmap

> Single source of truth for what ContentOS is, what has been built, and what
> remains. Update this file as new milestones land.
>
> Last updated: 25 Sep 2026 (accounts & merchants)

---

## 1. Vision

ContentOS is an internal content-operations platform for RVS Media's content
team. It replaces spreadsheets and WhatsApp coordination with one workspace
where the team plans, writes, reviews, publishes and tracks:

- **Articles** for four publication workspaces
- **Short-form and long-form video** (scripts, filming, editing, review)
- **Client cases** tied to content pieces

The design goal is a calm, scannable tool that a writer, an SEO specialist, a
video editor and an admin can all use without training.

---

## 2. Goals

| # | Goal | Status |
|---|------|--------|
| G1 | Plan and track content pieces across Idea → Published stages | ✅ Done |
| G2 | Multiple views: Board, Table, Calendar, Timeline, Dashboard | ✅ Done |
| G3 | Full-screen editor for writers with version history and section comments | ✅ Done |
| G4 | Review workflow: submit → approve / request changes, with comment gating | ✅ Done |
| G5 | Video schedule with production template, editor assignment, uploads and review | ✅ Done |
| G6 | Client case book linked to content | ✅ Done |
| G7 | Roles: Admin, Marketing Lead, Writer, Designer, SEO, Social, Approver, Viewer — a person can hold several | ✅ Done |
| G8 | Real logins, platform owner + merchants, server-enforced permissions | ✅ Done |
| G9 | Permanent file uploads (drafts, videos, thumbnails) | ⬜ Pending |
| G10 | Notifications (mentions, review requests, due dates) | ⬜ Pending |
| G11 | AI assistance (briefs, hooks, hashtags, keyword research) | ⬜ Pending |
| G12 | Production hosting + CI (Vercel + GitHub sync) | ✅ Done |
| G13 | Multi-stage review workflow (writer → content writer → SEO → designer → project lead → marketing lead) with AI-content check | ⬜ Next |

---

## 3. Current architecture

- **Front end:** React 19 + TanStack Start v1, Tailwind CSS v4, shadcn-style components
- **Backend:** TanStack server functions (`src/lib/data.functions.ts`) talking directly to a hosted Postgres database (Neon) over `DATABASE_URL`
- **Data layer:** `src/lib/store.tsx` — React context provider; loads the signed-in person's data once on open, then saves only the rows that changed (queued, in order)
- **Database:** Neon Postgres. Tables: `merchants`, `app_users` (logins, roles[], workspace access), `sessions`, `workspaces`, `pieces`, `client_cases`, `videos`, `activity` — every content row carries `merchant_id`. Schema: `db/schema.sql`, applied by `node db/migrate.mjs`
- **Auth:** email + password (PBKDF2), httpOnly session cookie, checked in every server function (`src/lib/auth.server.ts`)
- **Seeded demo data:** 8 team members, 4 workspaces (eCommerceXcellence, RVS Media, Velocity AI, The AI Shift), 6 client cases, 23 content pieces, 2 videos

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (server-side only) |

### Key files

| File | Role |
|------|------|
| `src/routes/index.tsx` | App shell: sidebar, workspace switcher, role switcher |
| `src/lib/store.tsx` | State context, types, statuses, permissions helpers |
| `src/lib/data.functions.ts` | `loadAll` / `saveState` server functions |
| `src/lib/db.server.ts` | Neon connection (server-only) |
| `src/components/contentos/*` | Views, drawers, editors, video schedule |
| `src/styles.css` | Brand tokens (deep green `#122419` sidebar, lime accent) |

---

## 4. What has been built

### 4.1 Content pipeline
- Pieces flow through **Idea → Drafting → Review → Scheduled → Published** with overdue detection (small red dot before the title)
- Priority (P0–P2), cluster, format, primary keyword, UK search volume and keyword difficulty tracked per piece
- **Table view** — the default working grid: sortable columns, saved views, inline editing, bulk status/writer change, CSV export. View control is a plain text link in its own last column
- **Board view** — kanban by status, drag to move
- **Calendar view** — month grid by publish date
- **Timeline view** — production runway per piece
- **Dashboard** — charts on throughput, status mix, per-writer load
- **Command menu (⌘K)** — jump to any piece, workspace or action

### 4.2 Writing & review (full-screen editor)
- **Open editor** on any piece: distraction-free writing area with formatting toolbar (headings, bold, italic, links, lists, quotes)
- **Upload drafts** (.docx via mammoth, .txt, .md, .html) and edit in place
- Autosave with live word count vs. target length
- **Named versions** with restore
- **Section comments**: reviewers highlight a passage and comment; the highlight persists; replies and "Resolved" state supported
- **Review gate**: Approve is locked until every comment is resolved; Request changes sends the piece back with the reason logged
- **General tab** for overall feedback; @-mention comments in the piece drawer

### 4.3 Video production
- **Video page** with three views: Schedule (cards by publish date), Sheet (spreadsheet mirroring the team's production template: date, day, topic, type, platforms, hook, script, shot list, caption, hashtags, CTA, thumbnail, music), and **Table**
- Per-video editor: schedule, format/aspect/length, platform multi-select, filming date, edit due date, script writer, video editor, reviewer
- **Assignment & review loop**: assign editor + reviewer → editor uploads completed work (each upload a new playable version v1, v2…) → submit for review → approve (moves to Scheduled) or request changes (back to Editing with reason) → timestamped comments
- **Best-practice checklist** per video (hook ≤14 words, burned-in subtitles, vertical 9:16, clear CTA, thumbnail brief, edit due before publish, script/shot list exists, edit done before publish)

### 4.4 Workspace & people
- Workspace switcher with favourites; content, videos and cases are scoped per workspace
- **Case book**: 6 client cases linked to content pieces
- Team page with roles; **"Viewing as" role switcher** (bottom-left) for testing permissions
- Permission warnings for actions outside a role (e.g. a Writer approving)

### 4.5 Persistence
- All state (pieces, videos, cases, comments, versions) loads from Neon and saves back on every edit
- `DATABASE_URL` documented above for Vercel deployment

---

### 4.6 Accounts, merchants & permissions
- **Platform owner console** (`/owner`): all merchants with team size, logins, sign-ins in the last 7 days, workspaces and pieces; create a merchant (with a starter workspace and first Admin), pause/resume, reset any member's password, open a merchant to work inside it as Admin
- **Sign-in** (`/login`) with a forced password change after a temporary password
- **Team page**: Admins and Marketing Leads add members (temporary password + copyable invite message), give one or more roles, restrict to chosen workspaces, reset passwords, disable accounts. Only an Admin can grant or edit the Admin role
- **Server-enforced rules**: members only load and save their merchant's data and their workspaces; Viewer-only is read-only; deleting pieces needs Admin/Marketing Lead; workspaces need Admin; Case Book needs Admin/Marketing Lead; a paused merchant or disabled account is signed out immediately

## 5. What is pending (build order)

### Phase 1 — Real accounts & permissions (G8) — ✅ done, see 4.6
- Replace the "Viewing as" switcher with real sign-up / sign-in (managed auth)
- Store roles in the database; enforce permissions on the server, not just the UI
- Per-user workspaces instead of shared demo data
- *Acceptance:* a Writer signing in sees only their work and cannot approve, even by calling the API directly

### Phase 2 — Permanent files (G9)
- Object storage for uploaded draft files, videos, thumbnails and exports
- Signed upload/download URLs; uploads survive refresh and device changes
- *Acceptance:* an uploaded video plays from any browser the next day

### Phase 3 — Notifications & collaboration (G10)
- In-app + email notifications: @-mentions, review requests, approvals, overdue drafts and edits
- Due-date digest for admins
- *Acceptance:* a writer is notified when a comment names them; an admin gets a weekly overdue summary

### Phase 4 — AI assistance (G11)
- Brief generation from keyword + cluster
- Hook and hashtag suggestions for video
- First-draft outlines writers can accept or rewrite
- *Acceptance:* one-click brief appears in the piece's Brief tab

### Phase 5 — Polish & scale
- Pagination / incremental loading once pieces grow past a few hundred
- Audit trail (who changed what, when)
- Public sharing links for client review
- Custom domains and per-workspace branding

---

## 6. Known limitations

- **Uploads are metadata-only in the database:** the actual draft/video files still do not persist (Phase 2)
- **Invites are shared by hand:** there's no email sending yet — the temporary password is shown once with a copyable invite message
- **Role rules inside a piece** (e.g. a Writer may only move a piece up to In Review) are still UI-level; the review workflow (G13) will move them to the server
- **Demo team has no logins:** the seeded RVS Media members can be given one from the Team page ("Give login")

---

## 7. Deployment notes

- Hosting: Vercel (or any Node-compatible host). Set `DATABASE_URL` in the host's environment variables
- GitHub: the project syncs to the connected repository — every change made in chat commits automatically; commits from the repo sync back
- Preview: every change is testable in the live preview before committing

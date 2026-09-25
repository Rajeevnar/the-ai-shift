import { useEffect, useState } from "react";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLES, hasRole, isManager, useStore, type Role, type Workspace } from "@/lib/store";
import { createMember, listTeam, resetMemberPassword, updateMember, type Member } from "@/lib/team.functions";
import { CredentialsCard } from "./Account";
import { Avatar } from "./ui";

const ROLE_HINT: Record<Role, string> = {
  Admin: "Everything, incl. workspaces & team", "Marketing Lead": "Manage team, cases, approve",
  Writer: "Create & draft pieces", Designer: "Design work on pieces", SEO: "Keywords & SEO review",
  Social: "Social posts & video", Approver: "Approve pieces", Viewer: "Read-only",
};

const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function Team({ ws }: { ws: Workspace }) {
  const s = useStore();
  const manager = isManager(s.me);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);
  const load = () => listTeam().then(setMembers).catch((e: Error) => toast.error(e.message));
  useEffect(() => { void load(); }, []);

  const reset = async (m: Member) => {
    if (!m.email) return setEditing(m);
    if (!confirm(`Give ${m.name} a new temporary password? They'll be signed out and must choose a new password.`)) return;
    try { const r = await resetMemberPassword({ data: { id: m.id } }); setCreds({ name: m.name, ...r }); void load(); } catch (e) { toast.error((e as Error).message); }
  };
  const wsName = (id: string) => s.workspaces.find((w) => w.id === id)?.name ?? "—";
  // A Marketing Lead can't edit Admins; only an Admin can.
  const canEdit = (m: Member) => manager && (hasRole(s.me, "Admin") || !m.roles.includes("Admin"));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Team</h2>
          <p className="text-sm text-muted-foreground">{manager ? "Add people, give them one or more roles, and choose which workspaces they can see." : "Everyone working in this organisation."}</p>
        </div>
        {manager && <Button onClick={() => setEditing("new")} className="ml-auto bg-lime font-bold text-navy hover:bg-lime/90"><UserPlus /> Add member</Button>}
      </div>
      {!members ? <p className="text-sm text-muted-foreground">Loading team…</p> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const assigned = s.pieces.filter((p) => p.workspaceId === ws.id && [p.writer, p.designer, p.seo, p.approver1, p.approver2].includes(m.id));
            const state = m.status !== "active" ? ["Disabled", "bg-destructive/15 text-destructive"] : !m.email ? ["No login", "bg-muted text-muted-foreground"]
              : m.mustChangePassword ? ["Invited", "bg-st-drafted/25 text-navy"] : ["Active", "bg-lime/40 text-navy"];
            return (
              <div key={m.id} className={`rounded-xl border border-border bg-card p-4 ${m.status !== "active" ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3"><Avatar id={m.id} size={40} />
                  <div className="min-w-0 flex-1"><p className="truncate font-bold text-navy">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.fn || (manager ? m.email : "") || "—"}</p></div>
                  {manager && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${state[1]}`}>{state[0]}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{m.roles.map((r) => <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-navy">{r}</span>)}</div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {m.roles.some((r) => r === "Admin" || r === "Marketing Lead") || !m.workspaceIds ? "All workspaces" : m.workspaceIds.length ? m.workspaceIds.map(wsName).join(", ") : "No workspaces"}
                  {" · "}{assigned.length} pieces here
                </p>
                {manager && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <span className="flex-1 truncate text-[11px] text-muted-foreground" title={m.email ?? ""}>{m.email ? `Last sign-in: ${ago(m.lastLoginAt)}` : "Can't sign in yet"}</span>
                    {canEdit(m) && <>
                      <button onClick={() => void reset(m)} title={m.email ? "Reset password" : "Give login"} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-navy hover:bg-muted"><KeyRound className="size-3.5" />{m.email ? "Reset" : "Give login"}</button>
                      <button onClick={() => setEditing(m)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-navy hover:bg-muted"><Pencil className="size-3.5" />Edit</button>
                    </>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <h3 className="mt-8 mb-2 text-sm font-bold text-navy">Roles</h3>
      <div className="flex flex-wrap gap-2">{ROLES.map((r) => <span key={r} title={ROLE_HINT[r]} className="rounded-md border border-border bg-card px-2 py-1 text-xs">{r} <span className="text-muted-foreground">· {ROLE_HINT[r]}</span></span>)}</div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {editing && <MemberForm key={editing === "new" ? "new" : editing.id} member={editing === "new" ? null : editing} isSelf={editing !== "new" && editing.id === s.currentUser}
            onDone={async (c) => { setEditing(null); if (c) setCreds(c); await load(); await s.reloadUsers(); if (!c) toast.success("Member updated"); }} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-navy">Login details for {creds?.name}</DialogTitle><DialogDescription>Send these to them — for example over WhatsApp or email.</DialogDescription></DialogHeader>
          {creds && <CredentialsCard {...creds} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberForm({ member, isSelf, onDone }: { member: Member | null; isSelf: boolean; onDone: (creds?: { name: string; email: string; password: string }) => void }) {
  const s = useStore();
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [fn, setFn] = useState(member?.fn ?? "");
  const [roles, setRoles] = useState<Role[]>((member?.roles as Role[]) ?? ["Writer"]);
  const [allWs, setAllWs] = useState(member ? member.workspaceIds === null : true);
  const [wsIds, setWsIds] = useState<string[]>(member?.workspaceIds ?? []);
  const [active, setActive] = useState(member ? member.status === "active" : true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = hasRole(s.me, "Admin");
  const seesAll = roles.includes("Admin") || roles.includes("Marketing Lead");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!roles.length) return setError("Pick at least one role.");
    const workspaceIds = allWs || seesAll ? null : wsIds;
    setBusy(true);
    try {
      if (!member) {
        const r = await createMember({ data: { name, email, fn, roles, workspaceIds } });
        onDone({ name, email: r.email, password: r.password });
      } else {
        await updateMember({ data: { id: member.id, name, email: email.trim() || null, fn, roles, workspaceIds, status: active ? "active" : "disabled" } });
        // Adding an email to someone without a login: issue their first temporary password now.
        if (!member.email && email.trim()) {
          const r = await resetMemberPassword({ data: { id: member.id } });
          onDone({ name, ...r });
        } else onDone();
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't save.");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-navy">{member ? `Edit ${member.name}` : "Add team member"}</DialogTitle>
        <DialogDescription>{member ? "Change their roles, access or status." : "They'll get a temporary password to share with them."}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="m-name">Full name</Label><Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="m-fn">Job title</Label><Input id="m-fn" value={fn} onChange={(e) => setFn(e.target.value)} placeholder="e.g. Content writer" /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="m-email">Email (used to sign in)</Label><Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!member || !!member.email} placeholder={member && !member.email ? "Add an email to give them a login" : ""} /></div>
      </div>
      <div className="space-y-1.5">
        <Label>Roles <span className="font-normal text-muted-foreground">— pick one or more</span></Label>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => {
            const on = roles.includes(r);
            const locked = (r === "Admin" && !admin) || isSelf;
            return <button type="button" key={r} disabled={locked} title={ROLE_HINT[r]} onClick={() => setRoles(toggle(roles, r))}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-navy bg-navy text-primary-foreground" : "border-border bg-card text-navy hover:bg-muted"}`}>{r}</button>;
          })}
        </div>
        {isSelf && <p className="text-xs text-muted-foreground">You can't change your own roles — ask another Admin.</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Workspace access</Label>
        {seesAll ? <p className="text-xs text-muted-foreground">Admins and Marketing Leads always see every workspace.</p> : <>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={allWs} onChange={() => setAllWs(true)} /> All workspaces</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={!allWs} onChange={() => setAllWs(false)} /> Only selected</label>
          </div>
          {!allWs && <div className="grid gap-1 rounded-md border border-border p-2 sm:grid-cols-2">
            {s.workspaces.map((w) => <label key={w.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wsIds.includes(w.id)} onChange={() => setWsIds(toggle(wsIds, w.id))} />
              <span className="flex size-5 items-center justify-center rounded text-[9px] font-black text-navy" style={{ background: w.color }}>{w.short}</span>{w.name}</label>)}
          </div>}
        </>}
      </div>
      {member && !isSelf && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Account active <span className="text-xs text-muted-foreground">(untick to block sign-in)</span></label>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full bg-lime font-bold text-navy hover:bg-lime/90">{busy ? "Saving…" : member ? "Save changes" : "Create member & get password"}</Button>
    </form>
  );
}

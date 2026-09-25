import { createFileRoute, redirect } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, KeyRound, LogOut, Pause, Play, Plus, KeySquare } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangePasswordDialog, CredentialsCard } from "@/components/contentos/Account";
import { getMe, logout, openMerchant } from "@/lib/auth.functions";
import { createMerchant, listMerchantUsers, listMerchants, ownerResetPassword, setMerchantStatus, type MerchantSummary, type MerchantUser } from "@/lib/owner.functions";

export const Route = createFileRoute("/owner")({
  head: () => ({ meta: [{ title: "Owner console — ContentOS" }] }),
  beforeLoad: async () => {
    const me = await getMe();
    if (!me || me.mustChangePassword) throw redirect({ to: "/login" });
    if (!me.isOwner) throw redirect({ to: "/" });
    return { me };
  },
  component: Owner,
});

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function Owner() {
  const { me } = Route.useRouteContext();
  const [rows, setRows] = useState<MerchantSummary[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, MerchantUser[]>>({});
  const [adding, setAdding] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);
  const load = () => listMerchants().then(setRows).catch((e: Error) => toast.error(e.message));
  useEffect(() => { void load(); }, []);

  const expand = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    try { const u = await listMerchantUsers({ data: { merchantId: id } }); setUsers((x) => ({ ...x, [id]: u })); } catch (e) { toast.error((e as Error).message); }
  };
  const toggleStatus = async (m: MerchantSummary) => {
    const status = m.status === "active" ? "paused" : "active";
    if (status === "paused" && !confirm(`Pause ${m.name}? All of its ${m.users} members are signed out and can't sign in until you resume.`)) return;
    try { await setMerchantStatus({ data: { id: m.id, status } }); toast.success(status === "paused" ? `${m.name} paused` : `${m.name} resumed`); void load(); } catch (e) { toast.error((e as Error).message); }
  };
  const enter = async (id: string) => {
    try {
      const r = await openMerchant({ data: { merchantId: id } });
      if (r.ok) window.location.href = "/";
      else toast.error(r.error);
    } catch (e) { toast.error((e as Error).message); }
  };
  const reset = async (u: MerchantUser) => {
    if (!confirm(`Give ${u.name} a new temporary password? They'll be signed out.`)) return;
    try { const r = await ownerResetPassword({ data: { userId: u.id } }); setCreds({ name: u.name, ...r }); } catch (e) { toast.error((e as Error).message); }
  };
  const signOut = async () => { await logout(); window.location.href = "/login"; };

  const total = (k: keyof MerchantSummary) => (rows ?? []).reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const tiles = rows ? [
    ["Merchants", rows.length, `${rows.filter((r) => r.status === "active").length} active · ${rows.filter((r) => r.status !== "active").length} paused`],
    ["Team members", total("users"), `${total("withLogin")} with a login`],
    ["Signed in (7 days)", total("active7d"), `${total("signIns")} sign-ins all time`],
    ["Content pieces", total("pieces"), `${total("videos")} videos · ${total("workspaces")} workspaces`],
  ] as const : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-navy-deep text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-lime font-black text-navy">C</span>
          <span className="text-lg font-black tracking-tight">ContentOS</span>
          <span className="rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-lime">Owner console</span>
          <div className="ml-auto flex items-center gap-1 text-sm">
            <span className="mr-2 hidden text-primary-foreground/70 sm:inline">{me.name} · {me.email}</span>
            <button onClick={() => setPwOpen(true)} title="Change password" className="rounded p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"><KeySquare className="size-4" /></button>
            <button onClick={signOut} title="Sign out" className="rounded p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"><LogOut className="size-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        <div className="flex flex-wrap items-end gap-3">
          <div><h1 className="text-xl font-black text-navy">Merchants</h1><p className="text-sm text-muted-foreground">Every organisation using ContentOS. Pause one to block its whole team; open one to work inside it as Admin.</p></div>
          <Button onClick={() => setAdding(true)} className="ml-auto bg-lime font-bold text-navy hover:bg-lime/90"><Plus /> New merchant</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([label, value, sub]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
              <p className="text-3xl font-black text-navy">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-semibold">Merchant</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Team</th><th className="px-3 py-2 text-right font-semibold">Signed in 7d</th>
                <th className="px-3 py-2 text-right font-semibold">Workspaces</th><th className="px-3 py-2 text-right font-semibold">Pieces</th><th className="px-3 py-2 font-semibold">Last sign-in</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {!rows && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
              {rows?.map((m) => (
                <Fragment key={m.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2"><button onClick={() => void expand(m.id)} className="flex items-center gap-1 font-bold text-navy">{open === m.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{m.name}</button></td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.status === "active" ? "bg-lime/40 text-navy" : "bg-destructive/15 text-destructive"}`}>{m.status === "active" ? "Active" : "Paused"}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.users} <span className="text-xs text-muted-foreground">({m.withLogin} login)</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.active7d}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.workspaces}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.pieces}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{when(m.lastLoginAt)}</td>
                    <td className="px-3 py-2"><div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => void toggleStatus(m)}>{m.status === "active" ? <><Pause /> Pause</> : <><Play /> Resume</>}</Button>
                      <Button size="sm" onClick={() => void enter(m.id)} className="bg-navy text-primary-foreground">Open <ArrowRight /></Button>
                    </div></td>
                  </tr>
                  {open === m.id && (
                    <tr className="border-b border-border bg-muted/20"><td colSpan={8} className="px-6 py-3">
                      {!users[m.id] ? <p className="text-xs text-muted-foreground">Loading team…</p> : users[m.id]!.length === 0 ? <p className="text-xs text-muted-foreground">No members yet.</p> : (
                        <table className="w-full text-xs">
                          <thead className="text-left text-muted-foreground"><tr><th className="py-1 font-semibold">Name</th><th className="py-1 font-semibold">Email</th><th className="py-1 font-semibold">Roles</th><th className="py-1 font-semibold">Status</th><th className="py-1 font-semibold">Last sign-in</th><th className="py-1 text-right font-semibold">Sign-ins</th><th /></tr></thead>
                          <tbody>{users[m.id]!.map((u) => (
                            <tr key={u.id} className="border-t border-border">
                              <td className="py-1.5 font-semibold text-navy">{u.name}</td><td className="py-1.5">{u.email ?? <span className="text-muted-foreground">no login</span>}</td>
                              <td className="py-1.5">{u.roles.join(", ")}</td>
                              <td className="py-1.5">{u.status !== "active" ? "Disabled" : !u.email ? "—" : u.mustChangePassword ? "Invited" : "Active"}</td>
                              <td className="py-1.5">{when(u.lastLoginAt)}</td><td className="py-1.5 text-right tabular-nums">{u.loginCount}</td>
                              <td className="py-1.5 text-right">{u.email && <button onClick={() => void reset(u)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-navy hover:bg-muted"><KeyRound className="size-3" /> Reset password</button>}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">Created {when(m.createdAt)} · last activity {when(m.lastActivityAt)} · {m.videos} videos. Open the merchant to add members or change roles.</p>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">{adding && <NewMerchant onDone={(c) => { setAdding(false); setCreds(c); void load(); }} />}</DialogContent>
      </Dialog>
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-navy">Login details for {creds?.name}</DialogTitle><DialogDescription>Send these to them privately.</DialogDescription></DialogHeader>
          {creds && <CredentialsCard {...creds} />}
        </DialogContent>
      </Dialog>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <Toaster />
    </div>
  );
}

function NewMerchant({ onDone }: { onDone: (c: { name: string; email: string; password: string }) => void }) {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await createMerchant({ data: { name, adminName, adminEmail } });
      onDone({ name: adminName, email: r.email, password: r.password });
    } catch (err) { setError((err as Error).message || "Couldn't create the merchant."); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader><DialogTitle className="text-navy">New merchant</DialogTitle><DialogDescription>Creates the organisation, a starter workspace and its first Admin, who can then add the rest of the team.</DialogDescription></DialogHeader>
      <div className="space-y-1"><Label htmlFor="nm-name">Merchant / organisation name</Label><Input id="nm-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
      <div className="space-y-1"><Label htmlFor="nm-admin">Admin's full name</Label><Input id="nm-admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="nm-email">Admin's email</Label><Input id="nm-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full bg-lime font-bold text-navy hover:bg-lime/90">{busy ? "Creating…" : "Create merchant & get password"}</Button>
    </form>
  );
}

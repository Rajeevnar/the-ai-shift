import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { changePassword } from "@/lib/auth.functions";

/** `knownCurrent` skips asking for the current password again (e.g. right after signing in with it). */
export function PasswordForm({ onDone, currentLabel = "Current password", knownCurrent }: { onDone: () => void; currentLabel?: string; knownCurrent?: string | undefined }) {
  const [current, setCurrent] = useState(knownCurrent ?? "");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      const r = await changePassword({ data: { current, next } });
      if (!r.ok) return setError(r.error);
      onDone();
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {!knownCurrent && <div className="space-y-1"><Label htmlFor="pw-current">{currentLabel}</Label><Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>}
      <div className="space-y-1"><Label htmlFor="pw-next">New password</Label><Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="pw-confirm">Confirm new password</Label><Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full bg-lime font-bold text-navy hover:bg-lime/90">{busy ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-navy">Change password</DialogTitle><DialogDescription>You'll stay signed in here; other devices are signed out.</DialogDescription></DialogHeader>
        {open && <PasswordForm onDone={() => { onOpenChange(false); toast.success("Password changed"); }} />}
      </DialogContent>
    </Dialog>
  );
}

/** Shown once after creating a login or resetting a password: the details to pass on. */
export function CredentialsCard({ name, email, password }: { name: string; email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/login`;
  const invite = `Hi ${name}, you've been invited to ContentOS.\n\nSign in at: ${url}\nEmail: ${email}\nTemporary password: ${password}\n\nYou'll be asked to choose your own password when you first sign in.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error("Couldn't copy — select the text instead."); }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p><span className="text-muted-foreground">Sign in at:</span> <span className="font-mono text-xs">{url}</span></p>
        <p><span className="text-muted-foreground">Email:</span> <b className="text-navy">{email}</b></p>
        <p><span className="text-muted-foreground">Temporary password:</span> <b className="font-mono text-navy">{password}</b></p>
      </div>
      <p className="text-xs text-muted-foreground">This password is shown only once. Share it with {name} privately — they'll choose their own when they first sign in.</p>
      <Button onClick={copy} className="w-full bg-lime font-bold text-navy hover:bg-lime/90">{copied ? <><Check /> Copied</> : <><Copy /> Copy invite message</>}</Button>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordForm } from "@/components/contentos/Account";
import { getMe, login, logout } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — ContentOS" }] }),
  beforeLoad: async () => {
    const me = await getMe();
    if (me && !me.mustChangePassword) throw redirect({ to: me.isOwner && !me.merchant ? "/owner" : "/" });
    return { mustChange: !!me?.mustChangePassword, isOwner: !!me?.isOwner };
  },
  component: Login,
});

function Login() {
  const ctx = Route.useRouteContext();
  const [step, setStep] = useState<"signin" | "change">(ctx.mustChange ? "change" : "signin");
  const [isOwner, setIsOwner] = useState(ctx.isOwner);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Full page load so the app starts fresh for the signed-in person.
  const enter = (owner: boolean) => { window.location.href = owner ? "/owner" : "/"; };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await login({ data: { email, password } });
      if (!r.ok) return setError(r.error);
      if (r.mustChangePassword) { setIsOwner(r.isOwner); setStep("change"); } else enter(r.isOwner);
    } catch (err) {
      setError((err as Error).message || "Couldn't sign in. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary-foreground">
          <span className="flex size-9 items-center justify-center rounded-lg bg-lime text-lg font-black text-navy">C</span>
          <span className="text-2xl font-black tracking-tight">ContentOS</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          {step === "signin" ? (
            <form onSubmit={submit} className="space-y-3">
              <div><h1 className="text-lg font-black text-navy">Sign in</h1><p className="text-sm text-muted-foreground">Use the email and password your admin gave you.</p></div>
              <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
              <div className="space-y-1"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full bg-lime font-bold text-navy hover:bg-lime/90">{busy ? "Signing in…" : "Sign in"}</Button>
              <p className="text-center text-xs text-muted-foreground">Forgot your password? Ask your admin to reset it.</p>
            </form>
          ) : (
            <div className="space-y-3">
              <div><h1 className="text-lg font-black text-navy">Choose your password</h1><p className="text-sm text-muted-foreground">You signed in with a temporary password. Set your own to continue.</p></div>
              <PasswordForm currentLabel="Temporary password" knownCurrent={password || undefined} onDone={() => enter(isOwner)} />
              <button onClick={async () => { await logout(); setStep("signin"); setPassword(""); }} className="w-full text-center text-xs text-muted-foreground underline">Use a different account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

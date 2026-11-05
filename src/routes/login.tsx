import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
        if (res.error) throw new Error(res.error.message || "Could not create account");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Wrong email or password");
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-2xl">🎙️</div>
          <h1 className="text-xl font-semibold text-slate-900">Speaking Session Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your speaking practice with ease.</p>
        </div>
        {authEnabled ? (
          <>
            <form onSubmit={submit} className="space-y-3">
              {mode === "up" && (
                <label className="block text-sm font-medium text-slate-600">
                  Name
                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <label className="block text-sm font-medium text-slate-600">
                Email
                <input required type="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-600">
                Password
                <input required minLength={8} type="password" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button disabled={busy} className="w-full rounded-lg bg-[#155EEF] py-2.5 font-semibold text-white disabled:opacity-50">
                {busy ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
              </button>
            </form>
            <button className="mt-3 w-full text-sm font-semibold text-[#155EEF]" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Need an account? Register" : "Already registered? Sign in"}
            </button>
            <div className="my-4 text-center text-xs text-slate-400">or</div>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <button key={p.providerId} className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium" onClick={() => signIn(p.providerId, { callbackURL: "/" })}>
                  Continue with {p.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Sign-in is turned off.</p>
        )}
      </div>
    </main>
  );
}

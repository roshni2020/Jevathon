import { useState } from "react";
import { call } from "./api";
import { Button, Card } from "./ui";

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("parent@guardian.dev");
  const [password, setPassword] = useState("guardian");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-xl text-white">🛡</div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Guardian</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Sign in to see what your child's AI agent is doing.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-[12.5px] font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-[12.5px] font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            {error && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>

        <div className="mt-4 rounded-xl bg-slate-100/70 px-4 py-3 text-[12.5px] leading-relaxed text-slate-500">
          <b className="text-slate-700">Demo account</b> — prefilled above.
          Passwords are scrypt-hashed and sessions are server-side opaque tokens, but this
          build has one seeded parent and no signup flow.
        </div>
      </div>
    </div>
  );
}

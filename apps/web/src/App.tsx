import { useCallback, useEffect, useState } from "react";
import About from "./About";
import Connections from "./Connections";
import Login from "./Login";
import Playground from "./Playground";
import { api, call } from "./api";
import type { Rule, State, Verdict } from "./types";
import { Button, Card, Chip, DEC, Meter, Reason, Stat, time } from "./ui";

type Tab = "playground" | "dashboard" | "connections" | "policies" | "incident" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "playground", label: "Agent Playground" },
  { id: "dashboard", label: "Dashboard" },
  { id: "connections", label: "Connections" },
  { id: "policies", label: "Safety Policies" },
  { id: "incident", label: "Incidents" },
  { id: "about", label: "About" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("playground");
  const [state, setState] = useState<State | null>(null);
  /** null while we are still asking the API whether this browser has a session. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await call<State>("/api/state"));
      setSignedIn(true);
    } catch {
      setSignedIn(false);
      setState(null);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!signedIn) return;
    const es = new EventSource(api("/api/events"), { withCredentials: true });
    es.onmessage = () => reload();
    return () => es.close();
  }, [signedIn, reload]);

  if (signedIn === null) return <div className="grid h-screen place-items-center text-sm text-slate-400">Loading…</div>;
  if (!signedIn) return <Login onSignedIn={reload} />;
  if (!state) return <div className="grid h-screen place-items-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-lg text-white">🛡</div>
          <div>
            <div className="text-[17px] font-semibold tracking-tight text-slate-900">Guardian MCP</div>
            <div className="text-[12px] text-slate-500">Safety gateway for AI agents used by children</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[14px] font-semibold text-slate-900">
              {state.child.name} <span className="font-normal text-slate-400">· age {state.child.age}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[12px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Protection active
            </div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 font-bold text-violet-700">E</div>
          <button
            onClick={async () => {
              await call("/api/logout", { method: "POST" });
              setSignedIn(false);
            }}
            className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 md:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${
              tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {t.id === "dashboard" && state.approvals.some((a) => a.status === "PENDING") && (
              <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                {state.approvals.filter((a) => a.status === "PENDING").length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div key={tab} className="fadeup">
      {tab === "playground" && <Playground state={state} reload={reload} />}
      {tab === "dashboard" && <Dashboard state={state} />}
      {tab === "connections" && <Connections state={state} reload={reload} />}
      {tab === "policies" && <Policies state={state} />}
      {tab === "incident" && <Incidents state={state} />}
      {tab === "about" && <About state={state} />}
      </div>

      <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 pt-4 text-[12px] text-slate-400">
        <span>
          Jev: <b className={state.jev === "live" ? "text-emerald-600" : "text-amber-600"}>{state.jev}</b>
        </span>
        <span>
          Browser: <b className="text-slate-600">{state.browser}</b>
        </span>
        <span>Signed in as {state.parent.name}</span>
        <span>Policy: {state.child.policy_preset}</span>
        <span className="ml-auto">TypeSafe AI · CodeRabbit · Cognition · Browserbase</span>
      </footer>
    </div>
  );
}

function Dashboard({ state }: { state: State }) {
  const pending = state.approvals.filter((a) => a.status === "PENDING");

  async function resolve(id: string, verb: "approve" | "deny", remember = false) {
    await call(`/api/approvals/${id}/${verb}`, { method: "POST", body: JSON.stringify({ remember }) });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Actions today" value={state.stats.total} tone="slate" />
        <Stat label="Safe actions" value={state.stats.allowed} tone="emerald" />
        <Stat label="Parent approvals" value={state.stats.approvals} tone="amber" />
        <Stat label="Blocked actions" value={state.stats.blocked} tone="rose" />
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((a) => (
            <Card key={a.approval_id} className="slidein border-amber-200 bg-amber-50/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-amber-700">
                    {state.child.name}'s AI agent needs permission
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-slate-900">{a.summary}</div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    Site <span className="font-medium text-slate-700">{a.site}</span> · Jev risk{" "}
                    <span className="font-semibold text-amber-700">{Math.round(a.risk * 100)}%</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => resolve(a.approval_id, "approve")}>Approve once</Button>
                  <Button variant="ghost" onClick={() => resolve(a.approval_id, "approve", true)}>
                    Always allow this site
                  </Button>
                  <Button variant="danger" onClick={() => resolve(a.approval_id, "deny")}>
                    Deny
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="border-b border-slate-100 px-5 py-3.5 text-[13px] font-semibold text-slate-900">
          Activity timeline
        </div>
        <ul className="divide-y divide-slate-50">
          {state.verdicts.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">
              Nothing yet — run a scenario in Agent Playground.
            </li>
          )}
          {state.verdicts.map((v) => (
            <li key={v.request_id} className="flex items-start gap-4 px-5 py-3.5">
              <span className="w-16 shrink-0 pt-0.5 text-[12px] tabular-nums text-slate-400">{time(v.timestamp)}</span>
              <span className="pt-0.5 text-[15px] leading-none">{DEC[v.decision].icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-slate-800">{v.explanation}</div>
                <div className="mt-0.5 truncate text-[12px] text-slate-400">
                  {v.action.action_type.replace(/_/g, " ")} · {v.action.target}
                </div>
              </div>
              <Chip decision={v.decision} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  first_name: "First name", last_name: "Last name", age: "Age", email: "Email",
  username: "Username", school: "School", address: "Home address", phone: "Phone number",
  parent_phone: "Parent's phone", photo: "Photos", location: "Location sharing",
  government_id: "Government ID", otp: "One-time passcode", password: "Password",
  payment_card: "Payment card",
};
const ACTION_LABEL: Record<string, string> = {
  purchase: "Purchases", open_external_chat: "External messaging",
  upload_file: "File uploads", send_message: "Messaging strangers",
};
const RULES: Rule[] = ["ALLOW", "ASK", "BLOCK"];

function Policies({ state }: { state: State }) {
  const set = (body: object) =>
    call("/api/policy", { method: "POST", body: JSON.stringify(body) });

  const row = (key: string, label: string, rule: Rule, kind: "field" | "action") => {
    const locked = rule === "ALWAYS_BLOCK";
    return (
      <div key={key} className="flex items-center justify-between gap-4 px-5 py-3">
        <span className="text-[14px] text-slate-800">{label}</span>
        {locked ? (
          <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200">
            🔒 always blocked
          </span>
        ) : (
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {RULES.map((r) => (
              <button
                key={r}
                onClick={() => kind === "field" && set({ field: key, rule: r })}
                disabled={kind === "action"}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed ${
                  rule === r
                    ? r === "ALLOW"
                      ? "bg-emerald-500 text-white"
                      : r === "ASK"
                        ? "bg-amber-500 text-white"
                        : "bg-rose-500 text-white"
                    : "text-slate-500 hover:bg-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="text-[13px] font-semibold text-slate-900">Presets</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.presets.map((p) => (
            <button
              key={p}
              onClick={() => set({ preset: p })}
              className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
                state.child.policy_preset === p
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3.5 text-[13px] font-semibold text-slate-900">
            Personal information
          </div>
          <div className="divide-y divide-slate-50">
            {Object.entries(state.child.policy.fields).map(([f, r]) =>
              row(f, FIELD_LABEL[f] ?? f, r, "field"),
            )}
          </div>
        </Card>
        <Card className="h-fit">
          <div className="border-b border-slate-100 px-5 py-3.5 text-[13px] font-semibold text-slate-900">
            Actions
          </div>
          <div className="divide-y divide-slate-50">
            {Object.entries(state.child.policy.actions).map(([a, r]) =>
              row(a, ACTION_LABEL[a] ?? a, r, "action"),
            )}
          </div>
          <div className="px-5 py-3 text-[12px] text-slate-400">
            Action rules come from the preset. Credentials are never configurable.
          </div>
        </Card>
      </div>
    </div>
  );
}

function Incidents({ state }: { state: State }) {
  const incidents = state.verdicts.filter((v) => v.decision === "BLOCK" || v.decision === "ESCALATE");
  if (incidents.length === 0)
    return (
      <Card className="grid h-64 place-items-center text-sm text-slate-400">
        No incidents. Run the marketplace scam scenario.
      </Card>
    );
  return <div className="space-y-5">{incidents.map((v) => <Incident key={v.request_id} v={v} />)}</div>;
}

function Incident({ v }: { v: Verdict }) {
  const j = v.judgment;
  return (
    <Card className="overflow-hidden border-rose-200">
      <div className="flex items-center gap-3 bg-rose-600 px-6 py-4 text-white">
        <span className="text-2xl">🚨</span>
        <div>
          <div className="text-[17px] font-bold tracking-tight">Guardian blocked an action</div>
          <div className="text-[13px] text-rose-100">
            {time(v.timestamp)} · {v.action.target}
          </div>
        </div>
        <span className="ml-auto rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider">
          {v.decision}
        </span>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Requested">{v.action.data_types?.map((d) => FIELD_LABEL[d] ?? d).join(" + ") || v.action.action_type}</Field>
          <Field label="Recipient">
            {v.action.target} {j.unknown_recipient && <span className="text-rose-600">· unknown user</span>}
          </Field>
          <Field label="Child's goal">{v.action.goal}</Field>
          {v.action.source_message && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message received</div>
              <div className="mt-1.5 rounded-xl bg-slate-50 px-4 py-3 text-[14px] italic leading-snug text-slate-700 ring-1 ring-slate-100">
                “{v.action.source_message}”
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {v.reason_codes.map((r) => (
              <Reason key={r} code={r} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Jev analysis{" "}
            <span className="ml-1 font-mono normal-case tracking-normal text-slate-400">({j.model})</span>
          </div>
          <div className="mt-3 space-y-3">
            <Meter label="Credential risk" value={j.credential_risk} />
            <Meter label="Manipulation risk" value={j.manipulation_risk} />
            <Meter label="Sensitive-data risk" value={j.sensitive_data_risk} />
            <Meter label="Task relevance" value={j.task_relevance} tone="slate" />
          </div>
          <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Decision</div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight text-rose-700">{v.decision}</div>
            <div className="mt-1 text-[13px] text-rose-900/70">
              confidence {Math.round(j.confidence * 100)}% · action never executed
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium text-slate-900">{children}</div>
    </div>
  );
}

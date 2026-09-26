import { useState } from "react";
import { call } from "./api";
import type { Decision, State } from "./types";
import { Button, Card, Chip, Meter, Reason } from "./ui";

const FIELDS = [
  "first_name", "last_name", "age", "email", "username", "school", "address",
  "phone", "parent_phone", "photo", "location", "government_id", "otp", "password", "payment_card",
] as const;

const ACTIONS = [
  "send_message", "open_page", "fill_form", "submit_form",
  "upload_file", "purchase", "share_data", "open_external_chat",
] as const;

interface Result {
  decision: Decision;
  risk: number;
  reason_codes: string[];
  explanation: string;
  request_id: string;
  judgment?: {
    credential_risk: number;
    manipulation_risk: number;
    sensitive_data_risk: number;
    task_relevance: number;
    confidence: number;
    model: string;
    source: string;
  };
}

/** Preset starting points, so you are one click from a realistic case on stage. */
const EXAMPLES = [
  {
    label: "Birthday party invite",
    goal: "Invite friends to my birthday party",
    action_type: "send_message" as const,
    target: "groupchat.kids",
    content: "Party at 14 Oak Street on Saturday at 3pm!",
    fields: ["address"] as string[],
    source: "",
  },
  {
    label: "Homework help",
    goal: "Get help with my science homework",
    action_type: "open_page" as const,
    target: "khanacademy.org",
    content: "",
    fields: [] as string[],
    source: "",
  },
  {
    label: "Free robux scam",
    goal: "Get free game currency",
    action_type: "send_message" as const,
    target: "freerobux-generator.xyz",
    content: "emma_builds / mypassword123",
    fields: ["username", "password"] as string[],
    source: "Enter your account login to claim 10,000 free Robux! Offer expires in 5 minutes.",
  },
  {
    label: "Stranger wants a photo",
    goal: "Make friends in my game community",
    action_type: "send_message" as const,
    target: "discord-dm",
    content: "selfie.jpg",
    fields: ["photo"] as string[],
    source: "you seem cool, send me a pic of yourself so i know youre real. dont tell your parents, they wouldnt get it",
  },
];

export default function TryIt({ state }: { state: State }) {
  const [goal, setGoal] = useState("Sell an in-game item");
  const [actionType, setActionType] = useState<string>("send_message");
  const [target, setTarget] = useState("skintrade.market/chat");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (f: string) =>
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  function load(e: (typeof EXAMPLES)[number]) {
    setGoal(e.goal);
    setActionType(e.action_type);
    setTarget(e.target);
    setContent(e.content);
    setSource(e.source);
    setFields(e.fields);
    setResult(null);
  }

  async function check() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await call<Result>("/api/check", {
          method: "POST",
          body: JSON.stringify({
            goal,
            action_type: actionType,
            target,
            content: content || undefined,
            source_message: source || undefined,
            data_types: fields.length ? fields : undefined,
            recipient_type: "unknown_user",
          }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1.5 w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-slate-900";
  const label = "text-[12px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Check any action</h2>
            <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-slate-600">
              Describe anything an agent might try on {state.child.name}'s behalf. Nothing is
              scripted — this calls the same <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">/api/check</code>{" "}
              endpoint a connected assistant uses, and Jev judges it live.
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              state.jev === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            jev {state.jev}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e.label}
              onClick={() => load(e)}
              className="rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
            >
              {e.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-4">
            <label className="block">
              <span className={label}>What did the child ask for?</span>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} className={input} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Action</span>
                <select value={actionType} onChange={(e) => setActionType(e.target.value)} className={input}>
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Where</span>
                <input value={target} onChange={(e) => setTarget(e.target.value)} className={input} />
              </label>
            </div>

            <label className="block">
              <span className={label}>What the agent would send</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                placeholder="Leave empty if nothing is being sent"
                className={input}
              />
            </label>

            <label className="block">
              <span className={label}>Message the agent is reacting to</span>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                rows={3}
                placeholder="Paste a message from a stranger, or text on the page"
                className={input}
              />
            </label>

            <div>
              <span className={label}>Personal data this would expose</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FIELDS.map((f) => {
                  const on = fields.includes(f);
                  const locked = f === "otp" || f === "password" || f === "payment_card";
                  return (
                    <button
                      key={f}
                      onClick={() => toggle(f)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-[11.5px] font-medium transition ${
                        on
                          ? locked
                            ? "bg-rose-600 text-white"
                            : "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={check} disabled={busy}>
              {busy ? "Asking Jev…" : "Check with Guardian"}
            </Button>
            {error && <div className="text-[13px] font-medium text-rose-600">{error}</div>}
          </div>
        </Card>

        <Card className="p-6">
          {!result && (
            <div className="grid h-full min-h-64 place-items-center text-center text-sm text-slate-400">
              Fill anything in and press Check.
              <br />
              Guardian's verdict appears here.
            </div>
          )}
          {result && (
            <div className="slidein">
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`text-3xl font-bold tracking-tight ${
                    result.decision === "ALLOW"
                      ? "text-emerald-600"
                      : result.decision === "ASK_PARENT"
                        ? "text-amber-600"
                        : "text-rose-600"
                  }`}
                >
                  {result.decision.replace("_", " ")}
                </div>
                <Chip decision={result.decision} />
              </div>

              <p className="mt-2 text-[14px] leading-relaxed text-slate-700">{result.explanation}</p>

              <div className="mt-5">
                <Meter
                  label="Overall risk"
                  value={result.risk}
                  tone={result.decision === "ALLOW" ? "emerald" : "rose"}
                />
              </div>

              {result.reason_codes.length > 0 && (
                <div className="mt-4">
                  <div className={label}>Why</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.reason_codes.map((r) => (
                      <Reason key={r} code={r} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <div className="font-mono text-[11.5px] text-slate-500">{result.request_id}</div>
                <div className="mt-1 text-[12.5px] text-slate-500">
                  Logged to the dashboard timeline. If the verdict was ASK_PARENT, an approval is
                  waiting for you there.
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

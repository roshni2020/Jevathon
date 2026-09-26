import { useEffect, useRef, useState } from "react";
import { api, call } from "./api";
import type { State, StepResult } from "./types";
import { Button, Card, Chip, DEC, Meter, Reason } from "./ui";

/** The centerpiece: child on the left, the agent's browser in the middle, Guardian on the right. */
export default function Playground({ state, reload }: { state: State; reload: () => void }) {
  const [id, setId] = useState("scam");
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [incident, setIncident] = useState<StepResult | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const scenario = state.scenarios.find((s) => s.id === id)!;
  const page = [...steps].reverse().find((s) => s.page)?.page ?? null;

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [steps.length]);

  async function run() {
    setRunning(true);
    setSteps([]);
    setIncident(null);
    await fetch(api("/api/reset"), { method: "POST", credentials: "include" });
    for (let i = 0; i < scenario.step_count; i++) {
      const res: StepResult = await (await fetch(api(`/api/scenario/${id}/step/${i}`), { method: "POST", credentials: "include" })).json();
      setSteps((s) => [...s, res]);
      if (res.verdict.decision === "BLOCK" || res.verdict.decision === "ESCALATE") {
        setIncident(res);
        await new Promise((r) => setTimeout(r, 2600));
        setIncident(null);
      } else {
        await new Promise((r) => setTimeout(r, 850));
      }
    }
    setRunning(false);
    reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {state.scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => !running && (setId(s.id), setSteps([]))}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              s.id === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s.title}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-slate-500">{scenario.blurb}</span>
          <Button onClick={run} disabled={running}>
            {running ? "Running…" : "▶ Run scenario"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.05fr)]">
        {/* --- child --- */}
        <Card className="h-fit p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Child</div>
          <div className="mt-3 flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              E
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-violet-50 px-4 py-3 text-[15px] leading-snug text-slate-800">
              {scenario.prompt}
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent plan</div>
            <ol className="mt-2.5 space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] slidein">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DEC[s.verdict.decision].dot}`} />
                  <span className="text-slate-600">{s.label}</span>
                </li>
              ))}
              {running && <li className="text-[13px] text-slate-400">thinking…</li>}
            </ol>
          </div>
        </Card>

        {/* --- fake browser --- */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <div className="ml-2 flex-1 truncate rounded-md bg-white px-2.5 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
              {steps.at(-1)?.verdict.action.target ?? "about:blank"}
            </div>
            <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {state.browser}
            </span>
          </div>

          <div className="relative min-h-[420px] p-5">
            {!page && <div className="grid h-80 place-items-center text-sm text-slate-400">Agent browser idle</div>}
            {page && (
              <div className="slidein">
                <div className="text-lg font-semibold text-slate-900">{page.title}</div>
                {page.from ? (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                      {page.from.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">{page.from}</div>
                      <div className="mt-1 max-w-md rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-[15px] leading-snug text-slate-800">
                        {page.body}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">{page.body}</p>
                )}

                {steps.at(-1)?.verdict.action.content && (
                  <div className="mt-6">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Agent is about to send
                    </div>
                    <div
                      className={`mt-2 max-w-md rounded-2xl px-4 py-3 font-mono text-[13px] ${
                        steps.at(-1)!.executed
                          ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                          : "bg-rose-50 text-rose-900 line-through ring-1 ring-rose-200"
                      }`}
                    >
                      {steps.at(-1)!.verdict.action.content}
                    </div>
                    {!steps.at(-1)!.executed && (
                      <div className="mt-2 text-[13px] font-semibold text-rose-600">
                        never sent — Guardian stopped it
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* the wow moment */}
            {incident && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-white/85 backdrop-blur-sm">
                <div className="slam pulsering w-[85%] rounded-3xl bg-rose-600 px-8 py-7 text-center text-white shadow-2xl">
                  <div className="text-4xl">🚨</div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">ACTION BLOCKED</div>
                  <div className="mt-3 space-y-1 text-[15px] text-rose-50">
                    {incident.verdict.reason_codes.includes("SOCIAL_ENGINEERING") && <div>Social engineering detected</div>}
                    {incident.verdict.reason_codes.some((r) => r.includes("CREDENTIAL") || r === "OTP_REQUEST") && (
                      <div>OTP / credential sharing prevented</div>
                    )}
                    {incident.verdict.reason_codes.includes("PROMPT_INJECTION") && <div>Injected page instruction ignored</div>}
                    {incident.verdict.reason_codes.includes("EXTERNAL_PLATFORM") && <div>Off-platform contact refused</div>}
                    <div>Parent alerted</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* --- guardian decision stream --- */}
        <Card className="flex max-h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="text-[13px] font-semibold text-slate-900">Guardian decision stream</div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                state.jev === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              jev {state.jev}
            </span>
          </div>
          <div ref={streamRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {steps.length === 0 && (
              <div className="grid h-40 place-items-center text-sm text-slate-400">No actions proposed yet</div>
            )}
            {steps.map((s, i) => (
              <div key={i} className="slidein rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-slate-800">{s.label}</span>
                  <Chip decision={s.verdict.decision} />
                </div>
                <div className="mt-2 grid gap-1.5">
                  <Meter
                    label="Risk"
                    value={s.verdict.risk}
                    tone={s.verdict.decision === "ALLOW" ? "emerald" : "rose"}
                  />
                </div>
                {s.verdict.reason_codes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.verdict.reason_codes.map((r) => (
                      <Reason key={r} code={r} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

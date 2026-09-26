import Gateway3D from "./Gateway3D";
import type { State } from "./types";
import { Card } from "./ui";

const QUESTIONS: [string, string][] = [
  ["actionDecision", "choice · ALLOW / ASK_PARENT / BLOCK / ESCALATE"],
  ["containsSensitiveData", "noul · probability of yes"],
  ["credentialExposure", "noul · probability of yes"],
  ["manipulation", "score · 0–4 rubric"],
  ["taskRelevance", "score · 0–4 rubric"],
  ["unknownRecipient", "noul · probability of yes"],
  ["requiresParentApproval", "noul · probability of yes"],
  ["overallRisk", "score · 0–4 rubric"],
];

const GUARANTEES: [string, string][] = [
  [
    "Credentials are never shareable",
    "One-time passcodes, passwords and card numbers are ALWAYS_BLOCK. No preset, parent override, trusted site or model output can relax them — the policy endpoint refuses the change, and a test asserts it.",
  ],
  [
    "Policy can only tighten",
    "A parent's rules and Jev's judgment are combined with strictest(). Nothing in the pipeline can turn a BLOCK into an ALLOW.",
  ],
  [
    "It fails closed",
    "If the judgment layer throws, times out, or has no API key, the verdict becomes ESCALATE. An outage is a reason to stop, never a reason to proceed.",
  ],
  [
    "One way out",
    "enforce() is the only sanctioned path to a side effect, so no caller can be handed a verdict and forget to read it.",
  ],
];

export default function About({ state }: { state: State }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="px-7 pt-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-500">
            Guardian MCP
          </div>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-slate-900">
            AI agents are starting to act for people. Children shouldn't have to hand one
            unrestricted authority to get the benefit.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Guardian is a safety gateway that sits between an autonomous agent and the outside
            world. Before anything leaves — a message, a form, a file, a payment — the agent must
            ask, and Guardian answers <b>ALLOW</b>, <b>ASK_PARENT</b>, <b>BLOCK</b> or{" "}
            <b>ESCALATE</b>.
          </p>
        </div>
        <div className="mt-6 px-4 pb-4">
          <Gateway3D />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="p-7">
          <h2 className="text-[15px] font-semibold text-slate-900">
            One agent. One call. Eight judgments.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
            There is no separate agent per action, and no chain of prompts. Each proposed action
            becomes one structured state, and Jev answers eight independent typed questions about
            it in a single request. They run in parallel and cannot see each other's answers, so
            their scores stay comparable.
          </p>
          <div className="mt-5 space-y-1.5">
            {QUESTIONS.map(([name, kind]) => (
              <div key={name} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-mono text-[12.5px] font-semibold text-slate-800">{name}</span>
                <span className="text-[11.5px] text-slate-500">{kind}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-slate-600">
            Jev supplies meaning. Deterministic code supplies the rules, and it is the only thing
            that ever decides. The model is never asked <i>"what should I do?"</i> in prose, and it
            never touches execution.
          </p>
        </Card>

        <div className="space-y-6">
          <Card className="p-7">
            <h2 className="text-[15px] font-semibold text-slate-900">What Guardian guarantees</h2>
            <div className="mt-4 space-y-4">
              {GUARANTEES.map(([title, body]) => (
                <div key={title} className="border-l-2 border-emerald-400 pl-4">
                  <div className="text-[14px] font-semibold text-slate-900">{title}</div>
                  <div className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{body}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-7">
            <h2 className="text-[15px] font-semibold text-slate-900">Jev, in two places</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              Runtime child safety is the product. The same model also gates this repository:
              Devin writes a change, CodeRabbit reviews it, and Jev reads the review to return{" "}
              <b>SAFE_TO_DEPLOY</b>, <b>FIX_REQUIRED</b> or <b>HUMAN_REVIEW</b>. A safety gateway
              whose own safety logic ships unreviewed isn't one.
            </p>
            <div className="mt-4 overflow-x-auto">
              <pre className="w-fit rounded-xl bg-slate-900 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-slate-300">
{`Devin → change → PR → CodeRabbit → findings
                                      ↓
                             Jev deployment gate
                                      ↓
              SAFE_TO_DEPLOY | FIX_REQUIRED | HUMAN_REVIEW`}
              </pre>
            </div>
          </Card>

          <Card className="p-7">
            <h2 className="text-[15px] font-semibold text-slate-900">This instance</h2>
            <dl className="mt-3 space-y-2 text-[13.5px]">
              {[
                ["Judgment layer", state.jev === "live" ? "Jev (live)" : "offline heuristic — set TYPESAFE_API_KEY"],
                ["Browser executor", state.browser],
                ["MCP server", "guardian-mcp · 5 tools over stdio"],
                ["Active policy", state.child.policy_preset],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className={`font-medium ${v === "Jev (live)" ? "text-emerald-600" : "text-slate-900"}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["TypeSafe AI / Jev", "CodeRabbit", "Cognition / Devin", "Browserbase", "MCP"].map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

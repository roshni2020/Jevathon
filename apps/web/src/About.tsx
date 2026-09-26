import Gateway3D from "./Gateway3D";
import type { State } from "./types";
import { Card } from "./ui";

const STEPS: [string, string, string][] = [
  [
    "1",
    "A child asks their AI agent for something",
    "“Help me sell my game item.” The agent can browse, message, fill forms, upload files and pay — on her behalf, without an adult watching.",
  ],
  [
    "2",
    "Before it acts, the agent has to ask Guardian",
    "Every action is described first: what it would send, to whom, and which personal details it would expose. Nothing reaches the internet without this step.",
  ],
  [
    "3",
    "Jev reads the situation",
    "Eight questions at once, about that one action: is a password or login code involved, is someone manipulating her, is this even related to what she asked for? It answers with numbers, not opinions.",
  ],
  [
    "4",
    "Guardian decides, and the parent sees it",
    "Code turns those numbers into one of four answers. Safe things go through. Personal things wait for a parent. Dangerous things never happen, and you are told why.",
  ],
];

const DECISIONS: [string, string, string][] = [
  ["ALLOW", "text-emerald-600", "Safe and clearly part of what she asked for. It just happens."],
  ["ASK_PARENT", "text-amber-600", "Something personal, or it costs money. It waits for you."],
  ["BLOCK", "text-rose-600", "It would expose a secret or follow a stranger's instructions. It never runs."],
  ["ESCALATE", "text-rose-700", "Someone is actively trying to exploit her. Blocked, and flagged to you as an incident."],
];

const QUESTIONS: [string, string][] = [
  ["actionDecision", "which of the four answers this action gets"],
  ["containsSensitiveData", "would something private leave"],
  ["credentialExposure", "is a password or login code involved"],
  ["manipulation", "how hard is someone pushing her"],
  ["taskRelevance", "is this even related to what she asked for"],
  ["unknownRecipient", "is the other party a stranger"],
  ["requiresParentApproval", "would a parent want to be asked"],
  ["overallRisk", "how dangerous if it proceeds"],
];

const GUARANTEES: [string, string][] = [
  [
    "A login code can never be shared",
    "One-time passcodes, passwords and card numbers are blocked outright. No setting, no parent override, no trusted site, and no model output can unlock them. There is a test that fails if anyone tries to make it configurable.",
  ],
  [
    "Your rules can only make it stricter",
    "Guardian combines your policy with Jev's judgment by taking whichever is more cautious. Nothing in the system can turn a block into an allow.",
  ],
  [
    "If the AI is unreachable, it stops",
    "No API key, a timeout, a network failure — the answer becomes ESCALATE, not ALLOW. An outage is a reason to stop, never a reason to proceed.",
  ],
  [
    "There is only one way out",
    "Every action leaves through a single function that refuses unless the verdict says ALLOW. No part of the code can act without being checked first.",
  ],
];

export default function About({ state }: { state: State }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="px-7 pt-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-500">
            What this is
          </div>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-slate-900">
            AI agents can now act for people. Children shouldn't have to hand one unrestricted
            authority just to get the benefit.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Guardian sits between a child's AI agent and the outside world. The agent has to ask
            before it sends a message, fills a form, uploads a file or spends money — and Guardian
            answers <b>allow</b>, <b>ask a parent</b>, or <b>block</b>.
          </p>
        </div>
        <div className="mt-6 px-4 pb-4">
          <Gateway3D />
        </div>
      </Card>

      <Card className="p-7">
        <h2 className="text-[15px] font-semibold text-slate-900">How it works</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, title, body]) => (
            <div key={n}>
              <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
                {n}
              </div>
              <div className="mt-3 text-[14px] font-semibold leading-snug text-slate-900">{title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 border-t border-slate-100 pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            The four answers
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {DECISIONS.map(([name, tone, body]) => (
              <div key={name} className="rounded-xl bg-slate-50 px-4 py-3">
                <div className={`font-mono text-[13px] font-bold ${tone}`}>{name}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-slate-600">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Card className="p-7">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Why Jev, and not a chatbot
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
            Guardian never asks a model “what should I do?” and reads back a paragraph. It asks Jev
            eight narrow questions about one action, all in a single request, and gets back typed
            answers — a label, or a number between 0 and 1. There is no text to parse and no way to
            get an answer the code cannot use.
          </p>
          <div className="mt-5 space-y-1.5">
            {QUESTIONS.map(([name, plain]) => (
              <div
                key={name}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="font-mono text-[12.5px] font-semibold text-slate-800">{name}</span>
                <span className="text-[12px] text-slate-500">{plain}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-slate-600">
            Jev supplies the understanding. Plain code makes the decision, every time. That split is
            the whole design: a model that is wrong can still only make Guardian <i>more</i>
            cautious, never less.
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
            <h2 className="text-[15px] font-semibold text-slate-900">Honest limits</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
              Built in one day. Nothing is written to disk — which means no child's messages or
              phone numbers are stored anywhere, but also that a restart clears the history. One
              seeded parent account, no signup. The risk thresholds are reasoned starting points,
              not yet calibrated against real family data.
            </p>
          </Card>

          <Card className="p-7">
            <h2 className="text-[15px] font-semibold text-slate-900">This instance</h2>
            <dl className="mt-3 space-y-2 text-[13.5px]">
              {[
                ["Judgment", state.jev === "live" ? "Jev (live)" : "offline fallback"],
                ["Browser", state.browser],
                ["Connected agents", String(state.connections.length)],
                ["Policy", state.child.policy_preset],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className={`font-medium ${v === "Jev (live)" ? "text-emerald-600" : "text-slate-900"}`}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["TypeSafe AI / Jev", "CodeRabbit", "Cognition / Devin", "Browserbase", "MCP", "Docker"].map((t) => (
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

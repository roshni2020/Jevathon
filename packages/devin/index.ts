/**
 * Devin + CodeRabbit + Jev: the engineering-side loop.
 *
 * Devin writes changes to Guardian. CodeRabbit reviews them. Jev reads the review
 * and decides whether the change may ship — the same model, applied to deploy safety
 * instead of child safety.
 *
 * MOCKED: DevinAdapter.run() posts to Devin's session API only when DEVIN_API_KEY is
 * set; otherwise it returns a recorded result so the loop is demonstrable offline.
 */
import { TypeSafeClient, choice, noul, score, type JsonValue } from "@typesafe-ai/sdk";

export interface DevinTask {
  task: string;
  repo: string;
}
export interface DevinResult {
  branch: string;
  changedFiles: string[];
  status: "completed" | "running" | "failed" | "mocked";
  sessionUrl?: string;
}

export class DevinAdapter {
  constructor(private apiKey = process.env.DEVIN_API_KEY) {}

  async run(task: DevinTask): Promise<DevinResult> {
    if (!this.apiKey?.trim()) {
      return {
        branch: "devin/block-otp-sharing",
        changedFiles: ["packages/guardian-core/policy.ts", "packages/guardian-core/guardian.ts"],
        status: "mocked",
      };
    }
    const res = await fetch("https://api.devin.ai/v1/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `${task.task}\n\nRepository: ${task.repo}` }),
    });
    if (!res.ok) throw new Error(`devin ${res.status}: ${await res.text()}`);
    const s = (await res.json()) as { session_id: string; url?: string };
    return { branch: `devin/${s.session_id}`, changedFiles: [], status: "running", sessionUrl: s.url };
  }
}

export interface CodeRabbitFinding {
  severity: "critical" | "major" | "minor" | "nit";
  category: string;
  file: string;
  comment?: string;
}
export interface DeployGateInput {
  changed_files: string[];
  coderabbit_findings: CodeRabbitFinding[];
  tests_passed: boolean;
}
export interface DeployGateResult {
  decision: "SAFE_TO_DEPLOY" | "FIX_REQUIRED" | "HUMAN_REVIEW";
  confidence: number;
  introduces_bypass: boolean;
  safety_surface: number;
  source: "jev" | "fallback";
  rationale: string;
}

const SAFETY_PATH = /guardian|policy|enforce|mcp|jev/i;

/** Jev reads the review the way a release engineer would, and returns one typed verdict. */
export async function reviewToDeployDecision(input: DeployGateInput): Promise<DeployGateResult> {
  const state = {
    project: "Guardian MCP — a safety gateway that blocks unsafe AI-agent actions taken on behalf of children",
    changed_files: input.changed_files,
    coderabbit_findings: input.coderabbit_findings,
    tests_passed: input.tests_passed,
  } as unknown as Record<string, JsonValue>;

  if (!process.env.TYPESAFE_API_KEY?.trim()) return fallbackGate(input);

  const { answers } = await new TypeSafeClient().systemOne({
    state,
    questions: {
      gate: choice(
        "A code review has just been completed on a change to a child-safety gateway. Given `coderabbit_findings`, `changed_files` and `tests_passed`, what should the release pipeline do with this change?",
        {
          SAFE_TO_DEPLOY: "Nothing in the review threatens the safety guarantees. Ship it.",
          FIX_REQUIRED: "The review found a concrete defect that must be corrected before this can ship.",
          HUMAN_REVIEW: "The change touches safety-critical enforcement, or the review is ambiguous. A person must look at it.",
        },
      ),
      bypass: noul(
        "Do the findings describe a way for an action to reach the outside world without passing the safety check first?",
        {
          true: "Yes, a code path could execute without being checked.",
          false: "No such bypass is described.",
        },
      ),
      surface: score(
        "How much of the safety-critical enforcement surface does this change touch?",
        [
          "None. Documentation, styling, or unrelated code only.",
          "Peripheral code near the gateway, but no decision or enforcement logic.",
          "Supporting logic the gateway relies on.",
          "Policy or decision logic directly.",
          "The enforcement choke point itself, where a mistake removes protection entirely.",
        ],
      ),
    },
  });

  return {
    decision: answers.gate.choice,
    confidence: answers.gate.confidence,
    introduces_bypass: answers.bypass.noul > 0.5,
    safety_surface: answers.surface.score / 4,
    source: "jev",
    rationale: `Jev: ${answers.gate.choice} (confidence ${(answers.gate.confidence * 100).toFixed(0)}%), bypass risk ${(answers.bypass.noul * 100).toFixed(0)}%.`,
  };
}

function fallbackGate(input: DeployGateInput): DeployGateResult {
  const critical = input.coderabbit_findings.some((f) => f.severity === "critical");
  const bypass = input.coderabbit_findings.some((f) => /bypass/i.test(f.category));
  const safety = input.changed_files.some((f) => SAFETY_PATH.test(f));
  const decision = critical || bypass ? "FIX_REQUIRED" : !input.tests_passed ? "FIX_REQUIRED" : safety ? "HUMAN_REVIEW" : "SAFE_TO_DEPLOY";
  return {
    decision,
    confidence: 0.5,
    introduces_bypass: bypass,
    safety_surface: safety ? 0.8 : 0.1,
    source: "fallback",
    rationale: "Offline heuristic: critical or bypass findings block; safety-path changes need a human.",
  };
}

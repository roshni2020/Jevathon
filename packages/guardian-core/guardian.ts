/**
 * The single choke point. Nothing reaches the outside world except through checkAction().
 *
 * Jev supplies meaning; this file supplies the rules. The split matters:
 * a model that returns ALLOW cannot override an ALWAYS_BLOCK field, and a model
 * that is unreachable fails closed rather than open.
 */
import { randomUUID } from "node:crypto";
import { judge } from "../jev/index.js";
import { ruleToDecision, strictest } from "./policy.js";
import { createApproval, getApproval, getChild, recordVerdict } from "./store.js";
import type {
  Approval, DataField, Decision, GuardianVerdict, JevJudgment, ProposedAction, ReasonCode,
} from "./types.js";

export class GuardianBlockedAction extends Error {
  constructor(readonly verdict: GuardianVerdict) {
    super(`Guardian blocked ${verdict.action.action_type}: ${verdict.reason_codes.join(", ")}`);
    this.name = "GuardianBlockedAction";
  }
}
export class GuardianApprovalRequired extends Error {
  constructor(readonly verdict: GuardianVerdict) {
    super(`Guardian requires parent approval for ${verdict.action.action_type}`);
    this.name = "GuardianApprovalRequired";
  }
}

const CREDENTIALS: DataField[] = ["otp", "password", "payment_card"];

/** Evaluate a proposed action. Records the verdict and opens an approval when needed. */
export async function checkAction(action: ProposedAction): Promise<GuardianVerdict> {
  const child = getChild(action.child_id);
  const fields = action.data_types ?? [];

  let judgment: JevJudgment;
  try {
    judgment = await judge(action, child.age);
  } catch (err) {
    // Fail closed. An unreachable judgment layer is a reason to stop, not to proceed.
    judgment = {
      decision: "ESCALATE", risk: 1, contains_sensitive_data: true, credential_risk: 0,
      manipulation_risk: 0, sensitive_data_risk: 0, task_relevance: 0, unknown_recipient: true,
      requires_parent_approval: true, confidence: 0, source: "fallback",
      model: `unavailable: ${(err as Error).message}`,
    };
  }

  const reasons = new Set<ReasonCode>();
  let decision: Decision = judgment.decision;

  // --- Deterministic floor: policy can only tighten what Jev returned. ---
  const credential = fields.filter((f) => CREDENTIALS.includes(f));
  if (credential.length > 0 || judgment.credential_risk > 0.5) {
    decision = "BLOCK";
    reasons.add("CREDENTIAL_EXPOSURE");
    if (fields.includes("otp")) reasons.add("OTP_REQUEST");
    if (fields.includes("password")) reasons.add("PASSWORD_REQUEST");
    if (fields.includes("payment_card")) reasons.add("PAYMENT_RISK");
  }

  for (const f of fields) {
    const rule = child.policy.fields[f];
    if (!rule) continue;
    const policyDecision = ruleToDecision(rule);
    if (policyDecision !== "ALLOW") {
      decision = strictest(decision, policyDecision);
      reasons.add(policyDecision === "BLOCK" ? "POLICY_BLOCK" : "POLICY_ASK");
      if (f === "address" || f === "phone" || f === "parent_phone") reasons.add("PII_EXPOSURE");
      if (f === "location") reasons.add("LOCATION_EXPOSURE");
      if (f === "photo") reasons.add("PHOTO_REQUEST");
    }
  }

  const actionRule = child.policy.actions[action.action_type];
  if (actionRule) {
    const d = ruleToDecision(actionRule);
    if (d !== "ALLOW") {
      decision = strictest(decision, d);
      reasons.add(action.action_type === "open_external_chat" ? "EXTERNAL_PLATFORM" : "POLICY_ASK");
    }
  }

  // --- Jev's semantic signals, escalated by deterministic thresholds. ---
  if (judgment.manipulation_risk >= 0.6) {
    reasons.add("SOCIAL_ENGINEERING");
    decision = strictest(decision, "ESCALATE");
  }
  if (/don'?t tell|do not tell|keep (this|it) (a )?secret|without telling/i.test(action.source_message ?? "")) {
    reasons.add("SECRECY_CUE");
  }
  if (judgment.unknown_recipient && judgment.contains_sensitive_data) reasons.add("UNKNOWN_RECIPIENT");
  if (judgment.task_relevance <= 0.25 && judgment.contains_sensitive_data) {
    reasons.add("OFF_TASK");
    decision = strictest(decision, "ASK_PARENT");
  }
  if (/system notice|ignore (all |previous )?instructions|system:/i.test(action.source_message ?? "")) {
    reasons.add("PROMPT_INJECTION");
    decision = strictest(decision, "BLOCK");
  }
  // requires_parent_approval is a second opinion, not a veto. A confident ALLOW from the
  // decision question stands, because a gateway that interrupts on every routine step is one
  // a parent switches off. It only escalates when there is actually something at stake:
  // data leaving, money moving, or a file going out.
  // A field the parent has already marked ALLOW is not something at stake. If they said a
  // username is fine, Guardian does not interrupt them about a username.
  const stakeFields = fields.filter((f) => child.policy.fields[f] !== "ALLOW");
  const somethingAtStake =
    stakeFields.length > 0 ||
    judgment.contains_sensitive_data ||
    action.action_type === "purchase" ||
    action.action_type === "upload_file" ||
    action.action_type === "open_external_chat";
  if (judgment.requires_parent_approval && somethingAtStake && judgment.confidence >= 0.6) {
    decision = strictest(decision, "ASK_PARENT");
  }

  // A site the parent already trusted downgrades ASK_PARENT, never a BLOCK or ESCALATE.
  if (decision === "ASK_PARENT" && child.trusted_sites.includes(action.target)) {
    decision = "ALLOW";
    reasons.clear();
  }

  const risk = Math.max(
    judgment.risk,
    judgment.credential_risk,
    judgment.manipulation_risk,
    decision === "BLOCK" || decision === "ESCALATE" ? 0.9 : 0,
  );

  const verdict: GuardianVerdict = {
    request_id: `req_${randomUUID().slice(0, 8)}`,
    decision,
    risk: Number(risk.toFixed(2)),
    reason_codes: [...reasons],
    explanation: explain(decision, [...reasons], action),
    judgment,
    action,
    timestamp: new Date().toISOString(),
  };

  if (decision === "ASK_PARENT") {
    verdict.approval_id = createApproval({
      child_id: action.child_id,
      request_id: verdict.request_id,
      summary: summarize(action),
      site: action.target,
      risk: verdict.risk,
      fields,
    }).approval_id;
  }

  return recordVerdict(verdict);
}

/**
 * The only sanctioned path for an agent to act. Throws unless Guardian says ALLOW,
 * so a caller cannot "forget" to check the verdict it was handed.
 */
export async function enforce<T>(action: ProposedAction, execute: () => Promise<T>): Promise<T> {
  const verdict = await checkAction(action);
  if (verdict.decision === "ALLOW") return execute();
  if (verdict.decision === "ASK_PARENT") throw new GuardianApprovalRequired(verdict);
  throw new GuardianBlockedAction(verdict);
}

/** Resume a previously blocked-pending action once the parent has answered. */
export async function enforceWithApproval<T>(
  verdict: GuardianVerdict,
  execute: () => Promise<T>,
): Promise<T> {
  if (verdict.decision === "ALLOW") return execute();
  if (verdict.decision !== "ASK_PARENT" || !verdict.approval_id) throw new GuardianBlockedAction(verdict);
  const approval: Approval | undefined = getApproval(verdict.approval_id);
  if (approval?.status !== "APPROVED") throw new GuardianApprovalRequired(verdict);
  return execute();
}

const LABEL: Record<string, string> = {
  otp: "a one-time passcode", password: "a password", payment_card: "a payment card",
  parent_phone: "their parent's phone number", phone: "a phone number",
  address: "their home address", school: "their school name", location: "their location",
  photo: "a photo of them", government_id: "a government ID", email: "an email address",
  first_name: "their first name", last_name: "their last name", username: "a username", age: "their age",
};

function summarize(a: ProposedAction): string {
  const fields = (a.data_types ?? []).map((f) => LABEL[f] ?? f);
  if (fields.length) return `Share ${fields.join(" and ")}`;
  return `${a.action_type.replace(/_/g, " ")} on ${a.target}`;
}

function explain(decision: Decision, reasons: ReasonCode[], a: ProposedAction): string {
  if (reasons.includes("OTP_REQUEST") || reasons.includes("CREDENTIAL_EXPOSURE"))
    return "A stranger asked for a login code. Guardian stopped it before it was sent.";
  if (reasons.includes("PROMPT_INJECTION"))
    return "Text on the page tried to give the agent new orders. Guardian ignored them.";
  if (reasons.includes("SOCIAL_ENGINEERING"))
    return "The other party is pressuring Emma and asking her to keep it secret.";
  if (reasons.includes("EXTERNAL_PLATFORM"))
    return "Moving the conversation to another app is not allowed.";
  if (decision === "ASK_PARENT") return `${summarize(a)} — waiting for your approval.`;
  if (decision === "ALLOW") return `${summarize(a)} — safe, allowed automatically.`;
  return `${summarize(a)} — blocked by your safety policy.`;
}

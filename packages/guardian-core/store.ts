/**
 * In-memory state + an event bus the dashboard subscribes to over SSE.
 * ponytail: process memory, not SQLite. A hackathon demo restarts more often than it persists.
 * Swap in node:sqlite (built into Node 22+) behind these same functions if persistence matters.
 */
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { PRESETS, type Policy } from "./policy.js";
import type { Approval, DataField, GuardianVerdict } from "./types.js";

export interface Child {
  child_id: string;
  name: string;
  age: number;
  policy_preset: string;
  policy: Policy;
  /** Sites the parent chose "always allow" for, keyed by site. */
  trusted_sites: string[];
}

export const bus = new EventEmitter();

const children = new Map<string, Child>([
  [
    "emma",
    {
      child_id: "emma",
      name: "Emma",
      age: 12,
      policy_preset: "General Browsing",
      policy: PRESETS["General Browsing"],
      trusted_sites: [],
    },
  ],
]);

const verdicts: GuardianVerdict[] = [];
const approvals = new Map<string, Approval>();

export const getChild = (id: string): Child => {
  const c = children.get(id);
  if (!c) throw new Error(`unknown child: ${id}`);
  return c;
};
export const listChildren = () => [...children.values()];

export function setPreset(child_id: string, preset: string) {
  const c = getChild(child_id);
  const p = PRESETS[preset];
  if (!p) throw new Error(`unknown preset: ${preset}`);
  c.policy_preset = preset;
  c.policy = structuredClone(p);
  emit("policy", { child_id, preset });
  return c;
}

export function setFieldRule(child_id: string, field: DataField, rule: Policy["fields"][DataField]) {
  const c = getChild(child_id);
  // Credentials are not parent-configurable. A dashboard toggle must never unlock an OTP.
  if (field === "otp" || field === "password" || field === "payment_card") {
    throw new Error(`${field} is ALWAYS_BLOCK and cannot be relaxed`);
  }
  c.policy.fields[field] = rule;
  emit("policy", { child_id, field, rule });
  return c;
}

export function recordVerdict(v: GuardianVerdict) {
  verdicts.unshift(v);
  emit("verdict", v);
  return v;
}
export const listVerdicts = (child_id?: string, limit = 60) =>
  verdicts.filter((v) => !child_id || v.action.child_id === child_id).slice(0, limit);

export function createApproval(
  a: Omit<Approval, "approval_id" | "status" | "created_at" | "expires_at">,
): Approval {
  const approval: Approval = {
    ...a,
    approval_id: `apr_${randomUUID().slice(0, 8)}`,
    status: "PENDING",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
  approvals.set(approval.approval_id, approval);
  emit("approval", approval);
  return approval;
}

export function getApproval(id: string): Approval | undefined {
  const a = approvals.get(id);
  if (a && a.status === "PENDING" && Date.parse(a.expires_at) < Date.now()) {
    a.status = "EXPIRED";
    emit("approval", a);
  }
  return a;
}

export function resolveApproval(id: string, status: "APPROVED" | "DENIED", remember = false): Approval {
  const a = approvals.get(id);
  if (!a) throw new Error(`unknown approval: ${id}`);
  a.status = status;
  a.remembered = remember;
  if (status === "APPROVED" && remember) {
    const c = getChild(a.child_id);
    if (!c.trusted_sites.includes(a.site)) c.trusted_sites.push(a.site);
  }
  emit("approval", a);
  return a;
}

export const listApprovals = (child_id?: string) =>
  [...approvals.values()]
    .filter((a) => !child_id || a.child_id === child_id)
    .sort((x, y) => y.created_at.localeCompare(x.created_at));

export function stats(child_id: string) {
  const v = listVerdicts(child_id, 1000);
  return {
    total: v.length,
    allowed: v.filter((x) => x.decision === "ALLOW").length,
    approvals: v.filter((x) => x.decision === "ASK_PARENT").length,
    blocked: v.filter((x) => x.decision === "BLOCK" || x.decision === "ESCALATE").length,
  };
}

function emit(type: string, data: unknown) {
  bus.emit("event", { type, data, at: new Date().toISOString() });
}

/** Let other modules push a dashboard refresh without importing the bus directly. */
export const touch = (type: string, data: unknown) => emit(type, data);

/** Demo helper: wipe the timeline between scenario runs. */
export function reset() {
  verdicts.length = 0;
  approvals.clear();
  const c = getChild("emma");
  c.trusted_sites = [];
  emit("reset", {});
}

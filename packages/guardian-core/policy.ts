import type { ActionType, DataField, Decision } from "./types.js";

/** Parent-configurable policy. Deterministic floor: policy can only tighten Jev's verdict. */
export type PolicyRule = "ALLOW" | "ASK" | "BLOCK" | "ALWAYS_BLOCK";

export interface Policy {
  fields: Record<DataField, PolicyRule>;
  actions: Partial<Record<ActionType, PolicyRule>>;
}

const F = (o: Partial<Record<DataField, PolicyRule>>): Record<DataField, PolicyRule> => ({
  first_name: "ALLOW", last_name: "ASK", age: "ALLOW", email: "ASK", username: "ALLOW",
  school: "ASK", address: "BLOCK", phone: "BLOCK", parent_phone: "BLOCK", photo: "ASK",
  location: "BLOCK", government_id: "BLOCK",
  // Credentials are never shareable, by any agent, under any policy or parent override.
  otp: "ALWAYS_BLOCK", password: "ALWAYS_BLOCK", payment_card: "ALWAYS_BLOCK",
  ...o,
});

export const PRESETS: Record<string, Policy> = {
  "General Browsing": {
    fields: F({}),
    actions: { purchase: "ASK", open_external_chat: "BLOCK", upload_file: "ASK" },
  },
  "Homework Mode": {
    fields: F({ email: "ASK", school: "ASK", photo: "BLOCK" }),
    actions: { purchase: "BLOCK", open_external_chat: "BLOCK", upload_file: "ASK", send_message: "ASK" },
  },
  "Gaming & Communities": {
    fields: F({ username: "ALLOW", school: "BLOCK", photo: "ASK" }),
    actions: { purchase: "ASK", open_external_chat: "BLOCK", upload_file: "BLOCK" },
  },
  "Purchases & Messaging": {
    fields: F({ email: "ALLOW", phone: "ASK" }),
    actions: { purchase: "ASK", open_external_chat: "ASK", upload_file: "ASK" },
  },
};

export const ruleToDecision = (r: PolicyRule): Decision =>
  r === "ALLOW" ? "ALLOW" : r === "ASK" ? "ASK_PARENT" : "BLOCK";

/** Strictest wins. */
const RANK: Record<Decision, number> = { ALLOW: 0, ASK_PARENT: 1, ESCALATE: 2, BLOCK: 3 };
export const strictest = (...d: Decision[]): Decision =>
  d.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ALLOW");

export type Decision = "ALLOW" | "ASK_PARENT" | "BLOCK" | "ESCALATE";

export interface Judgment {
  decision: Decision;
  risk: number;
  contains_sensitive_data: boolean;
  credential_risk: number;
  manipulation_risk: number;
  sensitive_data_risk: number;
  task_relevance: number;
  unknown_recipient: boolean;
  requires_parent_approval: boolean;
  confidence: number;
  source: "jev" | "fallback";
  model: string;
}

export interface Verdict {
  request_id: string;
  decision: Decision;
  risk: number;
  reason_codes: string[];
  explanation: string;
  judgment: Judgment;
  action: {
    goal: string;
    action_type: string;
    target: string;
    content?: string;
    data_types?: string[];
    source_message?: string;
  };
  timestamp: string;
  approval_id?: string;
}

export interface Approval {
  approval_id: string;
  summary: string;
  site: string;
  risk: number;
  fields: string[];
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  created_at: string;
}

export interface State {
  parent: { name: string; email: string };
  connections: Connection[];
  agents: Record<AgentKind, { name: string; transport: "stdio" | "http"; note: string }>;
  child: { name: string; age: number; policy_preset: string; policy: Policy; trusted_sites: string[] };
  stats: { total: number; allowed: number; approvals: number; blocked: number };
  verdicts: Verdict[];
  approvals: Approval[];
  presets: string[];
  jev: "live" | "fallback";
  browser: "mock" | "browserbase";
  scenarios: { id: string; title: string; prompt: string; blurb: string; step_count: number }[];
}

export type Rule = "ALLOW" | "ASK" | "BLOCK" | "ALWAYS_BLOCK";
export interface Policy {
  fields: Record<string, Rule>;
  actions: Record<string, Rule>;
}

export interface StepResult {
  label: string;
  page: { title: string; body: string; from?: string } | null;
  verdict: Verdict;
  executed: { executor: string; detail: string; session_url?: string } | null;
}

export type AgentKind = "claude" | "chatgpt" | "coderabbit" | "custom";

export interface Connection {
  connection_id: string;
  child_id: string;
  kind: AgentKind;
  label: string;
  token: string;
  created_at: string;
  last_seen_at: string | null;
  checks: number;
  blocked: number;
  /** Present on /api/connections responses. */
  config?: string;
}

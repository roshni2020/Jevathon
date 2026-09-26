/** Guardian's action schema: everything an agent must declare before acting. */

export type Decision = "ALLOW" | "ASK_PARENT" | "BLOCK" | "ESCALATE";

export type DataField =
  | "first_name" | "last_name" | "age" | "email" | "username"
  | "school" | "address" | "phone" | "parent_phone" | "photo"
  | "location" | "government_id" | "otp" | "password" | "payment_card";

export type ActionType =
  | "open_page" | "send_message" | "fill_form" | "submit_form"
  | "upload_file" | "purchase" | "share_data" | "open_external_chat";

export type RecipientType = "known_site" | "verified_org" | "unknown_user" | "unknown_site";

/** A proposed action, handed to Guardian *before* it executes. */
export interface ProposedAction {
  child_id: string;
  goal: string;
  action_type: ActionType;
  /** Site, chat, or destination the action targets. */
  target: string;
  /** Text the agent intends to send / submit, if any. */
  content?: string;
  /** Personal-data fields the action would expose. */
  data_types?: DataField[];
  /** Untrusted text the agent is reacting to (chat message, page content). */
  source_message?: string;
  recipient_type?: RecipientType;
  metadata?: Record<string, unknown>;
}

/** Typed judgments returned by Jev over a single action state. */
export interface JevJudgment {
  decision: Decision;
  risk: number;
  contains_sensitive_data: boolean;
  credential_risk: number;
  manipulation_risk: number;
  sensitive_data_risk: number;
  task_relevance: number;
  unknown_recipient: boolean;
  requires_parent_approval: boolean;
  /** Confidence in the chosen decision label. */
  confidence: number;
  /** "jev" for live model, "fallback" when no API key is configured. */
  source: "jev" | "fallback";
  model: string;
}

export type ReasonCode =
  | "OTP_REQUEST" | "PASSWORD_REQUEST" | "CREDENTIAL_EXPOSURE"
  | "SOCIAL_ENGINEERING" | "SECRECY_CUE" | "UNKNOWN_RECIPIENT"
  | "OFF_TASK" | "PII_EXPOSURE" | "LOCATION_EXPOSURE"
  | "PAYMENT_RISK" | "PROMPT_INJECTION" | "POLICY_BLOCK"
  | "POLICY_ASK" | "EXTERNAL_PLATFORM" | "PHOTO_REQUEST";

/** The final, enforceable verdict. Produced by deterministic code, never by the model. */
export interface GuardianVerdict {
  request_id: string;
  decision: Decision;
  risk: number;
  reason_codes: ReasonCode[];
  /** Human-readable line for the parent dashboard. */
  explanation: string;
  judgment: JevJudgment;
  action: ProposedAction;
  timestamp: string;
  /** Set when decision is ASK_PARENT: the approval record awaiting a parent. */
  approval_id?: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";

export interface Approval {
  approval_id: string;
  child_id: string;
  request_id: string;
  summary: string;
  site: string;
  risk: number;
  fields: DataField[];
  status: ApprovalStatus;
  created_at: string;
  expires_at: string;
  /** Set by "always allow for this site". */
  remembered?: boolean;
}

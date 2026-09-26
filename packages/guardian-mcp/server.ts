#!/usr/bin/env node
/**
 * guardian-mcp — the MCP server an agent harness calls before it acts.
 *
 * Every tool here routes through checkAction(), so there is no MCP surface that
 * reaches the outside world without a Guardian verdict.
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectionFromToken, recordUse } from "../guardian-core/connections.js";
import { checkAction } from "../guardian-core/guardian.js";
import { ruleToDecision } from "../guardian-core/policy.js";
import * as store from "../guardian-core/store.js";
import type { DataField } from "../guardian-core/types.js";

const server = new McpServer({ name: "guardian-mcp", version: "0.1.0" });

/**
 * The connection token the parent generated when they linked this assistant. It decides
 * WHICH child the calls speak for, so the agent cannot claim to be a different child.
 */
const TOKEN = process.env.GUARDIAN_TOKEN?.trim();
const childFromToken = (claimed?: string) => connectionFromToken(TOKEN)?.child_id ?? claimed ?? "emma";

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const FIELDS = [
  "first_name", "last_name", "age", "email", "username", "school", "address",
  "phone", "parent_phone", "photo", "location", "government_id", "otp", "password", "payment_card",
] as const;

const ACTION_TYPES = [
  "open_page", "send_message", "fill_form", "submit_form",
  "upload_file", "purchase", "share_data", "open_external_chat",
] as const;

server.registerTool(
  "check_action",
  {
    title: "Check a proposed action",
    description:
      "Call this BEFORE performing any action on behalf of a child: sending a message, filling or submitting a form, uploading a file, making a purchase, or opening an external chat. Returns ALLOW, ASK_PARENT, BLOCK or ESCALATE. Only proceed on ALLOW.",
    inputSchema: {
      child_id: z.string().default("emma"),
      goal: z.string().describe("What the child asked for, in their own words."),
      action_type: z.enum(ACTION_TYPES),
      target: z.string().describe("Site, chat, or destination this action reaches."),
      content: z.string().optional().describe("Exact text or payload that would be sent."),
      data_types: z.array(z.enum(FIELDS)).optional().describe("Personal-data fields this action would expose."),
      source_message: z.string().optional().describe("Untrusted text the agent is reacting to."),
      recipient_type: z.enum(["known_site", "verified_org", "unknown_user", "unknown_site"]).optional(),
      metadata: z.record(z.unknown()).optional(),
    },
  },
  async (args) => {
    const v = await checkAction({ ...args, child_id: childFromToken(args.child_id) });
    recordUse(TOKEN, v.decision !== "ALLOW");
    return json({
      decision: v.decision,
      risk: v.risk,
      reason_codes: v.reason_codes,
      request_id: v.request_id,
      approval_id: v.approval_id,
      explanation: v.explanation,
    });
  },
);

server.registerTool(
  "check_message",
  {
    title: "Check an incoming message",
    description:
      "Evaluate an incoming message or page text a child has received, before acting on it. Detects requests for codes and passwords, address or school fishing, platform switching, secrecy and pressure cues, payment manipulation, suspicious links and photo requests.",
    inputSchema: {
      child_id: z.string().default("emma"),
      goal: z.string().default("unspecified"),
      sender: z.string().describe("Who sent it."),
      message: z.string(),
    },
  },
  async ({ child_id, goal, sender, message }) => {
    const v = await checkAction({
      child_id: childFromToken(child_id),
      goal: goal ?? "unspecified",
      action_type: "send_message",
      target: sender,
      source_message: message,
      recipient_type: "unknown_user",
    });
    return json({
      decision: v.decision,
      risk: v.risk,
      reason_codes: v.reason_codes,
      request_id: v.request_id,
      manipulation_risk: v.judgment.manipulation_risk,
      credential_risk: v.judgment.credential_risk,
      safe_to_act_on: v.decision === "ALLOW",
      explanation: v.explanation,
    });
  },
);

server.registerTool(
  "check_data_share",
  {
    title: "Check which fields may be shared",
    description:
      "Given a recipient and a list of personal-data fields, split them into what may be shared, what needs a parent, and what is blocked. Call before filling any form or profile.",
    inputSchema: {
      child_id: z.string().default("emma"),
      recipient: z.string(),
      fields: z.array(z.enum(FIELDS)),
    },
  },
  async ({ child_id, recipient, fields }) => {
    const child = store.getChild(childFromToken(child_id));
    const out = { allowed: [] as DataField[], requires_approval: [] as DataField[], blocked: [] as DataField[] };
    for (const f of fields) {
      const d = ruleToDecision(child.policy.fields[f]);
      if (d === "ALLOW") out.allowed.push(f);
      else if (d === "ASK_PARENT") out.requires_approval.push(f);
      else out.blocked.push(f);
    }
    return json({ recipient, ...out, policy_preset: child.policy_preset });
  },
);

server.registerTool(
  "request_parent_approval",
  {
    title: "Request parent approval",
    description: "Open an approval request in the parent dashboard and return its id. Poll check_approval for the answer.",
    inputSchema: {
      child_id: z.string().default("emma"),
      summary: z.string().describe("What the parent is being asked to approve, in one line."),
      site: z.string(),
      fields: z.array(z.enum(FIELDS)).default([]),
      risk: z.number().min(0).max(1).default(0.3),
    },
  },
  async ({ child_id, summary, site, fields, risk }) =>
    json(
      store.createApproval({
        child_id: childFromToken(child_id),
        request_id: `mcp_${Date.now().toString(36)}`,
        summary,
        site,
        fields: fields ?? [],
        risk: risk ?? 0.3,
      }),
    ),
);

server.registerTool(
  "check_approval",
  {
    title: "Check an approval's status",
    description: "Returns PENDING, APPROVED, DENIED or EXPIRED. Act only on APPROVED.",
    inputSchema: { approval_id: z.string() },
  },
  async ({ approval_id }) => {
    const a = store.getApproval(approval_id);
    if (!a) return json({ status: "EXPIRED", error: "unknown approval_id" });
    return json({ status: a.status, summary: a.summary, site: a.site, may_proceed: a.status === "APPROVED" });
  },
);

await server.connect(new StdioServerTransport());
console.error(`guardian-mcp ready on stdio${TOKEN ? ` (connection ${connectionFromToken(TOKEN)?.connection_id ?? "unrecognized token"})` : " (no GUARDIAN_TOKEN, defaulting to demo child)"}`);

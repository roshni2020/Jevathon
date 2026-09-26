/**
 * Connections: how a parent points their child's AI assistant at Guardian.
 *
 * Guardian is an MCP server, so "connecting an assistant" means registering this server
 * with it under a token that identifies the child. The config the dashboard hands out is
 * the real thing — paste it into the client and its tool calls arrive here.
 */
import { randomBytes } from "node:crypto";

export type AgentKind = "claude" | "chatgpt" | "coderabbit" | "custom";

export interface Connection {
  connection_id: string;
  child_id: string;
  kind: AgentKind;
  label: string;
  /** Secret the client sends as GUARDIAN_TOKEN; identifies the child on every tool call. */
  token: string;
  created_at: string;
  last_seen_at: string | null;
  /** Actions this connection has submitted for judgment. */
  checks: number;
  blocked: number;
}

export const AGENTS: Record<AgentKind, { name: string; transport: "stdio" | "http"; note: string }> = {
  claude: {
    name: "Claude",
    transport: "stdio",
    note: "Claude Desktop and Claude Code speak MCP over stdio. Paste the config into claude_desktop_config.json.",
  },
  chatgpt: {
    name: "ChatGPT",
    transport: "http",
    note: "Add Guardian as a custom connector. Requires the API to be reachable over HTTPS.",
  },
  coderabbit: {
    name: "CodeRabbit",
    transport: "http",
    note: "For an older child using a coding agent: Guardian gates the actions it proposes.",
  },
  custom: {
    name: "Custom agent",
    transport: "stdio",
    note: "Any MCP client, or call the HTTP API directly. check_action is the only endpoint you need.",
  },
};

const connections = new Map<string, Connection>();
const byToken = new Map<string, string>();

export function createConnection(child_id: string, kind: AgentKind, label?: string): Connection {
  const c: Connection = {
    connection_id: `con_${randomBytes(4).toString("hex")}`,
    child_id,
    kind,
    label: label?.trim() || AGENTS[kind].name,
    token: `gdn_${randomBytes(18).toString("base64url")}`,
    created_at: new Date().toISOString(),
    last_seen_at: null,
    checks: 0,
    blocked: 0,
  };
  connections.set(c.connection_id, c);
  byToken.set(c.token, c.connection_id);
  return c;
}

export const listConnections = (child_id?: string) =>
  [...connections.values()].filter((c) => !child_id || c.child_id === child_id);

export function revokeConnection(connection_id: string): boolean {
  const c = connections.get(connection_id);
  if (!c) return false;
  byToken.delete(c.token);
  connections.delete(connection_id);
  return true;
}

/** Resolve the child a token speaks for. Returns null for an unknown or revoked token. */
export const connectionFromToken = (token?: string): Connection | null =>
  (token && connections.get(byToken.get(token) ?? "")) || null;

/** Called on every judged action so the dashboard can show a connection as live. */
export function recordUse(token: string | undefined, blocked: boolean) {
  const c = connectionFromToken(token);
  if (!c) return;
  c.last_seen_at = new Date().toISOString();
  c.checks += 1;
  if (blocked) c.blocked += 1;
}

/** The snippet the parent copies. Real config for the given transport. */
export function configFor(c: Connection, cwd: string, apiUrl: string): string {
  if (AGENTS[c.kind].transport === "stdio") {
    return JSON.stringify(
      {
        mcpServers: {
          guardian: {
            command: "npx",
            args: ["tsx", "packages/guardian-mcp/server.ts"],
            cwd,
            env: { GUARDIAN_TOKEN: c.token, TYPESAFE_API_KEY: "<your key>" },
          },
        },
      },
      null,
      2,
    );
  }
  return [
    `# Guardian check, before any action your agent takes`,
    `curl -X POST ${apiUrl}/api/check \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'X-Guardian-Token: ${c.token}' \\`,
    `  -d '{"goal":"...","action_type":"send_message","target":"...","data_types":["otp"]}'`,
  ].join("\n");
}

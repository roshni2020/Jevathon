/**
 * Auth and connection-token tests. These cover the boundaries that matter once the
 * dashboard is on a network: who may sign in, whose child they may see, and what a
 * leaked or revoked agent token can still do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEMO_LOGIN, canSee, createSession, destroySession, parentFromSession, verifyPassword,
} from "../packages/guardian-core/auth.js";
import {
  configFor, connectionFromToken, createConnection, listConnections, recordUse, revokeConnection,
} from "../packages/guardian-core/connections.js";

test("the right password signs a parent in", () => {
  const parent = verifyPassword(DEMO_LOGIN.email, DEMO_LOGIN.password);
  assert.ok(parent);
  assert.equal(parent.name, "Sarah");
});

test("a wrong password does not", () => {
  assert.equal(verifyPassword(DEMO_LOGIN.email, "guardian1"), null);
  assert.equal(verifyPassword(DEMO_LOGIN.email, ""), null);
});

test("an unknown email does not", () => {
  assert.equal(verifyPassword("stranger@example.com", DEMO_LOGIN.password), null);
});

test("the password is never stored in plaintext", () => {
  const parent = verifyPassword(DEMO_LOGIN.email, DEMO_LOGIN.password)!;
  assert.notEqual(parent.hash, DEMO_LOGIN.password);
  assert.ok(parent.salt.length >= 32, "a per-user salt must be present");
  // Check the credential fields, not the whole record: the demo email itself
  // happens to contain the word "guardian".
  assert.ok(!parent.hash.includes(DEMO_LOGIN.password));
  assert.ok(!parent.salt.includes(DEMO_LOGIN.password));
  assert.match(parent.hash, /^[0-9a-f]{128}$/, "a scrypt digest, not a password");
});

test("a session round-trips, and a signed-out session stops working", () => {
  const parent = verifyPassword(DEMO_LOGIN.email, DEMO_LOGIN.password)!;
  const token = createSession(parent);
  assert.equal(parentFromSession(token)?.parent_id, parent.parent_id);
  destroySession(token);
  assert.equal(parentFromSession(token), null);
});

test("a forged or absent session token is rejected", () => {
  assert.equal(parentFromSession("not-a-real-token"), null);
  assert.equal(parentFromSession(undefined), null);
  assert.equal(parentFromSession(""), null);
});

test("a parent may only see their own child", () => {
  const parent = verifyPassword(DEMO_LOGIN.email, DEMO_LOGIN.password)!;
  assert.equal(canSee(parent, "emma"), true);
  assert.equal(canSee(parent, "someone-elses-kid"), false);
});

test("a connection token resolves to exactly one child", () => {
  const c = createConnection("emma", "claude");
  assert.equal(connectionFromToken(c.token)?.child_id, "emma");
  assert.match(c.token, /^gdn_/);
});

test("an unknown token resolves to nothing, so an agent cannot invent a child", () => {
  assert.equal(connectionFromToken("gdn_madeup"), null);
  assert.equal(connectionFromToken(undefined), null);
});

test("revoking a connection invalidates its token immediately", () => {
  const c = createConnection("emma", "chatgpt");
  assert.ok(connectionFromToken(c.token));
  assert.equal(revokeConnection(c.connection_id), true);
  assert.equal(connectionFromToken(c.token), null);
  assert.ok(!listConnections("emma").some((x) => x.connection_id === c.connection_id));
});

test("two connections never share a token", () => {
  const a = createConnection("emma", "claude");
  const b = createConnection("emma", "claude");
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.connection_id, b.connection_id);
});

test("usage is recorded so a parent can see an assistant is live", () => {
  const c = createConnection("emma", "custom");
  assert.equal(c.last_seen_at, null);
  recordUse(c.token, false);
  recordUse(c.token, true);
  const after = connectionFromToken(c.token)!;
  assert.equal(after.checks, 2);
  assert.equal(after.blocked, 1);
  assert.ok(after.last_seen_at);
});

test("recording against a revoked token is a no-op rather than a crash", () => {
  const c = createConnection("emma", "custom");
  revokeConnection(c.connection_id);
  assert.doesNotThrow(() => recordUse(c.token, true));
});

test("the emitted MCP config carries the token and no placeholder secrets", () => {
  const c = createConnection("emma", "claude");
  const config = configFor(c, "/repo", "http://localhost:8787");
  assert.ok(config.includes(c.token));
  assert.ok(config.includes("guardian-mcp/server.ts"));
  // The parent's own Jev key must never be baked into a config handed to an agent.
  assert.ok(!config.includes(process.env.TYPESAFE_API_KEY ?? "@@none@@"));
});

test("an HTTP-transport connection gets a curl snippet, not an stdio config", () => {
  const c = createConnection("emma", "chatgpt");
  const config = configFor(c, "/repo", "http://localhost:8787");
  assert.ok(config.includes("X-Guardian-Token"));
  assert.ok(!config.includes("mcpServers"));
});

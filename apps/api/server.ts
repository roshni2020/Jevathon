import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { makeExecutor, toBrowserAction } from "../../packages/browser/index.js";
import {
  DEMO_LOGIN, canSee, createSession, destroySession, parentFromSession, verifyPassword, type Parent,
} from "../../packages/guardian-core/auth.js";
import {
  AGENTS, configFor, connectionFromToken, createConnection, listConnections, recordUse, revokeConnection,
  type AgentKind,
} from "../../packages/guardian-core/connections.js";
import { checkAction, GuardianApprovalRequired, GuardianBlockedAction, enforce } from "../../packages/guardian-core/guardian.js";
import { PRESETS } from "../../packages/guardian-core/policy.js";
import { getScenario, SCENARIOS } from "../../packages/guardian-core/scenarios.js";
import * as store from "../../packages/guardian-core/store.js";
import type { DataField } from "../../packages/guardian-core/types.js";
import { jevConfigured } from "../../packages/jev/index.js";
import { reviewToDeployDecision } from "../../packages/devin/index.js";

const app = express();
app.use(express.json());

// The frontend is a separate app on its own origin. Credentials are sent as a cookie, so
// the allowed origin must be explicit rather than "*" when one is configured.
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", ORIGIN);
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Guardian-Token");
  res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const executor = makeExecutor();
const SESSION_COOKIE = "guardian_session";

const readCookie = (req: Request, name: string) =>
  req.headers.cookie
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];

/** Attached by requireParent so handlers can trust req.parent. */
interface AuthedRequest extends Request {
  parent?: Parent;
}

function requireParent(req: AuthedRequest, res: Response, next: NextFunction) {
  const parent = parentFromSession(readCookie(req, SESSION_COOKIE));
  if (!parent) return res.status(401).json({ error: "not signed in" });
  req.parent = parent;
  next();
}

/** A child id the signed-in parent is actually allowed to see. */
function childFor(req: AuthedRequest, res: Response): string | null {
  const child_id = String(req.query.child_id ?? req.body?.child_id ?? req.parent!.children[0]);
  if (!canSee(req.parent!, child_id)) {
    res.status(403).json({ error: "not your child" });
    return null;
  }
  return child_id;
}

// ---------------------------------------------------------------- public
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, jev: jevConfigured() ? "live" : "fallback", browser: executor.name }),
);

app.post("/api/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }
  const parent = verifyPassword(email, password);
  // One message for both failures, so the response cannot be used to enumerate accounts.
  if (!parent) return res.status(401).json({ error: "wrong email or password" });
  const token = createSession(parent);
  res.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${12 * 60 * 60}`,
  );
  res.json({ name: parent.name, email: parent.email, children: parent.children });
});

app.post("/api/logout", (req, res) => {
  destroySession(readCookie(req, SESSION_COOKIE));
  res.set("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get("/api/me", (req: AuthedRequest, res) => {
  const parent = parentFromSession(readCookie(req, SESSION_COOKIE));
  if (!parent) return res.status(401).json({ error: "not signed in" });
  res.json({ name: parent.name, email: parent.email, children: parent.children });
});

/**
 * The agent-facing endpoint. Authenticated by the connection token, not a parent session —
 * an agent has no business holding a parent's credentials.
 */
app.post("/api/check", async (req, res) => {
  try {
    const token = req.header("X-Guardian-Token") ?? undefined;
    const connection = connectionFromToken(token);
    const child_id = connection?.child_id ?? (token ? null : "emma");
    if (!child_id) return res.status(401).json({ error: "unknown or revoked Guardian token" });

    const verdict = await checkAction({ ...req.body, child_id });
    recordUse(token, verdict.decision !== "ALLOW");
    res.json({
      decision: verdict.decision,
      risk: verdict.risk,
      reason_codes: verdict.reason_codes,
      request_id: verdict.request_id,
      approval_id: verdict.approval_id,
      explanation: verdict.explanation,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------- parent, signed in
app.get("/api/events", requireParent, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  const send = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  store.bus.on("event", send);
  const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
  req.on("close", () => {
    clearInterval(ping);
    store.bus.off("event", send);
  });
});

app.get("/api/state", requireParent, (req: AuthedRequest, res) => {
  const child_id = childFor(req, res);
  if (!child_id) return;
  res.json({
    parent: { name: req.parent!.name, email: req.parent!.email },
    child: store.getChild(child_id),
    stats: store.stats(child_id),
    verdicts: store.listVerdicts(child_id),
    approvals: store.listApprovals(child_id),
    connections: listConnections(child_id),
    agents: AGENTS,
    presets: Object.keys(PRESETS),
    jev: jevConfigured() ? "live" : "fallback",
    browser: executor.name,
    scenarios: SCENARIOS.map(({ id, title, prompt, blurb, steps }) => ({
      id, title, prompt, blurb, step_count: steps.length,
    })),
  });
});

app.get("/api/connections", requireParent, (req: AuthedRequest, res) => {
  const child_id = childFor(req, res);
  if (!child_id) return;
  const cwd = process.cwd();
  const apiUrl = `http://localhost:${port}`;
  res.json(listConnections(child_id).map((c) => ({ ...c, config: configFor(c, cwd, apiUrl) })));
});

app.post("/api/connections", requireParent, (req: AuthedRequest, res) => {
  const child_id = childFor(req, res);
  if (!child_id) return;
  const { kind, label } = req.body ?? {};
  if (!kind || !(kind in AGENTS)) {
    return res.status(400).json({ error: `kind must be one of ${Object.keys(AGENTS).join(", ")}` });
  }
  const c = createConnection(child_id, kind as AgentKind, label);
  store.touch("connection", { connection_id: c.connection_id });
  res.json({ ...c, config: configFor(c, process.cwd(), `http://localhost:${port}`) });
});

app.delete("/api/connections/:id", requireParent, (req: AuthedRequest, res) => {
  const connection = listConnections().find((c) => c.connection_id === String(req.params.id));
  if (!connection || !canSee(req.parent!, connection.child_id)) {
    return res.status(404).json({ error: "no such connection" });
  }
  const id = String(req.params.id);
  revokeConnection(id);
  store.touch("connection", { revoked: id });
  res.json({ ok: true });
});

/** Run one scenario step end to end: Guardian decides, the browser only acts on ALLOW. */
app.post("/api/scenario/:id/step/:n", requireParent, async (req: AuthedRequest, res) => {
  try {
    const child_id = childFor(req, res);
    if (!child_id) return;
    const scenario = getScenario(String(req.params.id));
    const step = scenario.steps[Number(req.params.n)];
    if (!step) return res.status(404).json({ error: "no such step" });
    const action = { child_id, ...step.action };

    let executed: unknown = null;
    let verdict;
    try {
      executed = await enforce(action, () => executor.execute(toBrowserAction(action)));
      verdict = store.listVerdicts(child_id, 1)[0];
    } catch (err) {
      if (err instanceof GuardianBlockedAction || err instanceof GuardianApprovalRequired) {
        verdict = err.verdict;
      } else throw err;
    }
    res.json({ label: step.label, page: step.page ?? null, verdict, executed });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/approvals/:id/:verb", requireParent, (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const verb = String(req.params.verb);
  try {
    const approval = store.getApproval(id);
    if (!approval || !canSee(req.parent!, approval.child_id)) {
      return res.status(404).json({ error: "no such approval" });
    }
    if (verb === "approve") return res.json(store.resolveApproval(id, "APPROVED", Boolean(req.body?.remember)));
    if (verb === "deny") return res.json(store.resolveApproval(id, "DENIED"));
    res.status(400).json({ error: "verb must be approve or deny" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/policy", requireParent, (req: AuthedRequest, res) => {
  try {
    const child_id = childFor(req, res);
    if (!child_id) return;
    const { preset, field, rule } = req.body ?? {};
    if (preset) return res.json(store.setPreset(child_id, preset));
    if (field && rule) return res.json(store.setFieldRule(child_id, field as DataField, rule));
    res.status(400).json({ error: "send a preset, or a field and rule" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** Jev's second job: gating a deploy on CodeRabbit's findings. */
app.post("/api/deploy-gate", requireParent, async (req, res) => {
  try {
    res.json(await reviewToDeployDecision(req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/reset", requireParent, (_req, res) => {
  store.reset();
  res.json({ ok: true });
});

/**
 * In a container there is no Vite dev server, so the API serves the built frontend from
 * the same origin. Mounted after the routes so /api/* always wins, and skipped entirely
 * in development where Vite owns :5173.
 */
const WEB_DIST = path.resolve(process.cwd(), "apps/web/dist");
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  // Single-page app: anything that is not an API route falls back to index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
  console.log("serving built frontend from apps/web/dist");
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`guardian api  http://localhost:${port}`);
  console.log(`jev: ${jevConfigured() ? "LIVE (TYPESAFE_API_KEY set)" : "FALLBACK heuristic — set TYPESAFE_API_KEY"}`);
  console.log(`browser executor: ${executor.name}`);
  console.log(`demo login: ${DEMO_LOGIN.email} / ${DEMO_LOGIN.password}`);
});

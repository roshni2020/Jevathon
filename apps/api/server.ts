import "dotenv/config";
import express from "express";
import { makeExecutor, toBrowserAction } from "../../packages/browser/index.js";
import { checkAction, GuardianApprovalRequired, GuardianBlockedAction, enforce } from "../../packages/guardian-core/guardian.js";
import { PRESETS } from "../../packages/guardian-core/policy.js";
import { getScenario, SCENARIOS } from "../../packages/guardian-core/scenarios.js";
import * as store from "../../packages/guardian-core/store.js";
import type { DataField } from "../../packages/guardian-core/types.js";
import { jevConfigured } from "../../packages/jev/index.js";
import { reviewToDeployDecision } from "../../packages/devin/index.js";

const app = express();
app.use(express.json());

// The frontend is a separate app on its own origin. Allow it to call in directly,
// so it works with or without Vite's dev proxy.
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});
app.options("*", (_req, res) => res.sendStatus(204));
const executor = makeExecutor();

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, jev: jevConfigured() ? "live" : "fallback", browser: executor.name }),
);

// --- live event stream for the dashboard ---
app.get("/api/events", (req, res) => {
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

app.get("/api/state", (req, res) => {
  const child_id = String(req.query.child_id ?? "emma");
  res.json({
    child: store.getChild(child_id),
    stats: store.stats(child_id),
    verdicts: store.listVerdicts(child_id),
    approvals: store.listApprovals(child_id),
    presets: Object.keys(PRESETS),
    jev: jevConfigured() ? "live" : "fallback",
    browser: executor.name,
    scenarios: SCENARIOS.map(({ id, title, prompt, blurb, steps }) => ({
      id, title, prompt, blurb, step_count: steps.length,
    })),
  });
});

app.post("/api/check", async (req, res) => {
  try {
    res.json(await checkAction({ child_id: "emma", ...req.body }));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** Run one scenario step end to end: Guardian decides, the browser only acts on ALLOW. */
app.post("/api/scenario/:id/step/:n", async (req, res) => {
  try {
    const scenario = getScenario(req.params.id);
    const step = scenario.steps[Number(req.params.n)];
    if (!step) return res.status(404).json({ error: "no such step" });
    const action = { child_id: "emma", ...step.action };

    let executed: unknown = null;
    let verdict;
    try {
      executed = await enforce(action, () => executor.execute(toBrowserAction(action)));
      verdict = store.listVerdicts("emma", 1)[0];
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

app.get("/api/scenario/:id", (req, res) => {
  try {
    res.json(getScenario(req.params.id));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.post("/api/approvals/:id/:verb", (req, res) => {
  const { id, verb } = req.params;
  try {
    if (verb === "approve") return res.json(store.resolveApproval(id, "APPROVED", Boolean(req.body?.remember)));
    if (verb === "deny") return res.json(store.resolveApproval(id, "DENIED"));
    res.status(400).json({ error: "verb must be approve or deny" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/policy", (req, res) => {
  try {
    const { child_id = "emma", preset, field, rule } = req.body ?? {};
    if (preset) return res.json(store.setPreset(child_id, preset));
    if (field && rule) return res.json(store.setFieldRule(child_id, field as DataField, rule));
    res.status(400).json({ error: "send a preset, or a field and rule" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** Jev's second job: gating a deploy on CodeRabbit's findings. */
app.post("/api/deploy-gate", async (req, res) => {
  try {
    res.json(await reviewToDeployDecision(req.body));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/reset", (_req, res) => {
  store.reset();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`guardian api  http://localhost:${port}`);
  console.log(`jev: ${jevConfigured() ? "LIVE (TYPESAFE_API_KEY set)" : "FALLBACK heuristic — set TYPESAFE_API_KEY"}`);
  console.log(`browser executor: ${executor.name}`);
});

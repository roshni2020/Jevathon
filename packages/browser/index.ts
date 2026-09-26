/**
 * Browser execution behind one interface, so the Guardian check sits in front of
 * whichever executor is wired up. The mock is the default; Browserbase takes over
 * when BROWSERBASE_API_KEY is present.
 */
import type { ProposedAction } from "../guardian-core/types.js";

export interface BrowserAction {
  kind: "navigate" | "type" | "click" | "send_message" | "upload";
  target: string;
  value?: string;
}
export interface BrowserResult {
  ok: boolean;
  executor: "mock" | "browserbase";
  detail: string;
  session_url?: string;
}
export interface BrowserExecutor {
  readonly name: "mock" | "browserbase";
  execute(action: BrowserAction): Promise<BrowserResult>;
}

/** Deterministic simulator. Good enough to demo, and it never needs the network. */
export class MockBrowserExecutor implements BrowserExecutor {
  readonly name = "mock" as const;
  async execute(action: BrowserAction): Promise<BrowserResult> {
    await new Promise((r) => setTimeout(r, 120));
    return { ok: true, executor: "mock", detail: `${action.kind} → ${action.target}` };
  }
}

/**
 * MOCKED SURFACE: creates a real Browserbase session and reports it, but the
 * per-action CDP driving is left as the documented seam below. The Guardian gate
 * is identical either way — that is the point of the interface.
 */
export class BrowserbaseExecutor implements BrowserExecutor {
  readonly name = "browserbase" as const;
  private sessionId?: string;
  constructor(
    private apiKey = process.env.BROWSERBASE_API_KEY!,
    private projectId = process.env.BROWSERBASE_PROJECT_ID,
  ) {}

  /** Browserbase needs a project id; look it up from the key rather than making the user find it. */
  private async project(): Promise<string> {
    if (this.projectId?.trim()) return this.projectId;
    const res = await fetch("https://api.browserbase.com/v1/projects", {
      headers: { "X-BB-API-Key": this.apiKey },
    });
    if (!res.ok) throw new Error(`browserbase projects ${res.status}: ${await res.text()}`);
    const projects = (await res.json()) as { id: string }[];
    if (!projects.length) throw new Error("browserbase: the account has no projects");
    this.projectId = projects[0].id;
    return this.projectId;
  }

  private async session(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    const res = await fetch("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: { "X-BB-API-Key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: await this.project() }),
    });
    if (!res.ok) throw new Error(`browserbase ${res.status}: ${await res.text()}`);
    const { id } = (await res.json()) as { id: string };
    this.sessionId = id;
    return id;
  }

  async execute(action: BrowserAction): Promise<BrowserResult> {
    const id = await this.session();
    // SEAM: connect Playwright over CDP to the session's connectUrl and perform `action`.
    return {
      ok: true,
      executor: "browserbase",
      detail: `${action.kind} → ${action.target} (session ${id})`,
      session_url: `https://browserbase.com/sessions/${id}`,
    };
  }
}

export function makeExecutor(): BrowserExecutor {
  // The project id is optional: the executor discovers it from the key when absent.
  return process.env.BROWSERBASE_API_KEY?.trim() ? new BrowserbaseExecutor() : new MockBrowserExecutor();
}

/** Map a Guardian action onto the browser primitive that would carry it out. */
export function toBrowserAction(a: ProposedAction): BrowserAction {
  switch (a.action_type) {
    case "open_page": return { kind: "navigate", target: a.target };
    case "send_message": return { kind: "send_message", target: a.target, value: a.content };
    case "upload_file": return { kind: "upload", target: a.target, value: a.content };
    case "submit_form": case "purchase": return { kind: "click", target: a.target };
    default: return { kind: "type", target: a.target, value: a.content };
  }
}

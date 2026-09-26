import { useEffect, useState } from "react";
import { call } from "./api";
import type { AgentKind, Connection, State } from "./types";
import { Button, Card, time } from "./ui";

const ICON: Record<AgentKind, string> = { claude: "◆", chatgpt: "◯", coderabbit: "🐰", custom: "⌘" };

export default function Connections({ state, reload }: { state: State; reload: () => void }) {
  const [rows, setRows] = useState<Connection[]>([]);
  const [busy, setBusy] = useState<AgentKind | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => call<Connection[]>("/api/connections").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, [state.connections.length]);

  async function add(kind: AgentKind) {
    setBusy(kind);
    try {
      const c = await call<Connection>("/api/connections", { method: "POST", body: JSON.stringify({ kind }) });
      await load();
      setOpen(c.connection_id);
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    await call(`/api/connections/${id}`, { method: "DELETE" });
    await load();
    reload();
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-slate-900">Connect {state.child.name}'s AI assistant</h2>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600">
          Guardian is an <b>MCP server</b>. Connecting an assistant means registering Guardian with
          it, so the assistant asks Guardian before it acts. Generate a connection below and paste
          the config into the app — every action it proposes then appears on your dashboard.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(state.agents) as AgentKind[]).map((kind) => {
            const a = state.agents[kind];
            return (
              <button
                key={kind}
                onClick={() => add(kind)}
                disabled={busy !== null}
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-900 hover:shadow-md disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ICON[kind]}</span>
                  <span className="text-[14px] font-semibold text-slate-900">{a.name}</span>
                  <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-500">
                    {a.transport}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{a.note}</p>
                <div className="mt-3 text-[12px] font-semibold text-slate-900 group-hover:underline">
                  {busy === kind ? "Generating…" : "+ Connect"}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="grid h-40 place-items-center text-sm text-slate-400">
          No assistants connected yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((c) => (
            <Card key={c.connection_id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="text-lg">{ICON[c.kind]}</span>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold text-slate-900">{c.label}</div>
                  <div className="font-mono text-[11.5px] text-slate-400">{c.connection_id}</div>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-5">
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Checks</div>
                    <div className="text-[15px] font-semibold tabular-nums text-slate-900">{c.checks}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stopped</div>
                    <div className="text-[15px] font-semibold tabular-nums text-rose-600">{c.blocked}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</div>
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.last_seen_at ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className={c.last_seen_at ? "text-emerald-600" : "text-slate-400"}>
                        {c.last_seen_at ? `active ${time(c.last_seen_at)}` : "waiting"}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setOpen(open === c.connection_id ? null : c.connection_id)}>
                    {open === c.connection_id ? "Hide setup" : "Setup"}
                  </Button>
                  <Button variant="danger" onClick={() => revoke(c.connection_id)}>
                    Revoke
                  </Button>
                </div>
              </div>

              {open === c.connection_id && (
                <div className="slidein border-t border-slate-100 bg-slate-50/60 px-5 py-5">
                  <ol className="space-y-4 text-[13.5px] text-slate-700">
                    <li>
                      <b>1.</b> Copy the configuration below.
                      <div className="relative mt-2">
                        <pre className="overflow-x-auto rounded-xl bg-slate-900 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-slate-200">
                          {c.config}
                        </pre>
                        <button
                          onClick={() => copy(c.connection_id, c.config ?? "")}
                          className="absolute right-2.5 top-2.5 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                        >
                          {copied === c.connection_id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </li>
                    <li>
                      <b>2.</b>{" "}
                      {state.agents[c.kind].transport === "stdio" ? (
                        <>
                          Paste it into your assistant's MCP config —{" "}
                          <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11.5px]">
                            claude_desktop_config.json
                          </code>{" "}
                          for Claude Desktop, or{" "}
                          <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11.5px]">.mcp.json</code>{" "}
                          for Claude Code — then restart the app.
                        </>
                      ) : (
                        <>Add Guardian as a custom connector, or have the agent call the endpoint directly before each action.</>
                      )}
                    </li>
                    <li>
                      <b>3.</b> The assistant now has five Guardian tools. It must call{" "}
                      <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11.5px]">check_action</code>{" "}
                      before doing anything, and may only proceed on <b>ALLOW</b>.
                    </li>
                  </ol>

                  <div className="mt-5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Tools this connection exposes
                    </div>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {[
                        ["check_action", "Judge any action before it runs. Returns ALLOW / ASK_PARENT / BLOCK / ESCALATE."],
                        ["check_message", "Judge an incoming message before acting on it."],
                        ["check_data_share", "Split a list of fields into allowed, needs-approval, blocked."],
                        ["request_parent_approval", "Open an approval request on this dashboard."],
                        ["check_approval", "PENDING / APPROVED / DENIED / EXPIRED."],
                      ].map(([name, desc]) => (
                        <div key={name} className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200">
                          <div className="font-mono text-[12px] font-semibold text-slate-900">{name}</div>
                          <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
                    <b>Keep this token private.</b> It identifies {state.child.name} on every call, so
                    an assistant holding it cannot claim to be a different child. Revoke it here and it
                    stops working immediately.
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

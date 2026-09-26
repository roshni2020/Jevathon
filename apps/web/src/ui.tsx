import type { Decision } from "./types";

export const DEC: Record<Decision, { label: string; dot: string; chip: string; icon: string }> = {
  ALLOW: { label: "Allowed", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: "✓" },
  ASK_PARENT: { label: "Needs you", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 ring-amber-200", icon: "⚠" },
  BLOCK: { label: "Blocked", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200", icon: "🚨" },
  ESCALATE: { label: "Escalated", dot: "bg-rose-600", chip: "bg-rose-50 text-rose-700 ring-rose-200", icon: "🚨" },
};

export function Chip({ decision }: { decision: Decision }) {
  const d = DEC[decision];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${d.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${d.dot}`} />
      {decision.replace("_", " ")}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.12)] ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const tones = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  } as const;
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
    </Card>
  );
}

/** A labelled 0–1 bar. Used for every Jev score so they read as one family. */
export function Meter({ label, value, tone = "rose" }: { label: string; value: number; tone?: "rose" | "emerald" | "slate" }) {
  const pct = Math.round(value * 100);
  const bar = tone === "emerald" ? "bg-emerald-500" : tone === "slate" ? "bg-slate-400" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-600">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums text-slate-900">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Reason({ code }: { code: string }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">{code}</span>
  );
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function Button({
  children, onClick, variant = "primary", disabled,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean;
}) {
  const v = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${v}`}
    >
      {children}
    </button>
  );
}

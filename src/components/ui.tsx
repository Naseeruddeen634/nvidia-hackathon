import type { ReactNode } from "react";
import type { Tier } from "@/lib/llm";

export function Panel({ title, right, children, id }: { title: string; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-text">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const TIER_STYLE: Record<Tier | "tavily" | "code", string> = {
  fast: "border-fast/40 text-fast",
  reason: "border-reason/40 text-reason",
  tavily: "border-tavily/40 text-tavily",
  code: "border-line text-muted",
};

export function Badge({ kind, children }: { kind: Tier | "tavily" | "code"; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] ${TIER_STYLE[kind]}`}>
      {children}
    </span>
  );
}

export function shortModel(model: string): string {
  return model.split("/").pop() ?? model;
}

export function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function fmtUsd(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}

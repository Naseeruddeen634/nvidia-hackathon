"use client";

import { STAGES, type RunState, type StageStatus } from "@/lib/runState";
import { Badge, Panel, fmtMs, shortModel } from "./ui";

const DOT: Record<StageStatus, string> = {
  pending: "bg-line",
  running: "bg-warn pulse-dot",
  done: "bg-fast",
  failed: "bg-danger",
};

const ENGINE_KIND = { Tavily: "tavily", "Nemotron Nano": "fast", "Nemotron reasoning": "reason", Code: "code" } as const;

const SOURCE_ICON = { queued: "○", read: "●", skipped: "–", error: "✕" } as const;
const SOURCE_COLOR = { queued: "text-muted", read: "text-fast", skipped: "text-muted", error: "text-danger" } as const;

export function Trace({ state }: { state: RunState }) {
  const read = state.sources.filter((s) => s.status === "read").length;
  return (
    <Panel title="Agent trace" right={state.running ? <span className="text-xs text-warn">running…</span> : null}>
      <ol className="space-y-2">
        {STAGES.map((s) => {
          const st = state.stages[s.id];
          const elapsed = st.startedAt && st.endedAt ? fmtMs(st.endedAt - st.startedAt) : "";
          return (
            <li key={s.id} className="flex items-start gap-3 text-sm">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[st.status]}`} />
              <div className="min-w-0 flex-1">
                <p className={st.status === "pending" ? "text-muted" : "text-text"}>{s.label}</p>
                {(st.detail || elapsed) && (
                  <p className="font-mono text-xs text-muted">
                    {[st.detail, elapsed].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Badge kind={ENGINE_KIND[s.engine as keyof typeof ENGINE_KIND]}>{s.engine}</Badge>
            </li>
          );
        })}
      </ol>

      {state.sources.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">
            Sources: {read} about the company, {state.sources.filter((s) => s.status === "skipped").length} skipped as
            off-topic
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 font-mono text-xs">
            {state.sources.map((s) => (
              <li key={s.doc.url} className="flex items-center gap-2">
                <span className={SOURCE_COLOR[s.status]}>{SOURCE_ICON[s.status]}</span>
                <span className="w-16 shrink-0 whitespace-nowrap text-muted">{s.doc.kind}</span>
                <a href={s.doc.url} target="_blank" rel="noreferrer" className="truncate text-text hover:underline">
                  {s.doc.title}
                </a>
                {s.stats && (
                  <span className="ml-auto shrink-0 text-muted" title={shortModel(s.stats.model)}>
                    {s.mentions.length} tech · {fmtMs(s.stats.ms)}
                  </span>
                )}
                {s.error && <span className="ml-auto shrink-0 truncate text-danger" title={s.error}>error</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-danger">
          {state.errors.map((e, i) => (
            <li key={i}>✕ {e}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

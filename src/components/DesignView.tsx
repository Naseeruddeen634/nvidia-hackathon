"use client";

import type { Design } from "@/lib/types";
import { Mermaid } from "./Mermaid";
import { Panel } from "./ui";

export function DesignView({ design }: { design: Design }) {
  return (
    <Panel title="Integration design">
      <p className="text-sm leading-relaxed text-text">{design.summary}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {design.useCases.map((u) => (
          <div key={u.title} className="rounded-lg border border-line bg-panel-2 p-3">
            <h3 className="text-sm font-semibold">{u.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{u.description}</p>
            {u.touches.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {u.touches.map((t) => (
                  <span key={t} className="rounded bg-bg px-1.5 py-0.5 font-mono text-[11px] text-tavily">
                    {t}
                  </span>
                ))}
              </p>
            )}
          </div>
        ))}
      </div>

      {design.mermaid && (
        <div className="mt-4 rounded-lg border border-line bg-bg p-3">
          <Mermaid code={design.mermaid} />
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Risks</h3>
          <ul className="space-y-2 text-sm">
            {design.risks.map((r) => (
              <li key={r.risk}>
                <span className="text-warn">⚠ {r.risk}</span>
                <span className="block text-xs text-muted">→ {r.mitigation}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Assumptions</h3>
          <ul className="space-y-1.5 text-sm">
            {design.assumptions.map((a) => (
              <li key={a.claim} className="flex gap-2">
                <span
                  className={`h-fit shrink-0 rounded px-1.5 py-0.5 text-[11px] ${a.basis === "confirmed" ? "bg-fast/15 text-fast" : "bg-warn/10 text-warn"}`}
                >
                  {a.basis}
                </span>
                <span className="text-xs text-text">{a.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

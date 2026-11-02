"use client";

import { useState } from "react";
import type { StackItem } from "@/lib/types";
import { Panel } from "./ui";

const CONF_STYLE = {
  high: "bg-fast/15 text-fast border-fast/40",
  medium: "bg-warn/10 text-warn border-warn/40",
  low: "bg-panel-2 text-muted border-line",
} as const;

export function StackView({ stack }: { stack: StackItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const confirmed = stack.filter((s) => s.confidence !== "low").length;
  return (
    <Panel
      title="Inferred stack"
      right={
        <span className="text-xs text-muted">
          {confirmed} confirmed · {stack.length - confirmed} weak signals
        </span>
      }
    >
      {stack.length === 0 ? (
        <p className="text-sm text-muted">No technologies could be confirmed from public sources.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {stack.map((s) => {
            const isOpen = open === s.name;
            return (
              <div key={s.name} className="rounded-lg border border-line bg-panel-2">
                <button
                  onClick={() => setOpen(isOpen ? null : s.name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted">{s.category}</span>
                  <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] ${CONF_STYLE[s.confidence]}`}>
                    {s.confidence} · {s.sources.length} src
                  </span>
                </button>
                {isOpen && (
                  <ul className="space-y-2 border-t border-line px-3 py-2">
                    {s.sources.map((src) => (
                      <li key={src.url} className="text-xs">
                        <q className="text-text">{src.evidence}</q>
                        <a href={src.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-tavily hover:underline">
                          {src.kind} · {src.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

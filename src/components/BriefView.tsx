"use client";

import { useState } from "react";
import type { Question } from "@/lib/types";
import { Panel } from "./ui";

export function BriefView({ questions, company }: { questions: Question[]; company: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = `Discovery questions for ${company}\n\n` + questions.map((q, i) => `${i + 1}. ${q.question}\n   Why: ${q.why}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Panel
      title="Discovery brief"
      right={
        <button onClick={copy} className="rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-panel-2">
          {copied ? "Copied" : "Copy"}
        </button>
      }
    >
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-text">{q.question}</p>
              <p className="mt-0.5 text-xs text-muted">{q.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

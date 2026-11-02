"use client";

import type { CallStats } from "@/lib/llm";
import type { Totals } from "@/lib/types";
import { Badge, Panel, fmtMs, fmtUsd, shortModel } from "./ui";

// Shows the model routing story: many cheap Nano calls, a few reasoning calls.
export function CostPanel({ calls, totals }: { calls: CallStats[]; totals?: Totals }) {
  const tiers = (["fast", "reason"] as const).map((tier) => {
    const c = calls.filter((x) => x.tier === tier);
    return {
      tier,
      model: c[0]?.model,
      calls: c.length,
      tokens: c.reduce((n, x) => n + x.inputTokens + x.outputTokens, 0),
      costUsd: c.reduce((n, x) => n + x.costUsd, 0),
      ms: c.reduce((n, x) => n + x.ms, 0),
    };
  });
  const cost = tiers.reduce((n, t) => n + t.costUsd, 0);

  return (
    <Panel
      title="Model routing & cost"
      right={<span className="font-mono text-xs text-muted">{totals ? `${fmtMs(totals.ms)} wall clock` : ""}</span>}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-2 font-normal">Tier</th>
            <th className="pb-2 pr-2 font-normal">Calls</th>
            <th className="pb-2 pr-2 font-normal">Tokens</th>
            <th className="pb-2 pr-2 font-normal">Time</th>
            <th className="pb-2 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {tiers.map((t) => (
            <tr key={t.tier} className="border-t border-line">
              <td className="py-2">
                <Badge kind={t.tier}>{t.model ? shortModel(t.model) : t.tier === "fast" ? "Nano" : "reasoning"}</Badge>
              </td>
              <td>{t.calls}</td>
              <td>{t.tokens.toLocaleString()}</td>
              <td>{fmtMs(t.ms)}</td>
              <td className="text-right">{fmtUsd(t.costUsd)}</td>
            </tr>
          ))}
          <tr className="border-t border-line text-text">
            <td className="py-2 font-sans font-semibold">Total</td>
            <td>{calls.length}</td>
            <td>{tiers.reduce((n, t) => n + t.tokens, 0).toLocaleString()}</td>
            <td />
            <td className="text-right font-semibold">{fmtUsd(cost)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">All calls run on Nebius Token Factory.</p>
    </Panel>
  );
}

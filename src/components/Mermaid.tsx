"use client";

import { useEffect, useId, useState } from "react";

// Renders model-written Mermaid with securityLevel "strict" (no scripts, no click handlers).
// Falls back to the source text if the diagram doesn't parse.
export function Mermaid({ code }: { code: string }) {
  const id = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        const { svg } = await mermaid.render(id, code.replace(/```(?:mermaid)?/g, "").trim());
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) {
    return <pre className="overflow-x-auto rounded-lg bg-panel-2 p-3 font-mono text-xs text-muted">{code}</pre>;
  }
  if (!svg) return <div className="h-40 animate-pulse rounded-lg bg-panel-2" />;
  return <div className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Run the pipeline from the terminal:
//   npm run pipeline -- "Spotify"                  full run; generated repo is written to out/<company>/
//   npm run pipeline -- "Spotify" --stack-only     stages 1–3 only
//   npm run pipeline -- "Spotify" --research-only  Tavily only, no model calls
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runFullPipeline, runStackPipeline } from "../src/lib/pipeline";
import { researchCompany } from "../src/lib/tavily";
import type { PipelineEvent, Totals } from "../src/lib/types";

const args = process.argv.slice(2);
const company = args.find((a) => !a.startsWith("--"));
if (!company) {
  console.error('Usage: npm run pipeline -- "Company" [--stack-only | --research-only]');
  process.exit(1);
}

if (args.includes("--research-only")) {
  const t = Date.now();
  const docs = await researchCompany(company);
  for (const d of docs) console.log(`[${d.kind}] ${d.title.slice(0, 70)} — ${d.url} (${d.content.length} chars)`);
  console.log(`\n${docs.length} sources in ${Date.now() - t}ms`);
  process.exit(0);
}

const outDir = join("out", company.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
const writes: Promise<void>[] = [];

const log = (e: PipelineEvent) => {
  switch (e.type) {
    case "stage":
      console.log(`\n== ${e.stage} ${e.status}${e.detail ? `: ${e.detail}` : ""}`);
      break;
    case "extract":
      console.log(
        `  ${e.aboutCompany ? "✓" : "·"} ${e.url.slice(0, 70)} — ${e.mentions.map((m) => m.name).join(", ") || "none"} (${e.stats.ms}ms)`,
      );
      break;
    case "extract_error":
      console.log(`  ✗ ${e.url.slice(0, 70)} — ${e.message}`);
      break;
    case "stack":
      for (const s of e.stack) console.log(`  ${s.confidence.padEnd(6)} ${s.score.toFixed(1)}  ${s.name} [${s.category}] ×${s.sources.length}`);
      break;
    case "design":
      console.log(`  ${e.design.summary}`);
      for (const u of e.design.useCases) console.log(`  • ${u.title}: ${u.description}`);
      for (const r of e.design.risks) console.log(`  ! ${r.risk} → ${r.mitigation}`);
      console.log(`  (${e.stats.ms}ms, ${e.stats.outputTokens} tokens)`);
      break;
    case "repo":
      for (const f of e.files) {
        console.log(`  ${f.path} (${f.content.length} chars)`);
        const target = join(outDir, f.path);
        writes.push(mkdir(dirname(target), { recursive: true }).then(() => writeFile(target, f.content)));
      }
      console.log(`  → written to ${outDir}/ (${e.stats.ms}ms, ${e.stats.outputTokens} tokens)`);
      break;
    case "brief":
      for (const q of e.questions) console.log(`  ? ${q.question}\n      (${q.why})`);
      break;
    case "error":
      console.log(`  ✗ ${e.message}`);
      break;
  }
};

const summary = (t: Totals) =>
  `\n${t.calls} calls (fast ${t.byTier.fast.calls}, reason ${t.byTier.reason.calls}), ` +
  `${t.inputTokens}→${t.outputTokens} tokens, $${t.costUsd.toFixed(4)}, ${(t.ms / 1000).toFixed(1)}s`;

if (args.includes("--stack-only")) {
  const { totals } = await runStackPipeline(company, log);
  console.log(summary(totals));
} else {
  const totals = await runFullPipeline(company, log);
  await Promise.all(writes);
  console.log(summary(totals));
}

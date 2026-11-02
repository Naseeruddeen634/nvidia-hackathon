import type { CallStats } from "./llm";
import { TOKEN_FACTORY, type ProductProfile } from "./product";
import { extractMentions, scoreStack, type ScoredInput } from "./stack";
import { designIntegration, discoveryBrief, generateRepo } from "./stages";
import { researchCompany, type SourceDoc } from "./tavily";
import type { PipelineEvent, StackItem, Totals } from "./types";

const EXTRACT_CONCURRENCY = 6;

// Source text stays server-side; only metadata goes to the client.
const meta = (d: SourceDoc): Omit<SourceDoc, "content"> => ({ url: d.url, title: d.title, kind: d.kind });

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

function newTotals(): Totals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    ms: 0,
    byTier: { fast: { calls: 0, costUsd: 0 }, reason: { calls: 0, costUsd: 0 } },
  };
}

function addStats(totals: Totals, s: CallStats) {
  totals.calls++;
  totals.inputTokens += s.inputTokens;
  totals.outputTokens += s.outputTokens;
  totals.costUsd += s.costUsd;
  totals.byTier[s.tier].calls++;
  totals.byTier[s.tier].costUsd += s.costUsd;
}

// Stages 1–3: research → parallel Nano extraction → scoring.
export async function runStackPipeline(
  company: string,
  emit: (e: PipelineEvent) => void,
  totals: Totals = newTotals(),
): Promise<{ stack: StackItem[]; totals: Totals }> {
  const started = Date.now();

  emit({ type: "stage", stage: "research", status: "start" });
  const docs = await researchCompany(company);
  for (const doc of docs) emit({ type: "source", doc: meta(doc) });
  emit({ type: "stage", stage: "research", status: "done", detail: `${docs.length} sources` });

  emit({ type: "stage", stage: "extract", status: "start" });
  const scored: ScoredInput[] = [];
  let firstError: string | undefined;
  await mapLimit(docs, EXTRACT_CONCURRENCY, async (doc) => {
    try {
      const { aboutCompany, mentions, stats } = await extractMentions(company, doc);
      addStats(totals, stats);
      scored.push({ doc: meta(doc), mentions });
      emit({ type: "extract", url: doc.url, aboutCompany, mentions, stats });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      firstError ??= message;
      emit({ type: "extract_error", url: doc.url, message });
    }
  });
  // If no source could be read, the model is unreachable or misconfigured: stop before spending reasoning calls.
  if (docs.length > 0 && scored.length === 0) {
    throw new Error(`Stack extraction failed for all ${docs.length} sources: ${firstError}`);
  }
  emit({ type: "stage", stage: "extract", status: "done", detail: `${scored.length}/${docs.length} sources read` });

  emit({ type: "stage", stage: "score", status: "start" });
  const stack = scoreStack(scored);
  emit({ type: "stack", stack });
  emit({ type: "stage", stage: "score", status: "done", detail: `${stack.length} technologies` });

  totals.ms += Date.now() - started;
  return { stack, totals };
}

// Full run: stages 1–3, then design, then the repo and the brief in parallel.
// A failed repo or brief is reported but doesn't sink the rest of the run.
export async function runFullPipeline(
  company: string,
  emit: (e: PipelineEvent) => void,
  product: ProductProfile = TOKEN_FACTORY,
): Promise<Totals> {
  const totals = newTotals();
  const { stack } = await runStackPipeline(company, emit, totals);
  const started = Date.now();

  emit({ type: "stage", stage: "design", status: "start" });
  const { design, stats } = await designIntegration(company, stack, product);
  addStats(totals, stats);
  emit({ type: "design", design, stats });
  emit({ type: "stage", stage: "design", status: "done", detail: `${design.useCases.length} use cases` });

  const repo = (async () => {
    emit({ type: "stage", stage: "repo", status: "start" });
    try {
      const { files, stats } = await generateRepo(company, stack, design, product);
      addStats(totals, stats);
      emit({ type: "repo", files, stats });
      emit({ type: "stage", stage: "repo", status: "done", detail: `${files.length} files` });
    } catch (e) {
      emit({ type: "error", message: `Repo generation failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  })();

  const brief = (async () => {
    emit({ type: "stage", stage: "brief", status: "start" });
    try {
      const { questions, stats } = await discoveryBrief(company, stack, design, product);
      addStats(totals, stats);
      emit({ type: "brief", questions, stats });
      emit({ type: "stage", stage: "brief", status: "done", detail: `${questions.length} questions` });
    } catch (e) {
      emit({ type: "error", message: `Discovery brief failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  })();

  await Promise.all([repo, brief]);
  totals.ms += Date.now() - started;
  return totals;
}

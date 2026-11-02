import type { CallStats } from "@/lib/llm";
import type { PipelineEvent } from "@/lib/types";

// DEV ONLY: replays synthetic events so the UI can be developed without API keys.
// Returns 404 outside `next dev`, so it never ships as a fake result.
export async function POST() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });

  const fast = (ms: number, out = 120): CallStats => ({ tier: "fast", model: "nvidia/nemotron-nano (sample)", ms, inputTokens: 900, outputTokens: out, costUsd: 0 });
  const reason = (ms: number, out: number): CallStats => ({ tier: "reason", model: "nvidia/nemotron-super (sample)", ms, inputTokens: 1500, outputTokens: out, costUsd: 0 });
  const src = (n: number, kind: "eng-blog" | "jobs" | "talk") => ({ url: `https://example.com/sample-${n}`, title: `Sample source ${n} (synthetic)`, kind });

  const events: [number, PipelineEvent][] = [
    [0, { type: "stage", stage: "research", status: "start" }],
    ...[1, 2, 3, 4, 5].map((n): [number, PipelineEvent] => [150, { type: "source", doc: src(n, n < 3 ? "eng-blog" : n < 5 ? "jobs" : "talk") }]),
    [100, { type: "stage", stage: "research", status: "done", detail: "5 sources" }],
    [100, { type: "stage", stage: "extract", status: "start" }],
    [400, { type: "extract", url: src(1, "eng-blog").url, aboutCompany: true, stats: fast(380), mentions: [
      { name: "Kafka", category: "streaming", evidence: "sample evidence quote", confidence: "stated" },
      { name: "Google Cloud", category: "cloud", evidence: "sample evidence quote", confidence: "stated" },
    ] }],
    [300, { type: "extract", url: src(2, "eng-blog").url, aboutCompany: true, stats: fast(420), mentions: [
      { name: "Kafka", category: "streaming", evidence: "sample evidence quote", confidence: "stated" },
      { name: "Java", category: "language", evidence: "sample evidence quote", confidence: "stated" },
    ] }],
    [300, { type: "extract", url: src(3, "jobs").url, aboutCompany: true, stats: fast(350), mentions: [
      { name: "Python", category: "language", evidence: "sample evidence quote", confidence: "implied" },
    ] }],
    [200, { type: "extract", url: src(4, "jobs").url, aboutCompany: false, stats: fast(300, 20), mentions: [] }],
    [200, { type: "extract_error", url: src(5, "talk").url, message: "sample error" }],
    [100, { type: "stage", stage: "extract", status: "done", detail: "4/5 sources read" }],
    [100, { type: "stage", stage: "score", status: "start" }],
    [100, { type: "stack", stack: [
      { name: "Kafka", category: "streaming", score: 2, confidence: "medium", sources: [
        { url: src(1, "eng-blog").url, title: "Sample source 1 (synthetic)", kind: "eng-blog", evidence: "sample evidence quote" },
        { url: src(2, "eng-blog").url, title: "Sample source 2 (synthetic)", kind: "eng-blog", evidence: "sample evidence quote" },
      ] },
      { name: "Google Cloud", category: "cloud", score: 1, confidence: "low", sources: [{ url: src(1, "eng-blog").url, title: "Sample source 1 (synthetic)", kind: "eng-blog", evidence: "sample evidence quote" }] },
      { name: "Java", category: "language", score: 1, confidence: "low", sources: [{ url: src(2, "eng-blog").url, title: "Sample source 2 (synthetic)", kind: "eng-blog", evidence: "sample evidence quote" }] },
      { name: "Python", category: "language", score: 0.5, confidence: "low", sources: [{ url: src(3, "jobs").url, title: "Sample source 3 (synthetic)", kind: "jobs", evidence: "sample evidence quote" }] },
    ] }],
    [50, { type: "stage", stage: "score", status: "done", detail: "4 technologies" }],
    [100, { type: "stage", stage: "design", status: "start" }],
    [1200, { type: "design", stats: reason(5200, 900), design: {
      summary: "SAMPLE DATA. This is a synthetic design used only to develop the UI without API keys.",
      useCases: [
        { title: "Sample use case A", description: "Synthetic description for layout testing.", touches: ["Kafka", "Python"] },
        { title: "Sample use case B", description: "Synthetic description for layout testing.", touches: ["Google Cloud"] },
      ],
      mermaid: 'flowchart LR\n  K["Kafka topic"] --> W["Python worker"]\n  W --> T["Token Factory\\nNemotron"]\n  T --> S["Results store"]',
      risks: [{ risk: "Sample risk", mitigation: "Sample mitigation" }],
      assumptions: [
        { claim: "Sample confirmed assumption", basis: "confirmed" },
        { claim: "Sample guessed assumption", basis: "guess" },
      ],
    } }],
    [50, { type: "stage", stage: "design", status: "done", detail: "2 use cases" }],
    [50, { type: "stage", stage: "repo", status: "start" }],
    [50, { type: "stage", stage: "brief", status: "start" }],
    [900, { type: "brief", stats: reason(3100, 600), questions: [
      { question: "Sample question one?", why: "Synthetic reason." },
      { question: "Sample question two?", why: "Synthetic reason." },
    ] }],
    [50, { type: "stage", stage: "brief", status: "done", detail: "2 questions" }],
    [900, { type: "repo", stats: reason(7400, 3000), files: [
      { path: "README.md", content: "# Sample repo (synthetic)\n\nUI development fixture.\n" },
      { path: "docker-compose.yml", content: "services:\n  app:\n    build: .\n" },
      { path: "app/main.py", content: 'print("sample")\n' },
    ] }],
    [50, { type: "stage", stage: "repo", status: "done", detail: "3 files" }],
    [50, { type: "done", totals: { calls: 7, inputTokens: 8100, outputTokens: 4920, costUsd: 0, ms: 9800, byTier: { fast: { calls: 4, costUsd: 0 }, reason: { calls: 3, costUsd: 0 } } } }],
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const [delay, e] of events) {
        await new Promise((r) => setTimeout(r, delay));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

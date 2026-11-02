import type { CallStats } from "./llm";
import type { SourceDoc } from "./tavily";
import type { Design, Mention, PipelineEvent, Question, RepoFile, StackItem, Stage, Totals } from "./types";

export const STAGES: { id: Stage; label: string; engine: string }[] = [
  { id: "research", label: "Research public signals", engine: "Tavily" },
  { id: "extract", label: "Extract stack from each source", engine: "Nemotron Nano" },
  { id: "score", label: "Score and cite technologies", engine: "Code" },
  { id: "design", label: "Design the integration", engine: "Nemotron reasoning" },
  { id: "repo", label: "Generate starter repo", engine: "Nemotron reasoning" },
  { id: "brief", label: "Write discovery brief", engine: "Nemotron reasoning" },
];

export type StageStatus = "pending" | "running" | "done" | "failed";

export interface SourceRow {
  doc: Omit<SourceDoc, "content">;
  status: "queued" | "read" | "skipped" | "error";
  mentions: Mention[];
  stats?: CallStats;
  error?: string;
}

export interface RunState {
  company: string;
  running: boolean;
  stages: Record<Stage, { status: StageStatus; detail?: string; startedAt?: number; endedAt?: number }>;
  sources: SourceRow[];
  stack: StackItem[];
  design?: Design;
  repo?: RepoFile[];
  questions?: Question[];
  calls: CallStats[];
  errors: string[];
  totals?: Totals;
}

export function initialState(company = ""): RunState {
  return {
    company,
    running: false,
    stages: Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending" }])) as RunState["stages"],
    sources: [],
    stack: [],
    calls: [],
    errors: [],
  };
}

export type Action = { type: "start"; company: string } | { type: "event"; event: PipelineEvent; now: number } | { type: "end" };

// Failed runs leave the stage that was in progress marked as failed.
function failRunning(stages: RunState["stages"], now: number): RunState["stages"] {
  const next = { ...stages };
  for (const id of Object.keys(next) as Stage[]) {
    if (next[id].status === "running") next[id] = { ...next[id], status: "failed", endedAt: now };
  }
  return next;
}

export function reduce(state: RunState, action: Action): RunState {
  if (action.type === "start") return { ...initialState(action.company), running: true };
  if (action.type === "end") {
    return { ...state, running: false, stages: failRunning(state.stages, Date.now()) };
  }
  const { event: e, now } = action;
  switch (e.type) {
    case "stage": {
      const prev = state.stages[e.stage];
      const stage =
        e.status === "start"
          ? { status: "running" as const, startedAt: now }
          : { ...prev, status: "done" as const, detail: e.detail, endedAt: now };
      return { ...state, stages: { ...state.stages, [e.stage]: stage } };
    }
    case "source":
      return { ...state, sources: [...state.sources, { doc: e.doc, status: "queued", mentions: [] }] };
    case "extract":
      return {
        ...state,
        calls: [...state.calls, e.stats],
        sources: state.sources.map((s) =>
          s.doc.url === e.url ? { ...s, status: e.aboutCompany ? "read" : "skipped", mentions: e.mentions, stats: e.stats } : s,
        ),
      };
    case "extract_error":
      return {
        ...state,
        sources: state.sources.map((s) => (s.doc.url === e.url ? { ...s, status: "error", error: e.message } : s)),
      };
    case "stack":
      return { ...state, stack: e.stack };
    case "design":
      return { ...state, design: e.design, calls: [...state.calls, e.stats] };
    case "repo":
      return { ...state, repo: e.files, calls: [...state.calls, e.stats] };
    case "brief":
      return { ...state, questions: e.questions, calls: [...state.calls, e.stats] };
    case "error": {
      // Repo and brief failures are scoped to their own stage; anything else stops the run.
      const scoped = e.message.startsWith("Repo generation") ? "repo" : e.message.startsWith("Discovery brief") ? "brief" : null;
      const stages = scoped
        ? { ...state.stages, [scoped]: { ...state.stages[scoped], status: "failed" as const, endedAt: now } }
        : failRunning(state.stages, now);
      return { ...state, errors: [...state.errors, e.message], stages };
    }
    case "done":
      return { ...state, totals: e.totals, running: false };
  }
}

// Reads a text/event-stream response and yields each PipelineEvent.
export async function* readEvents(res: Response): AsyncGenerator<PipelineEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (data) yield JSON.parse(data) as PipelineEvent;
    }
  }
}

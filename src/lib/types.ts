import type { CallStats, Tier } from "./llm";
import type { SourceDoc } from "./tavily";

export const CATEGORIES = [
  "language",
  "framework",
  "database",
  "streaming",
  "cloud",
  "data",
  "ml",
  "infra",
  "observability",
  "auth",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

// One technology mention found in one source.
export interface Mention {
  name: string;
  category: Category;
  evidence: string;
  confidence: "stated" | "implied";
}

// A technology after merging mentions across sources.
export interface StackItem {
  name: string;
  category: Category;
  score: number;
  confidence: "high" | "medium" | "low";
  sources: { url: string; title: string; kind: SourceDoc["kind"]; evidence: string }[];
}

export type Stage = "research" | "extract" | "score" | "design" | "repo" | "brief";

export interface Design {
  summary: string;
  useCases: { title: string; description: string; touches: string[] }[];
  mermaid: string;
  risks: { risk: string; mitigation: string }[];
  assumptions: { claim: string; basis: "confirmed" | "guess" }[];
}

export interface RepoFile {
  path: string;
  content: string;
}

export interface Question {
  question: string;
  why: string;
}

// Server-sent events streamed to the UI's live agent trace.
export type PipelineEvent =
  | { type: "stage"; stage: Stage; status: "start" | "done"; detail?: string }
  | { type: "source"; doc: Omit<SourceDoc, "content"> }
  | { type: "extract"; url: string; aboutCompany: boolean; mentions: Mention[]; stats: CallStats }
  | { type: "extract_error"; url: string; message: string }
  | { type: "stack"; stack: StackItem[] }
  | { type: "design"; design: Design; stats: CallStats }
  | { type: "repo"; files: RepoFile[]; stats: CallStats }
  | { type: "brief"; questions: Question[]; stats: CallStats }
  | { type: "error"; message: string }
  | { type: "done"; totals: Totals };

export interface Totals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
  byTier: Record<Tier, { calls: number; costUsd: number }>;
}

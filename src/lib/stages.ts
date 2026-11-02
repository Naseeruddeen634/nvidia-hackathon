import { z } from "zod";
import { chat, chatJson, type CallStats } from "./llm";
import type { ProductProfile } from "./product";
import { CATEGORIES, type Design, type Question, type RepoFile, type StackItem } from "./types";

// Compact, cited stack summary shared by every reasoning prompt.
export function describeStack(stack: StackItem[], limit = 25): string {
  if (stack.length === 0) return "(no technologies confirmed from public sources)";
  return stack
    .slice(0, limit)
    .map((s) => `- ${s.name} [${s.category}] confidence=${s.confidence}, ${s.sources.length} source(s)`)
    .join("\n");
}

// Categories with no evidence at all: the brief asks about these first.
export function missingCategories(stack: StackItem[]): string[] {
  const seen = new Set(stack.map((s) => s.category));
  return CATEGORIES.filter((c) => c !== "other" && !seen.has(c));
}

const DesignSchema = z.object({
  summary: z.string(),
  useCases: z
    .array(z.object({ title: z.string(), description: z.string(), touches: z.array(z.string()).catch([]) }))
    .catch([]),
  mermaid: z.string().catch(""),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).catch([]),
  assumptions: z
    .array(z.object({ claim: z.string(), basis: z.enum(["confirmed", "guess"]).catch("guess") }))
    .catch([]),
});

export async function designIntegration(
  company: string,
  stack: StackItem[],
  product: ProductProfile,
): Promise<{ design: Design; stats: CallStats }> {
  const { data, stats } = await chatJson(
    "reason",
    [
      {
        role: "system",
        content: `You are a senior forward-deployed engineer designing how a vendor product integrates into a prospect's existing systems.
Ground every claim in the provided stack. Anything not in the stack is a guess and must be marked basis="guess".
Respond with JSON only:
{"summary": string (3 sentences),
 "useCases": [{"title", "description", "touches": [stack technology names it connects to]}] (2-3 items, concrete to this company),
 "mermaid": string (a Mermaid "flowchart LR" diagram of the integration, max 12 nodes, node labels in quotes),
 "risks": [{"risk", "mitigation"}] (3-5: auth, data residency, latency, cost, scale),
 "assumptions": [{"claim", "basis": "confirmed"|"guess"}]}`,
      },
      {
        role: "user",
        content: `Prospect: ${company}
Inferred stack (from public sources):
${describeStack(stack)}

Product: ${product.name}
${product.summary}
Capabilities:
${product.capabilities.map((c) => `- ${c}`).join("\n")}`,
      },
    ],
    DesignSchema,
    { maxTokens: 4096 },
  );
  return { design: data, stats };
}

const MAX_FILES = 10;
const MAX_FILE_CHARS = 20_000;

// Model output uses file blocks instead of JSON: code inside JSON strings breaks escaping too often.
//   === FILE: path/to/file ===
//   ...contents...
//   === END FILE ===
export function parseFileBlocks(text: string): RepoFile[] {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const files: RepoFile[] = [];
  const re = /^=== FILE: (.+?) ===\r?\n([\s\S]*?)^=== END FILE ===/gm;
  for (const m of cleaned.matchAll(re)) {
    const path = safePath(m[1]);
    if (!path || files.some((f) => f.path === path)) continue;
    files.push({ path, content: stripFence(m[2]).slice(0, MAX_FILE_CHARS) });
    if (files.length >= MAX_FILES) break;
  }
  return files;
}

// Relative paths only: no absolute paths, no "..", no hidden directories except .env.example.
export function safePath(raw: string): string | null {
  const p = raw.trim().replace(/^\.\/+/, "").replace(/\\/g, "/");
  if (!p || p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === ".." || s === "" || (s.startsWith(".") && s !== ".env.example"))) return null;
  return p;
}

// Models sometimes wrap a whole file in ``` fences inside the block.
function stripFence(content: string): string {
  const fenced = content.match(/^\s*```[\w-]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  return fenced ? fenced[1] + "\n" : content;
}

export async function generateRepo(
  company: string,
  stack: StackItem[],
  design: Design,
  product: ProductProfile,
): Promise<{ files: RepoFile[]; stats: CallStats }> {
  const { text, stats } = await chat(
    "reason",
    [
      {
        role: "system",
        content: `You generate a small, runnable proof-of-concept repository that integrates a vendor product into a prospect's stack.
Requirements:
- docker-compose.yml that starts local stand-ins for the prospect's key systems (only use official public images, e.g. postgres, redis, apache/kafka, mongo) plus one "app" service.
- The app is Python 3.12 using the official "openai" package with base_url and api_key from env vars, and model ids from MODEL_FAST / MODEL_REASON env vars. Never hardcode keys.
- Implement ONE use case from the design end to end, with small realistic sample data shaped like the prospect's domain (seed file or script). No real customer or personal data.
- Include: README.md (what it shows, how to run: cp .env.example .env, docker compose up), .env.example, requirements.txt, Dockerfile for the app.
- At most ${MAX_FILES} files. Keep each file short and correct; prefer working over clever.
Output ONLY file blocks in exactly this format, nothing else:
=== FILE: relative/path ===
<file contents>
=== END FILE ===`,
      },
      {
        role: "user",
        content: `Prospect: ${company}
Stack:
${describeStack(stack, 12)}

Design summary: ${design.summary}
Use cases:
${design.useCases.map((u) => `- ${u.title}: ${u.description} (touches ${u.touches.join(", ")})`).join("\n")}

Product: ${product.name}
${product.integration}`,
      },
    ],
    { maxTokens: 12_000, temperature: 0.2 },
  );
  const files = parseFileBlocks(text);
  if (!files.some((f) => f.path === "docker-compose.yml" || f.path === "compose.yaml")) {
    throw new Error(`Generated repo has no docker-compose.yml (${files.length} files parsed)`);
  }
  return { files, stats };
}

const BriefSchema = z.object({
  questions: z.array(z.object({ question: z.string(), why: z.string() })).catch([]),
});

export async function discoveryBrief(
  company: string,
  stack: StackItem[],
  design: Design,
  product: ProductProfile,
): Promise<{ questions: Question[]; stats: CallStats }> {
  const unconfirmed = [
    ...stack.filter((s) => s.confidence === "low").map((s) => `${s.name} (only weak evidence)`),
    ...design.assumptions.filter((a) => a.basis === "guess").map((a) => a.claim),
  ];
  const { data, stats } = await chatJson(
    "reason",
    [
      {
        role: "system",
        content: `You prepare a forward-deployed engineer for a first technical call with a prospect.
Write 8-10 sharp, specific questions that would change the integration plan if answered. Prioritise unconfirmed assumptions and unknown areas. No generic sales questions.
Respond with JSON only: {"questions": [{"question", "why": "which assumption or gap it resolves"}]}`,
      },
      {
        role: "user",
        content: `Prospect: ${company}
Product: ${product.name}
Confirmed stack:
${describeStack(stack.filter((s) => s.confidence !== "low"), 15)}
Unconfirmed: ${unconfirmed.join("; ") || "none"}
No public evidence for: ${missingCategories(stack).join(", ") || "none"}
Planned use cases: ${design.useCases.map((u) => u.title).join("; ")}`,
      },
    ],
    BriefSchema,
    { maxTokens: 2048 },
  );
  return { questions: data.questions, stats };
}

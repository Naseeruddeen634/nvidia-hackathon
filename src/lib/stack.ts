import { z } from "zod";
import { chatJson, type CallStats } from "./llm";
import type { SourceDoc } from "./tavily";
import { CATEGORIES, type Mention, type StackItem } from "./types";

const MAX_SOURCE_CHARS = 6000;

const ExtractionSchema = z.object({
  aboutCompany: z.boolean(),
  technologies: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.enum(CATEGORIES).catch("other"),
        evidence: z.string(),
        confidence: z.enum(["stated", "implied"]).catch("implied"),
      }),
    )
    .catch([]),
});

const SYSTEM = `You extract the technology stack a specific company uses from one public web source.
Rules:
- Only list technologies THIS company itself uses in production or engineering. Ignore technologies merely mentioned, sold by vendors, or used by other companies in the text.
- If the source is not about the company's own engineering, set aboutCompany=false and return no technologies.
- "stated": the text says the company uses it. "implied": strongly suggested (e.g. a job post requiring it).
- evidence: a short quote (max 20 words) copied from the text.
- Use canonical product names (e.g. "PostgreSQL", "Kubernetes", "Google Cloud").
Respond with JSON only: {"aboutCompany": boolean, "technologies": [{"name", "category", "evidence", "confidence"}]}
category is one of: ${CATEGORIES.join(", ")}.`;

export async function extractMentions(
  company: string,
  doc: SourceDoc,
): Promise<{ aboutCompany: boolean; mentions: Mention[]; stats: CallStats }> {
  const { data, stats } = await chatJson(
    "fast",
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Company: ${company}\nSource kind: ${doc.kind}\nTitle: ${doc.title}\nURL: ${doc.url}\n\nText:\n${doc.content.slice(0, MAX_SOURCE_CHARS)}`,
      },
    ],
    ExtractionSchema,
  );
  return { aboutCompany: data.aboutCompany, mentions: data.aboutCompany ? data.technologies : [], stats };
}

// Spellings that should merge into one technology.
const ALIASES: Record<string, string> = {
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  gcp: "Google Cloud",
  "google cloud platform": "Google Cloud",
  "google cloud": "Google Cloud",
  aws: "AWS",
  "amazon web services": "AWS",
  "apache kafka": "Kafka",
  kafka: "Kafka",
  "apache spark": "Spark",
  spark: "Spark",
  golang: "Go",
  go: "Go",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  "react.js": "React",
  reactjs: "React",
  react: "React",
  "node.js": "Node.js",
  nodejs: "Node.js",
  node: "Node.js",
  azure: "Azure",
  "microsoft azure": "Azure",
  bigquery: "BigQuery",
  "google bigquery": "BigQuery",
};

export function canonicalName(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[key] ?? name.trim();
}

export interface ScoredInput {
  doc: Omit<SourceDoc, "content">;
  mentions: Mention[];
}

// Score = sum over distinct sources (stated 1, implied 0.5), +0.5 if seen in 2+ kinds of source.
export function scoreStack(inputs: ScoredInput[]): StackItem[] {
  const byName = new Map<string, { item: StackItem; kinds: Set<string>; urls: Set<string> }>();
  for (const { doc, mentions } of inputs) {
    for (const m of mentions) {
      const name = canonicalName(m.name);
      const key = name.toLowerCase();
      let entry = byName.get(key);
      if (!entry) {
        entry = {
          item: { name, category: m.category, score: 0, confidence: "low", sources: [] },
          kinds: new Set(),
          urls: new Set(),
        };
        byName.set(key, entry);
      }
      if (entry.urls.has(doc.url)) continue;
      entry.urls.add(doc.url);
      entry.kinds.add(doc.kind);
      entry.item.score += m.confidence === "stated" ? 1 : 0.5;
      entry.item.sources.push({ url: doc.url, title: doc.title, kind: doc.kind, evidence: m.evidence });
      if (entry.item.category === "other" && m.category !== "other") entry.item.category = m.category;
    }
  }
  return [...byName.values()]
    .map(({ item, kinds }) => {
      const score = item.score + (kinds.size >= 2 ? 0.5 : 0);
      const confidence: StackItem["confidence"] = score >= 2.5 ? "high" : score >= 1.5 ? "medium" : "low";
      return { ...item, score, confidence };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

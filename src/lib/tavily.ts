import { tavily } from "@tavily/core";

export interface SourceDoc {
  url: string;
  title: string;
  content: string;
  kind: "eng-blog" | "jobs" | "github" | "talk" | "other";
}

// Without TAVILY_API_KEY, Tavily's limited keyless tier is used (fine for development, not for the demo).
const client = () => tavily({ apiKey: process.env.TAVILY_API_KEY ?? "" });

// Public signals that reveal a company's stack. Each query maps to a source kind for the evidence UI.
function queriesFor(company: string): { q: string; kind: SourceDoc["kind"] }[] {
  return [
    { q: `${company} engineering blog architecture infrastructure`, kind: "eng-blog" },
    { q: `${company} engineering blog data platform migration`, kind: "eng-blog" },
    { q: `${company} software engineer job posting tech stack requirements`, kind: "jobs" },
    { q: `${company} github open source repositories`, kind: "github" },
    { q: `${company} engineers conference talk how we built`, kind: "talk" },
  ];
}

export async function researchCompany(company: string, maxPerQuery = 5): Promise<SourceDoc[]> {
  const tv = client();
  const results = await Promise.all(
    queriesFor(company).map(async ({ q, kind }) => {
      const res = await tv.search(q, { maxResults: maxPerQuery, searchDepth: "advanced" });
      return res.results.map((r) => ({ url: r.url, title: r.title, content: r.content, kind }));
    }),
  );
  // Dedupe on the URL without scheme, "www." or trailing slash, so http/https copies collapse.
  const key = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();
  const seen = new Set<string>();
  return results.flat().filter((d) => !seen.has(key(d.url)) && seen.add(key(d.url)));
}

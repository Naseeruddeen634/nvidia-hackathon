// Smoke test: lists the Nemotron models your key can use, then makes one call per tier and one Tavily search.
// Run: npm run smoke   (reads .env.local)
import OpenAI from "openai";
import { tavily } from "@tavily/core";

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);

const client = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

let failed = false;

try {
  const models = await client.models.list();
  const ids = models.data.map((m) => m.id).filter((id) => /nemotron/i.test(id));
  ok(`Token Factory reachable. Nemotron models on this key:\n    ${ids.join("\n    ") || "(none found)"}`);
} catch (e) {
  bad(`Listing models failed: ${e.message}`);
  failed = true;
}

for (const [tier, model] of [["fast", process.env.MODEL_FAST], ["reason", process.env.MODEL_REASON]]) {
  if (!model) { bad(`MODEL_${tier.toUpperCase()} not set`); failed = true; continue; }
  try {
    const t = Date.now();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
      max_tokens: 200,
      temperature: 0,
    });
    const u = res.usage;
    ok(`${tier} (${model}) ${Date.now() - t}ms, ${u?.prompt_tokens}→${u?.completion_tokens} tokens: ${res.choices[0].message.content?.trim().slice(0, 80)}`);
  } catch (e) {
    bad(`${tier} (${model}) failed: ${e.message}`);
    failed = true;
  }
}

try {
  const t = Date.now();
  const res = await tavily({ apiKey: process.env.TAVILY_API_KEY }).search("Spotify engineering blog Kafka", { maxResults: 3 });
  ok(`Tavily ${Date.now() - t}ms: ${res.results.map((r) => r.url).join(", ")}`);
} catch (e) {
  bad(`Tavily failed: ${e.message}`);
  failed = true;
}

process.exit(failed ? 1 : 0);

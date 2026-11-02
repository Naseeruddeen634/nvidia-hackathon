import OpenAI from "openai";
import type { ZodType } from "zod";

// Two tiers: FAST (Nemotron Nano) for high-volume extraction, REASON (Nemotron Super/Ultra)
// for design and code generation. Both run on Nebius Token Factory.
export type Tier = "fast" | "reason";

export interface CallStats {
  tier: Tier;
  model: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Created on first use so importing this module never fails when the key is missing.
let cached: OpenAI | undefined;
function client(): OpenAI {
  if (!process.env.NEBIUS_API_KEY) throw new Error("NEBIUS_API_KEY is not set");
  cached ??= new OpenAI({
    baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
    apiKey: process.env.NEBIUS_API_KEY,
  });
  return cached;
}

export function modelFor(tier: Tier): string {
  const id = tier === "fast" ? process.env.MODEL_FAST : process.env.MODEL_REASON;
  if (!id) throw new Error(`MODEL_${tier === "fast" ? "FAST" : "REASON"} is not set`);
  return id;
}

function price(tier: Tier): { inp: number; out: number } {
  const p = tier === "fast" ? "FAST" : "REASON";
  return {
    inp: Number(process.env[`PRICE_${p}_IN`] ?? 0),
    out: Number(process.env[`PRICE_${p}_OUT`] ?? 0),
  };
}

export async function chat(
  tier: Tier,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<{ text: string; stats: CallStats }> {
  const model = modelFor(tier);
  const started = Date.now();
  const res = await client().chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? (tier === "fast" ? 1024 : 4096),
    temperature: opts.temperature ?? (tier === "fast" ? 0 : 0.3),
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  const usage = res.usage;
  const { inp, out } = price(tier);
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  return {
    text: res.choices[0]?.message?.content ?? "",
    stats: {
      tier,
      model,
      ms: Date.now() - started,
      inputTokens,
      outputTokens,
      costUsd: (inputTokens * inp + outputTokens * out) / 1_000_000,
    },
  };
}

// Reasoning models may wrap JSON in <think> blocks or ``` fences; pull out the first object.
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function chatJson<T>(
  tier: Tier,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  schema: ZodType<T>,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<{ data: T; stats: CallStats }> {
  const { text, stats } = await chat(tier, messages, { ...opts, json: true });
  return { data: schema.parse(extractJson(text)), stats };
}

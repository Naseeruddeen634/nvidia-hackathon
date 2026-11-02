import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalName, scoreStack, type ScoredInput } from "../src/lib/stack";
import { extractJson } from "../src/lib/llm";

const doc = (url: string, kind: ScoredInput["doc"]["kind"]) => ({ url, title: url, kind });

test("canonicalName merges aliases and keeps unknown names", () => {
  assert.equal(canonicalName("postgres"), "PostgreSQL");
  assert.equal(canonicalName("  Apache   Kafka "), "Kafka");
  assert.equal(canonicalName("K8s"), "Kubernetes");
  assert.equal(canonicalName("Backstage"), "Backstage");
});

test("scoreStack counts each source once and rewards source diversity", () => {
  const stack = scoreStack([
    {
      doc: doc("a", "eng-blog"),
      mentions: [
        { name: "Kafka", category: "streaming", evidence: "we run Kafka", confidence: "stated" },
        { name: "apache kafka", category: "streaming", evidence: "dup in same source", confidence: "stated" },
      ],
    },
    { doc: doc("b", "jobs"), mentions: [{ name: "kafka", category: "streaming", evidence: "Kafka a plus", confidence: "implied" }] },
    { doc: doc("c", "eng-blog"), mentions: [{ name: "Go", category: "language", evidence: "written in Go", confidence: "stated" }] },
  ]);
  const kafka = stack.find((s) => s.name === "Kafka")!;
  assert.equal(kafka.sources.length, 2);
  assert.equal(kafka.score, 2); // 1 stated + 0.5 implied + 0.5 diversity
  assert.equal(kafka.confidence, "medium");
  assert.equal(stack[0].name, "Kafka");
  assert.equal(stack.find((s) => s.name === "Go")!.confidence, "low");
});

test("scoreStack fills an 'other' category from a later, more specific mention", () => {
  const [item] = scoreStack([
    { doc: doc("a", "other"), mentions: [{ name: "Flink", category: "other", evidence: "", confidence: "stated" }] },
    { doc: doc("b", "talk"), mentions: [{ name: "Flink", category: "streaming", evidence: "", confidence: "stated" }] },
  ]);
  assert.equal(item.category, "streaming");
  assert.equal(item.confidence, "high");
});

test("extractJson strips think blocks and code fences", () => {
  assert.deepEqual(extractJson('<think>hmm {"no":1}</think>\n```json\n{"ok": true}\n```'), { ok: true });
  assert.throws(() => extractJson("no json here"));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { describeStack, missingCategories, parseFileBlocks, safePath } from "../src/lib/stages";
import type { StackItem } from "../src/lib/types";

const item = (name: string, category: StackItem["category"], confidence: StackItem["confidence"]): StackItem => ({
  name,
  category,
  confidence,
  score: 1,
  sources: [],
});

test("safePath keeps relative paths and rejects escapes", () => {
  assert.equal(safePath("app/main.py"), "app/main.py");
  assert.equal(safePath("./README.md"), "README.md");
  assert.equal(safePath("app\\seed.py"), "app/seed.py");
  assert.equal(safePath(".env.example"), ".env.example");
  for (const bad of ["/etc/passwd", "../x", "a/../../x", "C:/x", ".env", ".git/config", "a//b", ""]) {
    assert.equal(safePath(bad), null, bad);
  }
});

test("parseFileBlocks reads blocks, strips fences and think blocks, drops unsafe and duplicate paths", () => {
  const out = parseFileBlocks(`<think>
=== FILE: hidden.txt ===
no
=== END FILE ===
</think>
Here is the repo:
=== FILE: docker-compose.yml ===
services:
  app:
    build: .
=== END FILE ===
=== FILE: app/main.py ===
\`\`\`python
print("hi")
\`\`\`
=== END FILE ===
=== FILE: ../evil.sh ===
rm -rf /
=== END FILE ===
=== FILE: docker-compose.yml ===
duplicate
=== END FILE ===
`);
  assert.deepEqual(
    out.map((f) => f.path),
    ["docker-compose.yml", "app/main.py"],
  );
  assert.equal(out[0].content, "services:\n  app:\n    build: .\n");
  assert.equal(out[1].content, 'print("hi")\n');
});

test("missingCategories lists categories with no evidence", () => {
  const missing = missingCategories([item("Go", "language", "high"), item("Kafka", "streaming", "low")]);
  assert.ok(missing.includes("database"));
  assert.ok(!missing.includes("language"));
  assert.ok(!missing.includes("streaming"));
  assert.ok(!missing.includes("other"));
});

test("describeStack handles an empty stack", () => {
  assert.match(describeStack([]), /no technologies confirmed/);
  assert.match(describeStack([item("Go", "language", "high")]), /Go \[language\] confidence=high/);
});

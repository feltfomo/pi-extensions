import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseConfig } from "../src/lib/config.ts";

test("default config supplies a compact footer and retains optional disabled widgets", async () => {
  const config = parseConfig(JSON.parse(await readFile(new URL("../footer.json", import.meta.url), "utf8")));
  assert.equal(config.lines.length, 2);
  const widgets = (line: typeof config.lines[number]) => [...line.left, ...line.center, ...line.right].map((entry) => entry.widget);
  assert.deepEqual(widgets(config.lines[0]), ["project-root", "session", "git", "diff"]);
  assert.deepEqual(widgets(config.lines[1]), ["provider", "model", "thinking", "extension-statuses", "context", "codex-weekly", "response-time"]);
  assert.equal(config.lines[0].left[1].enabled, false);
  assert.equal(config.lines[1].center[0].enabled, false);
});

test("a third tier and file-based widget require only configuration", () => {
  const config = parseConfig({ lines: [{}, {}, { center: [{ widget: "custom-widget", settings: { label: "mine" } }] }] });
  assert.equal(config.lines.length, 3);
  assert.deepEqual(config.lines[2].center[0].settings, { label: "mine" });
});

test("invalid configuration is rejected rather than silently ignored", () => {
  for (const value of [
    { lines: [] }, { lines: Array(11).fill({}) }, { tiers: [{}] },
    { lines: [{ middle: [] }] }, { lines: [{ left: "model" }] },
    { lines: [{ left: [{ widget: "../secret" }] }] },
    { lines: [{ left: [{ widget: "model", priority: NaN }] }] },
    { lines: [{ left: [{ widget: "model", settings: [] }] }] },
    { lines: [{}], separator: "\n" },
  ]) assert.throws(() => parseConfig(value));
});

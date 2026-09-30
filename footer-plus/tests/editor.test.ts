import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseConfig } from "../src/lib/config.ts";
import { locate, moveWidget, withDiscoveredWidgets } from "../src/lib/editor.ts";
import { effectiveConfig, saveOverrides } from "../src/lib/overrides.ts";

const base = () => parseConfig({ lines: [{ left: [{ widget: "model" }, { widget: "provider", enabled: false }] }] });

test("discovered disabled widgets remain editable without changing the original config", () => {
  const config = base();
  const draft = withDiscoveredWidgets(config, ["model", "custom"]);
  assert.equal(draft.lines[0].left.length, 3);
  assert.equal(draft.lines[0].left[2].enabled, false);
  assert.equal(config.lines[0].left.length, 2);
});

test("row, group, and position move actual footer output order", () => {
  const config = base();
  const model = config.lines[0].left[0];
  moveWidget(config, model, 3, "right", 0);
  assert.deepEqual(locate(config, model), { row: 3, side: "right", index: 0 });
  assert.equal(config.lines[0].left[0].widget, "provider");
  moveWidget(config, model, 0, "left", 1);
  assert.deepEqual(config.lines[0].left.map((spec) => spec.widget), ["provider", "model"]);
  moveWidget(config, model, 0, "left", 0);
  assert.deepEqual(config.lines[0].left.map((spec) => spec.widget), ["model", "provider"]);
  assert.throws(() => moveWidget(config, model, 10, "left", 0), /Invalid/);
});

test("panel overrides survive reload and reset never modifies managed defaults", async (t) => {
  const directory = await mkdtemp(fileURLToPath(new URL("../.test-overrides-", import.meta.url)));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const defaults = join(directory, "base.json");
  const overrides = join(directory, "overrides.json");
  await writeFile(defaults, JSON.stringify(base()));
  const before = await readFile(defaults, "utf8");
  assert.deepEqual(await effectiveConfig(defaults, overrides), base());
  const edited = base();
  edited.lines[0].left[0].enabled = false;
  await saveOverrides(overrides, edited);
  assert.deepEqual(await effectiveConfig(defaults, overrides), edited);
  await saveOverrides(overrides, "reset");
  assert.deepEqual(await effectiveConfig(defaults, overrides), base());
  assert.equal(await readFile(defaults, "utf8"), before);
  await writeFile(overrides, "broken");
  await assert.rejects(effectiveConfig(defaults, overrides), SyntaxError);
});

test("enabled flags reject malformed values", () => {
  assert.throws(() => parseConfig({ lines: [{ left: [{ widget: "model", enabled: "false" }] }] }), /enabled/);
});

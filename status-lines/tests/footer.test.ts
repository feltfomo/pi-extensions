import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { parseConfig, loadConfig } from "../src/lib/config.ts";
import { createFooter } from "../src/lib/footer.ts";
import { discoverWidgets } from "../src/lib/loader.ts";
import type { WidgetFactory } from "../src/lib/widget.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
function context(model = "gpt-test", color = ""): ExtensionContext {
  return {
    cwd: root, mode: "tui", model: { id: model, provider: "openai-codex" }, thinkingLevel: "medium",
    ui: { theme: { fg: (_name: string, text: string) => `${color}${text}` } as Theme, notify() {} },
  } as unknown as ExtensionContext;
}
const data = {
  getGitBranch: () => null, getExtensionStatuses: () => new Map([["another-extension", "ready"]]),
  onBranchChange: () => () => {}, getAvailableProviderCount: () => 1,
};

test("default footer renders two lines, follows model and theme changes, and releases its lifecycle", async () => {
  const factories = await discoverWidgets([join(root, "src/widgets")]);
  const config = await loadConfig(join(root, "status-lines.json"));
  const footer = createFooter(config, factories, context(), data, () => {});
  try {
    const lines = footer.render(160);
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes(basename(root)));
    assert.ok(lines[0].includes("no git"));
    assert.ok(lines[1].includes("openai-codex | gpt-test | thinking medium"));
    assert.ok(lines[1].includes("ready"));
    assert.ok(lines[1].includes("weekly loading"));
    footer.updateContext(context("gpt-other", "colored:"));
    assert.ok(footer.render(160)[1].includes("colored:gpt-other"));
  } finally { footer.dispose(); }
  footer.dispose();
  assert.deepEqual(footer.render(160), []);
});

test("widget failure does not prevent the rest of the row rendering", () => {
  const factories = new Map<string, WidgetFactory>([
    ["broken", () => ({ render() { throw new Error("failed"); } })],
    ["healthy", () => ({ render: () => "healthy" })],
  ]);
  const config = parseConfig({ lines: [{ left: [{ widget: "broken" }, { widget: "healthy" }] }] });
  const footer = createFooter(config, factories, context(), data, () => {});
  assert.match(footer.render(80)[0], /broken unavailable \| healthy/);
  footer.dispose();
});

test("a custom TypeScript widget file loads without editing a registry", async (t) => {
  const directory = await mkdtemp(join(root, ".test-widgets-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "custom.ts"), "export default function (_env: unknown, settings: {label: string}) { return {render: () => settings.label}; }\n");
  const factories = await discoverWidgets([join(root, "src/widgets"), directory]);
  const config = parseConfig({ lines: [{ center: [{ widget: "custom", settings: { label: "plugged in" } }] }] });
  const footer = createFooter(config, factories, context(), data, () => {});
  assert.equal(footer.render(20)[0], "     plugged in");
  footer.dispose();
});

test("constructor failure releases previously created widgets", () => {
  let released = false;
  const factories = new Map<string, WidgetFactory>([
    ["first", () => ({ render: () => "first", dispose() { released = true; } })],
    ["invalid", () => { throw new Error("settings invalid"); }],
  ]);
  const config = parseConfig({ lines: [{ left: [{ widget: "first" }, { widget: "invalid" }] }] });
  assert.throws(() => createFooter(config, factories, context(), data, () => {}), /settings invalid/);
  assert.equal(released, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import extension from "../src/session-manager.ts";

function harness() {
  let command!: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  let shortcut!: (ctx: ExtensionContext) => void;
  let message: unknown;
  extension({
    registerCommand(_name: string, options: { handler: typeof command }) { command = options.handler; },
    registerShortcut(_key: string, options: { handler: typeof shortcut }) { shortcut = options.handler; },
    sendUserMessage(content: string, options: unknown) { message = { content, options }; },
  } as unknown as ExtensionAPI);
  return { command, shortcut, message: () => message };
}

test("session panel completion resumes or creates sessions; cancel leaves session unchanged", async () => {
  const { command } = harness();
  let selected: { kind: string; path?: string } | undefined;
  let active = "original";
  const ctx = {
    mode: "tui", cwd: "/project", waitForIdle: async () => {},
    sessionManager: { getSessionFile: () => "original", getSessionDir: () => "/sessions" },
    ui: { custom: async () => selected, notify() {} },
    switchSession: async (path: string) => { active = path; }, newSession: async () => { active = "new"; },
  } as unknown as ExtensionCommandContext;
  await command("", ctx);
  assert.equal(active, "original");
  selected = { kind: "resume", path: "selected" };
  await command("", ctx);
  assert.equal(active, "selected");
  selected = { kind: "new" };
  await command("", ctx);
  assert.equal(active, "new");
});

test("shortcut dispatches the registered command instead of sending a model prompt", () => {
  const h = harness();
  h.shortcut({ mode: "tui" } as ExtensionContext);
  assert.deepEqual(h.message(), { content: "/sessions", options: { expandPromptTemplates: true } });
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { WidgetEnvironment } from "../src/lib/widget.ts";
import contextWidget from "../src/widgets/context.ts";
import sessionWidget from "../src/widgets/session.ts";
import timeWidget from "../src/widgets/response-time.ts";
import statusesWidget from "../src/widgets/extension-statuses.ts";
import { countDiff } from "../src/widgets/diff.ts";
import { createPanel } from "../src/lib/panel.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

const theme = { fg: (_name: string, text: string) => text } as Theme;
function environment(): WidgetEnvironment {
  return {
    context: () => ({ getContextUsage: () => ({ percent: 25.3 }), sessionManager: {
      getSessionId: () => "12345678-abcd", getSessionName: () => "test session",
    } }) as unknown as ExtensionContext,
    project: () => ({ kind: "directory", root: "/project" }),
    footer: { getExtensionStatuses: () => new Map([["mcp", "🔌 MCP: ready \uf0c1"]]), getGitBranch: () => null, onBranchChange: () => () => {}, getAvailableProviderCount: () => 1 },
    signal: new AbortController().signal, requestRender() {}, responseTime: () => ({ elapsedMs: 1234 }),
  };
}

test("context, session labels, response duration, and emoji-free extension statuses", () => {
  const env = environment();
  assert.equal(contextWidget(env, {}).render(theme), "ctx 25.3%");
  env.context = () => ({ getContextUsage: () => undefined }) as unknown as ExtensionContext;
  assert.equal(contextWidget(env, {}).render(theme), "ctx unknown");
  assert.equal(sessionWidget(environment(), {}).render(theme), "test session");
  assert.equal(sessionWidget(environment(), { showId: true }).render(theme), "test session (12345678)");
  assert.equal(statusesWidget(environment(), {}).render(theme), "MCP: ready \uf0c1");
  const time = timeWidget(environment(), {});
  try { assert.equal(time.render(theme), "last 1.2s"); } finally { time.dispose?.(); }
});

test("diff counts skip binary files and malformed records", () => {
  assert.deepEqual(countDiff("12\t3\ta.ts\n-\t-\tbinary\n2\t7\tb.ts\n"), { added: 14, removed: 10 });
});

test("panel frames remain bounded with wide text and forward focus", () => {
  const content = { focused: false, render: () => ["漢字".repeat(50)], invalidate() {} };
  const panel = createPanel("long title".repeat(10), content, theme);
  for (const width of [1, 2, 5, 20, 80]) for (const line of panel.render(width)) assert.ok(visibleWidth(line) <= width);
  panel.focused = true;
  assert.equal(content.focused, true);
});

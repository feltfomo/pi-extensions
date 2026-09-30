import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import createWidget, { accountIdFromToken, parseWeeklyQuota } from "../src/widgets/codex-weekly.ts";
import type { WidgetEnvironment } from "../src/lib/widget.ts";

const week = (used: number, seconds = 604800) => ({ used_percent: used, limit_window_seconds: seconds, reset_at: 4_000_000_000 });
const theme = { fg: (_color: string, text: string) => text } as Theme;
const token = `header.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "account_test" } })).toString("base64url")}.signature`;

function environment(provider = "openai-codex", apiKey: string | undefined = token): WidgetEnvironment {
  return {
    context: () => ({ model: { provider }, modelRegistry: { getApiKeyAndHeaders: async () => ({ ok: true, apiKey }) } }) as unknown as ExtensionContext,
    project: () => ({ kind: "directory", root: "/project" }),
    footer: { getGitBranch: () => null, getExtensionStatuses: () => new Map(), onBranchChange: () => () => {}, getAvailableProviderCount: () => 1 },
    signal: new AbortController().signal,
    requestRender() {},
  };
}

test("weekly percentage uses the weekly duration rather than assuming the secondary window", () => {
  assert.equal(parseWeeklyQuota({ rate_limit: { primary_window: week(17), secondary_window: week(70, 18000) } }).remaining, 83);
  assert.equal(parseWeeklyQuota({ rate_limit: { primary_window: week(90, 18000), secondary_window: week(35) } }).remaining, 65);
  assert.equal(parseWeeklyQuota({ rate_limit: { secondary_window: week(100) } }).remaining, 0);
});

test("malformed, absent, and non-weekly quotas never become an estimated percentage", () => {
  for (const payload of [null, {}, { rate_limit: {} }, { rate_limit: { secondary_window: week(10, 18000) } },
    { rate_limit: { secondary_window: week(-1) } }, { rate_limit: { secondary_window: week(101) } },
    { rate_limit: { secondary_window: week(NaN) } }]) {
    assert.throws(() => parseWeeklyQuota(payload));
  }
});

test("account selection comes from the Codex claim, invalid tokens have no account", () => {
  assert.equal(accountIdFromToken(token), "account_test");
  assert.equal(accountIdFromToken("secret"), undefined);
});

test("widget displays actual remaining quota, enforces request spacing, and marks failed refresh stale", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 2_000_000_000_000;
  Date.now = () => now;
  t.after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; });
  const widget = createWidget(environment(), {});
  t.after(() => widget.dispose?.());
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://chatgpt.com/backend-api/wham/usage");
    assert.equal((options?.headers as Record<string, string>)["ChatGPT-Account-Id"], "account_test");
    assert.equal(options?.redirect, "error");
    return Response.json({ rate_limit: { secondary_window: week(27) } });
  };
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly 73% left");
  globalThis.fetch = async () => { throw new Error(`Failure containing ${token}`); };
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly 73% left");
  now += 60_001;
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly 73% left (stale)");
  assert.ok(!widget.render(theme).includes(token));
});

test("reset display is opt-in and uses the weekly window's local reset date", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const reset = new Date(2033, 4, 18, 14, 5);
  let now = reset.getTime() - 60_000;
  Date.now = () => now;
  t.after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; });
  globalThis.fetch = async () => Response.json({ rate_limit: {
    primary_window: { ...week(90, 18000), reset_at: reset.getTime() / 1000 + 3600 },
    secondary_window: { ...week(27), reset_at: reset.getTime() / 1000 },
  } });
  const enabled = createWidget(environment(), { showReset: true });
  const disabled = createWidget(environment(), { showReset: false });
  t.after(() => { enabled.dispose?.(); disabled.dispose?.(); });
  await enabled.refresh?.();
  await disabled.refresh?.();
  assert.equal(enabled.render(theme), "weekly 73% left (resets 2033-05-18 14:05)");
  assert.equal(disabled.render(theme), "weekly 73% left");
  now = reset.getTime();
  assert.equal(enabled.render(theme), "weekly 73% left (resets 2033-05-18 14:05) (stale)");
});

test("reset display preserves unavailable states and validates settings", async (t) => {
  for (const showReset of ["true", 1, null]) {
    assert.throws(() => createWidget(environment(), { showReset }), /showReset/);
  }
  assert.throws(() => createWidget(environment(), { unknown: true }), /Unknown/);
  const widget = createWidget(environment("openai-codex", ""), { showReset: true });
  t.after(() => widget.dispose?.());
  assert.equal(widget.render(theme), "weekly loading");
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly login required");
});

test("missing authentication and other providers display explicit unavailable states", async (t) => {
  const missingWidget = createWidget(environment("openai-codex", ""), {});
  const other = createWidget(environment("anthropic"), {});
  t.after(() => { missingWidget.dispose?.(); other.dispose?.(); });
  await missingWidget.refresh?.();
  await other.refresh?.();
  assert.equal(missingWidget.render(theme), "weekly login required");
  assert.equal(other.render(theme), "weekly n/a");
});

test("offline mode makes no credential or network request", async (t) => {
  const previous = process.env.PI_OFFLINE;
  process.env.PI_OFFLINE = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.PI_OFFLINE;
    else process.env.PI_OFFLINE = previous;
  });
  const offline = environment();
  offline.context = () => ({ model: { provider: "openai-codex" }, modelRegistry: {
    getApiKeyAndHeaders: async () => { assert.fail("offline credential lookup"); },
  } }) as unknown as ExtensionContext;
  const widget = createWidget(offline, {});
  t.after(() => widget.dispose?.());
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly offline");
});

test("HTTP failure without a cached value is unavailable", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response("private response body", { status: 403 });
  const widget = createWidget(environment(), {});
  t.after(() => widget.dispose?.());
  await widget.refresh?.();
  assert.equal(widget.render(theme), "weekly unavailable");
});

import type { WidgetFactory } from "../lib/widget.ts";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export interface WeeklyQuota { remaining: number; resetAt: number }

export function parseWeeklyQuota(payload: unknown): WeeklyQuota {
  const rate = (payload as { rate_limit?: Record<string, unknown> } | null)?.rate_limit;
  if (!rate || typeof rate !== "object") throw new Error("Weekly quota missing");
  for (const value of [rate.primary_window, rate.secondary_window]) {
    if (!value || typeof value !== "object") continue;
    const window = value as Record<string, unknown>;
    if (window.limit_window_seconds !== WEEK_SECONDS) continue;
    const used = window.used_percent;
    const resetAt = window.reset_at;
    if (typeof used !== "number" || !Number.isFinite(used) || used < 0 || used > 100 ||
      typeof resetAt !== "number" || !Number.isSafeInteger(resetAt) || resetAt <= 0) {
      throw new Error("Invalid weekly quota");
    }
    return { remaining: 100 - used, resetAt };
  }
  throw new Error("Weekly quota missing");
}

export function accountIdFromToken(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const id = payload["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

type State =
  | { kind: "loading" | "unavailable" | "login required" | "n/a" | "offline" }
  | { kind: "quota"; quota: WeeklyQuota; stale: boolean };

const createWidget: WidgetFactory = (environment, settings) => {
  const pollSeconds = settings.pollSeconds ?? 300;
  if (typeof pollSeconds !== "number" || !Number.isFinite(pollSeconds) || pollSeconds < 60 || pollSeconds > 3600 ||
    Object.keys(settings).some((key) => key !== "pollSeconds")) {
    throw new Error("codex-weekly settings: pollSeconds must be between 60 and 3600");
  }
  let state: State = { kind: "loading" };
  let pending = false;
  let lastAttempt = 0;
  let lastAccount: string | undefined;
  const stop = new AbortController();
  const signal = AbortSignal.any([environment.signal, stop.signal]);
  const isCodex = () => environment.context().model?.provider === "openai-codex";
  const refresh = async () => {
    if (signal.aborted) return;
    if (!isCodex()) {
      state = { kind: "n/a" };
      lastAccount = undefined;
      lastAttempt = 0;
      environment.requestRender();
      return;
    }
    if (process.env.PI_OFFLINE !== undefined) {
      state = { kind: "offline" };
      environment.requestRender();
      return;
    }
    if (pending || Date.now() - lastAttempt < 60_000) return;
    lastAttempt = Date.now();
    pending = true;
    try {
      const model = environment.context().model!;
      const auth = await environment.context().modelRegistry.getApiKeyAndHeaders(model);
      if (signal.aborted) return;
      if (!auth.ok || !auth.apiKey) {
        state = { kind: "login required" };
        lastAccount = undefined;
        return;
      }
      const account = accountIdFromToken(auth.apiKey);
      if (!account) {
        state = { kind: "login required" };
        lastAccount = undefined;
        return;
      }
      if (account !== lastAccount) state = { kind: "loading" };
      lastAccount = account;
      const response = await fetch(USAGE_URL, {
        headers: { Authorization: `Bearer ${auth.apiKey}`, "ChatGPT-Account-Id": account, "User-Agent": "pi-status-lines" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`Quota HTTP ${response.status}`);
      const quota = parseWeeklyQuota(await response.json());
      state = { kind: "quota", quota, stale: false };
    } catch {
      // Never put credential resolution errors or account response bodies into the footer or logs.
      state = state.kind === "quota" ? { ...state, stale: true } : { kind: "unavailable" };
    } finally {
      pending = false;
      if (!signal.aborted) {
        if (!isCodex()) state = { kind: "n/a" };
        environment.requestRender();
      }
    }
  };
  const timer = setInterval(() => { void refresh(); }, pollSeconds * 1000);
  timer.unref();
  return {
    refresh,
    render(theme) {
      if (!isCodex()) return theme.fg("dim", "weekly n/a");
      if (state.kind !== "quota") return theme.fg("dim", `weekly ${state.kind}`);
      const stale = state.stale || Date.now() >= state.quota.resetAt * 1000;
      const remaining = Math.floor(state.quota.remaining * 10) / 10;
      return theme.fg(stale || remaining <= 20 ? "warning" : "muted", `weekly ${remaining}% left${stale ? " (stale)" : ""}`);
    },
    dispose() { clearInterval(timer); stop.abort(); },
  };
};
export default createWidget;

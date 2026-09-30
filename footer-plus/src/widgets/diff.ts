import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WidgetFactory } from "../lib/widget.ts";

const execute = promisify(execFile);
export function countDiff(text: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of text.split("\n")) {
    const [a, r] = line.split("\t");
    if (/^\d+$/.test(a ?? "") && /^\d+$/.test(r ?? "")) { added += Number(a); removed += Number(r); }
  }
  return { added, removed };
}

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("diff has no settings");
  let counts: ReturnType<typeof countDiff> | undefined;
  let pending: Promise<void> | undefined;
  let again = false;
  const measure = async () => {
    const git = async (...args: string[]) => (await execute("git", ["-C", environment.context().cwd, ...args], {
      signal: environment.signal, timeout: 3000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    })).stdout;
    try { await git("rev-parse", "--git-dir"); }
    catch (error) {
      if ((error as { stderr?: string }).stderr?.includes("not a git repository")) { counts = undefined; return; }
      throw error;
    }
    let hasHead = true;
    try { await git("rev-parse", "--verify", "HEAD"); }
    catch (error) { if ((error as { code?: number }).code !== 128) throw error; hasHead = false; }
    // Git recognizes its empty tree even before the first commit; hash-object handles both object formats.
    const base = hasHead ? "HEAD" : (await git("hash-object", "-t", "tree", "/dev/null")).trim();
    counts = countDiff(await git("diff", "--no-ext-diff", "--numstat", base, "--"));
  };
  const refresh = (): Promise<void> => {
    if (environment.signal.aborted) return Promise.resolve();
    if (pending) { again = true; return pending; }
    pending = (async () => {
      do { again = false; await measure(); } while (again && !environment.signal.aborted);
    })().finally(() => { pending = undefined; });
    return pending;
  };
  return { refresh, render: (theme) => counts ? theme.fg("muted", `+${counts.added} -${counts.removed}`) : "" };
};
export default createWidget;

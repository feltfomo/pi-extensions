import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export type ProjectInfo =
  | { kind: "directory"; root: string }
  | { kind: "repository"; root: string; checkout: "local" | "worktree"; branch: string; detached: boolean };

export async function inspectProject(cwd: string, signal: AbortSignal): Promise<ProjectInfo> {
  const git = async (...args: string[]) => (await execute("git", ["-C", cwd, ...args], {
    signal, timeout: 3000, maxBuffer: 64 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  })).stdout.trim();
  let metadata: string;
  try {
    metadata = await git("rev-parse", "--path-format=absolute", "--show-toplevel", "--absolute-git-dir", "--git-common-dir");
  } catch (error) {
    signal.throwIfAborted();
    const failure = error as { code?: string | number; stderr?: string };
    if (failure.code === "ENOENT" || failure.stderr?.includes("not a git repository")) {
      return { kind: "directory", root: cwd };
    }
    throw error;
  }
  const [root, gitDir, commonDir] = metadata.split("\n");
  if (!root || !gitDir || !commonDir) throw new Error("Invalid Git checkout metadata");
  let branch: string;
  let detached = false;
  try {
    branch = await git("symbolic-ref", "--quiet", "--short", "HEAD");
  } catch (error) {
    if ((error as { code?: number }).code !== 1) throw error;
    detached = true;
    branch = await git("rev-parse", "--short", "HEAD");
  }
  return { kind: "repository", root, checkout: resolve(gitDir) === resolve(commonDir) ? "local" : "worktree", branch, detached };
}

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { inspectProject } from "../src/lib/project.ts";

const execute = promisify(execFile);

test("project metadata distinguishes plain directories, local checkout, and linked worktree", async (t) => {
  const root = await mkdtemp(fileURLToPath(new URL("../.test-project-", import.meta.url)));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previousCeiling = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = fileURLToPath(new URL("..", import.meta.url));
  t.after(() => {
    if (previousCeiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = previousCeiling;
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await inspectProject(root, signal), { kind: "directory", root });
  const repo = join(root, "repo");
  await mkdir(repo);
  await execute("git", ["init", "-b", "main", repo]);
  await mkdir(join(repo, "nested"));
  assert.deepEqual(await inspectProject(join(repo, "nested"), signal), {
    kind: "repository", root: repo, checkout: "local", branch: "main", detached: false,
  });
  const worktree = join(root, "linked");
  await execute("git", ["-C", repo, "worktree", "add", "--orphan", "-b", "linked", worktree]);
  assert.deepEqual(await inspectProject(worktree, signal), {
    kind: "repository", root: worktree, checkout: "worktree", branch: "linked", detached: false,
  });
});

test("aborted project inspection is not reported as a non-repository", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(inspectProject(fileURLToPath(new URL("..", import.meta.url)), controller.signal));
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { WidgetEnvironment } from "../src/lib/widget.ts";
import diffWidget from "../src/widgets/diff.ts";

const execute = promisify(execFile);
const theme = { fg: (_color: string, text: string) => text } as Theme;

test("an unborn checkout counts the net staged and unstaged changes and excludes untracked files", async (t) => {
  const root = await mkdtemp(fileURLToPath(new URL("../.test-diff-", import.meta.url)));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execute("git", ["-C", root, ...args]);
  await git("init", "-b", "main");
  const env = {
    context: () => ({ cwd: root }) as ExtensionContext,
    signal: new AbortController().signal, requestRender() {},
  } as unknown as WidgetEnvironment;
  const widget = diffWidget(env, {});
  await writeFile(join(root, "file.txt"), "one\ntwo\n");
  await git("add", "file.txt");
  await widget.refresh?.();
  assert.equal(widget.render(theme), "+2 -0");
  await writeFile(join(root, "file.txt"), "one\nchanged\nnew\nmore\n");
  await writeFile(join(root, "untracked.txt"), "ignored\n");
  await widget.refresh?.();
  assert.equal(widget.render(theme), "+4 -0");
  const pending = widget.refresh?.();
  await writeFile(join(root, "file.txt"), "one\nchanged\nnew\nmore\nlatest\n");
  await widget.refresh?.();
  await pending;
  assert.equal(widget.render(theme), "+5 -0");
});

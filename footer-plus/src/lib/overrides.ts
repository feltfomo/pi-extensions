import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.ts";
import type { Config } from "./widget.ts";

export async function effectiveConfig(base: string, overrides: string): Promise<Config> {
  const defaults = await loadConfig(base);
  try { return await loadConfig(overrides); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults; throw error; }
}
export async function saveOverrides(path: string, config: Config | "reset") {
  if (config === "reset") { await rm(path, { force: true }); return; }
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temp, path);
  } finally { await rm(temp, { force: true }); }
}

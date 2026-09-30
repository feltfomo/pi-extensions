import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createJiti } from "jiti";
import type { WidgetFactory } from "./widget.ts";

export async function discoverWidgets(directories: string[]): Promise<Map<string, WidgetFactory>> {
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const widgets = new Map<string, WidgetFactory>();
  for (const directory of directories) {
    let files: string[];
    try {
      files = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const file of files.sort()) {
      const match = /^([a-z][a-z0-9-]*)\.(?:ts|js)$/.exec(file);
      if (!match || file.endsWith(".d.ts")) continue;
      const name = match[1];
      if (widgets.has(name)) throw new Error(`Duplicate widget: ${name}`);
      const factory = await jiti.import<WidgetFactory>(join(directory, file), { default: true });
      if (typeof factory !== "function") throw new Error(`Widget ${name} must default-export a factory`);
      widgets.set(name, factory);
    }
  }
  return widgets;
}

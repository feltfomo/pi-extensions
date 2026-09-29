import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./lib/config.ts";
import { discoverWidgets } from "./lib/loader.ts";
import { createFooter } from "./lib/footer.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default function statusLines(pi: ExtensionAPI, defaultConfig = join(packageRoot, "status-lines.json")) {
  let active: ReturnType<typeof createFooter> | undefined;
  let enabled = true;
  let revision = 0;
  pi.registerFlag("status-lines-config", {
    type: "string",
    description: "Path to Status Lines JSON configuration",
    default: defaultConfig,
  });
  const install = async (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui" || !enabled) return;
    const candidate = ++revision;
    let replacing = false;
    try {
      const path = resolve(ctx.cwd, String(pi.getFlag("status-lines-config")));
      const config = await loadConfig(path);
      const factories = await discoverWidgets([join(packageRoot, "src/widgets"), join(packageRoot, "widgets")]);
      for (const line of config.lines) {
        for (const spec of [...line.left, ...line.center, ...line.right]) {
          if (!factories.has(spec.widget)) throw new Error(`Unknown widget: ${spec.widget}`);
        }
      }
      if (candidate !== revision || !enabled) return;
      replacing = true;
      ctx.ui.setFooter((tui, _theme, footer) => {
        active = createFooter(config, factories, ctx, footer, () => tui.requestRender());
        return active;
      });
      active?.refresh();
    } catch (error) {
      if (candidate !== revision) return;
      if (replacing) {
        active?.dispose();
        active = undefined;
        ctx.ui.setFooter(undefined);
      }
      ctx.ui.notify(`Status Lines: ${error instanceof Error ? error.message : "Could not load configuration"}`, "error");
    }
  };
  pi.on("session_start", async (_event, ctx) => { await install(ctx); });
  pi.on("session_shutdown", () => { ++revision; active?.dispose(); active = undefined; });
  const refresh = (_event: unknown, ctx: ExtensionContext) => {
    active?.updateContext(ctx);
    active?.refresh();
  };
  pi.on("model_select", refresh);
  pi.on("thinking_level_select", refresh);
  pi.on("agent_end", refresh);
  pi.on("session_tree", refresh);
  pi.registerCommand("status-lines", {
    description: "Status Lines: reload, on, or off",
    handler: async (args, ctx) => {
      const action = args.trim() || "reload";
      if (action === "off") {
        enabled = false;
        ++revision;
        active?.dispose();
        active = undefined;
        if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
      } else if (action === "on" || action === "reload") {
        enabled = true;
        await install(ctx);
      } else {
        ctx.ui.notify("Usage: /status-lines [reload|on|off]", "info");
      }
    },
  });
}

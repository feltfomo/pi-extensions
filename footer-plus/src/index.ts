import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import { discoverWidgets } from "./lib/loader.ts";
import { createFooter } from "./lib/footer.ts";
import { editFooter } from "./lib/editor.ts";
import { effectiveConfig, saveOverrides } from "./lib/overrides.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default function footerPlus(pi: ExtensionAPI, defaultConfig = join(packageRoot, "footer.json"), shortcut: KeyId | null = "ctrl+alt+f") {
  let active: ReturnType<typeof createFooter> | undefined;
  let enabled = true;
  let revision = 0;
  let editing = false;
  let startedAt: number | undefined;
  let elapsedMs = 0;
  const time = () => ({ startedAt, elapsedMs });
  pi.registerFlag("footer-config", { type: "string", description: "Path to footer++ JSON configuration", default: defaultConfig });
  pi.registerFlag("footer-overrides", { type: "string", description: "Writable footer++ panel overrides", default: join(getAgentDir(), "footer-overrides.json") });
  const paths = (ctx: ExtensionContext) => ({
    base: resolve(ctx.cwd, String(pi.getFlag("footer-config"))),
    overrides: resolve(ctx.cwd, String(pi.getFlag("footer-overrides"))),
  });
  const widgets = () => discoverWidgets([join(packageRoot, "src/widgets"), join(packageRoot, "widgets"), join(getAgentDir(), "footer-widgets")]);
  const install = async (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui" || !enabled) return;
    const candidate = ++revision;
    let replacing = false;
    try {
      const { base, overrides } = paths(ctx);
      const config = await effectiveConfig(base, overrides);
      const factories = await widgets();
      for (const line of config.lines) for (const spec of [...line.left, ...line.center, ...line.right]) {
        if (spec.enabled && !factories.has(spec.widget)) throw new Error(`Unknown widget: ${spec.widget}`);
      }
      if (candidate !== revision || !enabled) return;
      replacing = true;
      ctx.ui.setFooter((tui, _theme, footer) => {
        active = createFooter(config, factories, ctx, footer, () => tui.requestRender(), time);
        return active;
      });
      active?.refresh();
    } catch (error) {
      if (candidate !== revision) return;
      if (replacing) { active?.dispose(); active = undefined; ctx.ui.setFooter(undefined); }
      ctx.ui.notify(`footer++: ${error instanceof Error ? error.message : "Could not load configuration"}`, "error");
    }
  };
  const refresh = (_event: unknown, ctx: ExtensionContext) => { active?.updateContext(ctx); active?.refresh(); };
  pi.on("session_start", async (_event, ctx) => { startedAt = undefined; elapsedMs = 0; await install(ctx); });
  pi.on("session_shutdown", () => { ++revision; active?.dispose(); active = undefined; });
  pi.on("model_select", refresh);
  pi.on("thinking_level_select", refresh);
  pi.on("message_end", refresh);
  pi.on("tool_execution_end", refresh);
  pi.on("session_tree", refresh);
  pi.on("session_info_changed", refresh);
  pi.on("agent_start", (_event, ctx) => { if (startedAt === undefined) startedAt = performance.now(); refresh(_event, ctx); });
  pi.on("agent_settled", (_event, ctx) => {
    if (startedAt !== undefined) elapsedMs = performance.now() - startedAt;
    startedAt = undefined;
    refresh(_event, ctx);
  });
  const panel = async (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui") { ctx.ui.notify("footer++ panel requires TUI mode", "error"); return; }
    if (editing) return;
    editing = true;
    try {
      const { base, overrides } = paths(ctx);
      const result = await editFooter(ctx, await effectiveConfig(base, overrides), (await widgets()).keys());
      if (result !== undefined) { await saveOverrides(overrides, result); enabled = true; await install(ctx); }
    } catch (error) { ctx.ui.notify(`footer++: ${error instanceof Error ? error.message : String(error)}`, "error"); }
    finally { editing = false; }
  };
  if (shortcut) pi.registerShortcut(shortcut, { description: "Configure footer++ widgets", handler: panel });
  pi.registerCommand("footer", {
    description: "Configure footer++ widgets, or reload/on/off/reset",
    handler: async (args, ctx) => {
      const action = args.trim();
      if (!action) return panel(ctx);
      if (action === "off") {
        enabled = false; ++revision; active?.dispose(); active = undefined;
        if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
      } else if (action === "on" || action === "reload") { enabled = true; await install(ctx); }
      else if (action === "reset") {
        try { await saveOverrides(paths(ctx).overrides, "reset"); enabled = true; await install(ctx); }
        catch (error) { ctx.ui.notify(`footer++: ${String(error)}`, "error"); }
      } else ctx.ui.notify("Usage: /footer [reload|on|off|reset]", "info");
    },
  });
}

import { getSettingsListTheme, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SettingsList, type SettingItem } from "@earendil-works/pi-tui";
import { createPanel, panelOverlay } from "./panel.ts";
import type { Config, WidgetSpec } from "./widget.ts";

export const sides = ["left", "center", "right"] as const;
export type Side = typeof sides[number];
export function locate(config: Config, spec: WidgetSpec) {
  for (const [row, line] of config.lines.entries()) for (const side of sides) {
    const index = line[side].indexOf(spec);
    if (index >= 0) return { row, side, index };
  }
  throw new Error("Widget is not in this layout");
}
export function moveWidget(config: Config, spec: WidgetSpec, row: number, side: Side, index: number) {
  if (!Number.isInteger(row) || row < 0 || row > 9 || !sides.includes(side) || !Number.isInteger(index) || index < 0) throw new Error("Invalid widget position");
  const previous = locate(config, spec);
  config.lines[previous.row][previous.side].splice(previous.index, 1);
  while (config.lines.length <= row) config.lines.push({ left: [], center: [], right: [] });
  const group = config.lines[row][side];
  group.splice(Math.min(index, group.length), 0, spec);
}
export function withDiscoveredWidgets(config: Config, names: Iterable<string>): Config {
  const draft = structuredClone(config);
  const known = new Set(draft.lines.flatMap((line) => sides.flatMap((side) => line[side].map((spec) => spec.widget))));
  for (const widget of names) if (!known.has(widget)) {
    draft.lines[0].left.push({ widget, enabled: false, priority: 50, settings: {} });
    known.add(widget);
  }
  return draft;
}

export async function editFooter(ctx: ExtensionContext, config: Config, names: Iterable<string>): Promise<Config | "reset" | undefined> {
  const draft = withDiscoveredWidgets(config, names);
  return ctx.ui.custom<Config | "reset" | undefined>((tui, theme, _keys, done) => {
    const summary = (spec: WidgetSpec) => {
      const p = locate(draft, spec);
      return `${spec.enabled ? "on" : "off"}, row ${p.row}, ${p.side} ${p.index}`;
    };
    const items: SettingItem[] = draft.lines.flatMap((line) => sides.flatMap((side) => line[side])).map((spec, i) => ({
      id: `widget-${i}`, label: spec.widget, currentValue: summary(spec),
      description: "Enter: edit enabled state and placement. Escape: return. Positions start at 0.",
      submenu: (_value, close) => {
        let p = locate(draft, spec);
        const submenu = new SettingsList([
          { id: "enabled", label: "Enabled", currentValue: String(spec.enabled), values: ["true", "false"] },
          { id: "row", label: "Row", currentValue: String(p.row), values: Array.from({ length: 10 }, (_, i) => String(i)) },
          { id: "side", label: "Group", currentValue: p.side, values: [...sides] },
          { id: "index", label: "Position", currentValue: String(p.index), values: Array.from({ length: Math.max(1, draft.lines[p.row][p.side].length) }, (_, i) => String(i)) },
        ], 6, getSettingsListTheme(), (id, value) => {
          p = locate(draft, spec);
          if (id === "enabled") spec.enabled = value === "true";
          else moveWidget(draft, spec, id === "row" ? Number(value) : p.row, id === "side" ? value as Side : p.side, id === "index" ? Number(value) : p.index);
          // Rebuild placement choices after moving between differently sized groups.
          close(summary(spec));
          tui.requestRender();
        }, () => close(summary(spec)));
        return submenu;
      },
    }));
    items.push(
      { id: "save", label: "Save", currentValue: "apply and persist", values: ["apply and persist"] },
      { id: "reset", label: "Reset to Nix/file defaults", currentValue: "remove overrides", values: ["remove overrides"] },
    );
    const list = new SettingsList(items, 12, getSettingsListTheme(), (id) => {
      if (id === "save") done(draft);
      if (id === "reset") done("reset");
      tui.requestRender();
    }, () => done(undefined), { enableSearch: true });
    return createPanel("footer++ | Enter edit | Save applies | Escape cancels", list, theme);
  }, panelOverlay);
}

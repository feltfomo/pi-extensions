import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component, type Focusable } from "@earendil-works/pi-tui";

/** Wrap one interaction's content. The caller owns completion and overlay disposal. */
export function createPanel(title: string, content: Component, theme: Theme): Component & Focusable {
  const focusable = content as Component & Partial<Focusable>;
  return {
    get focused() { return focusable.focused ?? false; },
    set focused(value: boolean) { focusable.focused = value; },
    invalidate() { content.invalidate(); },
    handleInput(data) { content.handleInput?.(data); },
    handleMouse(event) { return content.handleMouse?.(event); },
    render(width) {
      const inner = Math.max(0, width - 4);
      const row = (text: string) => {
        const cropped = truncateToWidth(text, inner, "");
        return truncateToWidth(`${theme.fg("border", "| ")}${cropped}${" ".repeat(Math.max(0, inner - visibleWidth(cropped)))}${theme.fg("border", " |")}`, width, "");
      };
      const border = theme.fg("border", `+${"-".repeat(Math.max(0, width - 2))}+`);
      return [truncateToWidth(border, width, ""), row(theme.fg("accent", title)), ...content.render(inner).map(row), truncateToWidth(border, width, "")];
    },
  };
}

export const panelOverlay = { overlay: true, overlayOptions: { width: "90%" as const, maxHeight: "85%" as const, anchor: "center" as const } };

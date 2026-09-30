import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("context has no settings");
  return {
    render(theme) {
      const percent = environment.context().getContextUsage()?.percent;
      return theme.fg(percent != null && percent >= 80 ? "warning" : "muted", percent == null ? "ctx unknown" : `ctx ${percent.toFixed(1)}%`);
    },
  };
};
export default createWidget;

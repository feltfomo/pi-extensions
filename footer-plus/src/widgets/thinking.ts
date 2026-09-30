import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("thinking has no settings");
  return { render: (theme) => theme.fg("muted", `thinking ${environment.context().thinkingLevel ?? "off"}`) };
};
export default createWidget;

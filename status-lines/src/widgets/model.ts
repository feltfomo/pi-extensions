import { plainLabel } from "../lib/widget.ts";
import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("model has no settings");
  return { render: (theme) => theme.fg("accent", plainLabel(environment.context().model?.id ?? "no model")) };
};
export default createWidget;

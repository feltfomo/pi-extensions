import { plainLabel } from "../lib/widget.ts";
import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("provider has no settings");
  return { render: (theme) => theme.fg("dim", plainLabel(environment.context().model?.provider ?? "no provider")) };
};
export default createWidget;

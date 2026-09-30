import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("extension-statuses has no settings");
  return {
    render: () => [...environment.footer.getExtensionStatuses().values()].map((text) => text.replace(/[\r\n]/g, " ").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu, "").trim()).join(" | "),
  };
};
export default createWidget;

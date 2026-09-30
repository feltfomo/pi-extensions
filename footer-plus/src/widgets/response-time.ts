import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  if (Object.keys(settings).length) throw new Error("response-time has no settings");
  const timer = setInterval(environment.requestRender, 1000);
  timer.unref();
  return {
    render(theme) {
      const { startedAt, elapsedMs } = environment.responseTime();
      const seconds = (startedAt === undefined ? elapsedMs : performance.now() - startedAt) / 1000;
      return theme.fg("muted", `${startedAt === undefined ? "last" : "running"} ${seconds.toFixed(1)}s`);
    },
    dispose() { clearInterval(timer); },
  };
};
export default createWidget;

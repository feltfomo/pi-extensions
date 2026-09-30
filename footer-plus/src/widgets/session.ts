import { plainLabel, type WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  const showId = settings.showId ?? false;
  if (typeof showId !== "boolean" || Object.keys(settings).some((key) => key !== "showId")) throw new Error("session settings: showId must be a boolean");
  return {
    render(theme) {
      const manager = environment.context().sessionManager;
      const id = manager.getSessionId().slice(0, 8);
      const name = manager.getSessionName();
      return theme.fg("muted", plainLabel(name ? `${name}${showId ? ` (${id})` : ""}` : id));
    },
  };
};
export default createWidget;

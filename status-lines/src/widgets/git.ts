import { plainLabel } from "../lib/widget.ts";
import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  const showCheckout = settings.showCheckout ?? true;
  if (typeof showCheckout !== "boolean" || Object.keys(settings).some((key) => key !== "showCheckout")) {
    throw new Error("git settings: showCheckout must be a boolean");
  }
  return {
    render(theme) {
      const project = environment.project();
      if (project.kind === "directory") return theme.fg("dim", "no git");
      const branch = project.detached ? `detached ${project.branch}` : project.branch;
      return theme.fg("muted", `${plainLabel(branch)}${showCheckout ? ` (${project.checkout})` : ""}`);
    },
  };
};
export default createWidget;

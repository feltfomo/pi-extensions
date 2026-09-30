import { homedir } from "node:os";
import { basename, relative, sep } from "node:path";
import { plainLabel } from "../lib/widget.ts";
import type { WidgetFactory } from "../lib/widget.ts";

const createWidget: WidgetFactory = (environment, settings) => {
  const style = settings.style ?? "short";
  if (!["short", "full", "name"].includes(String(style)) || Object.keys(settings).some((key) => key !== "style")) {
    throw new Error("project-root settings: style must be short, full, or name");
  }
  return {
    render(theme) {
      const root = environment.project().root;
      const fromHome = relative(homedir(), root);
      const short = fromHome === "" ? "~" : fromHome !== ".." && !fromHome.startsWith(`..${sep}`) && !fromHome.startsWith(sep) ? `~${sep}${fromHome}` : root;
      const text = style === "full" ? root : style === "name" ? basename(root) || root : short;
      return theme.fg("accent", plainLabel(text));
    },
  };
};
export default createWidget;

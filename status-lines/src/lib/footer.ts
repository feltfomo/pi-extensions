import type { ExtensionContext, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Config, Widget, WidgetEnvironment, WidgetFactory, WidgetSpec } from "./widget.ts";
import { layoutRow } from "./layout.ts";
import { inspectProject } from "./project.ts";
import type { ProjectInfo } from "./project.ts";

type Instance = { spec: WidgetSpec; widget: Widget; failed: boolean };

export function createFooter(
  config: Config,
  factories: Map<string, WidgetFactory>,
  initialContext: ExtensionContext,
  footer: ReadonlyFooterDataProvider,
  requestRender: () => void,
) {
  let context = initialContext;
  let project: ProjectInfo = { kind: "directory", root: context.cwd };
  const controller = new AbortController();
  const instances: Instance[] = [];
  const warned = new Set<string>();
  let projectRefresh: Promise<void> | undefined;
  let projectAgain = false;
  const warn = (name: string) => {
    if (warned.has(name) || controller.signal.aborted) return;
    warned.add(name);
    context.ui.notify(`Status Lines: ${name} failed. Check its configuration or implementation.`, "warning");
  };
  const environment: WidgetEnvironment = {
    context: () => context,
    project: () => project,
    footer,
    signal: controller.signal,
    requestRender: () => { if (!controller.signal.aborted) requestRender(); },
  };
  const dispose = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    unsubscribe();
    for (const instance of instances) {
      try { instance.widget.dispose?.(); } catch { /* One widget must not prevent another from releasing resources. */ }
    }
  };
  let unsubscribe = () => {};
  const construct = (spec: WidgetSpec): Instance => {
    const factory = factories.get(spec.widget);
    if (!factory) throw new Error(`Unknown widget: ${spec.widget}`);
    const widget = factory(environment, spec.settings);
    if (!widget || typeof widget.render !== "function") {
      widget?.dispose?.();
      throw new Error(`Widget ${spec.widget} must provide render()`);
    }
    const instance = { spec, widget, failed: false };
    instances.push(instance);
    return instance;
  };
  let lines: { left: Instance[]; center: Instance[]; right: Instance[] }[];
  try {
    lines = config.lines.map((line) => ({ left: line.left.map(construct), center: line.center.map(construct), right: line.right.map(construct) }));
  } catch (error) {
    dispose();
    throw error;
  }
  const refreshProject = (): Promise<void> => {
    if (controller.signal.aborted) return Promise.resolve();
    if (projectRefresh) {
      projectAgain = true;
      return projectRefresh;
    }
    projectRefresh = (async () => {
      do {
        projectAgain = false;
        try {
          const candidate = await inspectProject(context.cwd, controller.signal);
          if (!controller.signal.aborted) project = candidate;
        } catch {
          warn("Git inspection");
        }
      } while (projectAgain && !controller.signal.aborted);
      environment.requestRender();
    })().finally(() => { projectRefresh = undefined; });
    return projectRefresh;
  };
  const refreshWidgets = () => {
    for (const instance of instances) {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) return instance.widget.refresh?.();
      }).then(() => { instance.failed = false; }, () => {
        instance.failed = true;
        warn(instance.spec.widget);
      }).finally(environment.requestRender);
    }
  };
  unsubscribe = footer.onBranchChange(() => { void refreshProject(); });
  return {
    invalidate() {},
    dispose,
    updateContext(next: ExtensionContext) {
      if (!controller.signal.aborted) context = next;
    },
    refresh() {
      if (controller.signal.aborted) return;
      void refreshProject();
      refreshWidgets();
      environment.requestRender();
    },
    render(width: number): string[] {
      if (controller.signal.aborted) return [];
      const theme = context.ui.theme;
      const cells = (group: Instance[]) => group.map((instance) => {
        let text: string;
        try {
          text = instance.failed ? theme.fg("warning", `${instance.spec.widget} unavailable`) : instance.widget.render(theme);
          if (typeof text !== "string" || /[\r\n]/.test(text)) throw new Error("Widget output must be one line");
        } catch {
          text = theme.fg("warning", `${instance.spec.widget} unavailable`);
          // Rendering stays pure; report failures after the current frame.
          queueMicrotask(() => warn(instance.spec.widget));
        }
        return { text, priority: instance.spec.priority };
      }).filter((cell) => cell.text);
      return lines.map((line) => layoutRow({ left: cells(line.left), center: cells(line.center), right: cells(line.right) }, width, config.separator));
    },
  };
}

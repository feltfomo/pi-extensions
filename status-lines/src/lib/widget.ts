import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import type { ProjectInfo } from "./project.ts";

export interface WidgetEnvironment {
  context(): ExtensionContext;
  project(): ProjectInfo;
  footer: ReadonlyFooterDataProvider;
  signal: AbortSignal;
  requestRender(): void;
}

export interface Widget {
  render(theme: Theme): string;
  refresh?(): void | Promise<void>;
  dispose?(): void;
}

export type WidgetFactory = (
  environment: WidgetEnvironment,
  settings: Readonly<Record<string, unknown>>,
) => Widget;

export interface WidgetSpec {
  widget: string;
  priority: number;
  settings: Record<string, unknown>;
}

export interface LineSpec {
  left: WidgetSpec[];
  center: WidgetSpec[];
  right: WidgetSpec[];
}

export interface Config {
  separator: string;
  lines: LineSpec[];
}

// OSC, CSI, and control bytes are forbidden in untrusted labels. Widget output may use theme ANSI.
export function plainLabel(value: string): string {
  return value.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}

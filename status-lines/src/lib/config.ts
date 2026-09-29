import { readFile } from "node:fs/promises";
import type { Config, WidgetSpec } from "./widget.ts";

function object(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${location} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], location: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unknown setting ${location}.${key}`);
  }
}

export function parseConfig(value: unknown): Config {
  const root = object(value, "config");
  keys(root, ["separator", "lines"], "config");
  const separator = root.separator ?? " | ";
  if (typeof separator !== "string" || /[\x00-\x1f\x7f-\x9f]/.test(separator)) throw new Error("separator must be printable text");
  if (!Array.isArray(root.lines) || root.lines.length < 1 || root.lines.length > 10) {
    throw new Error("lines must contain between 1 and 10 tiers");
  }
  const lines = root.lines.map((value, tier) => {
    const line = object(value, `lines[${tier}]`);
    keys(line, ["left", "center", "right"], `lines[${tier}]`);
    const group = (side: string): WidgetSpec[] => {
      const entries = line[side] ?? [];
      if (!Array.isArray(entries)) throw new Error(`lines[${tier}].${side} must be an array`);
      return entries.map((entry, index) => {
        const location = `lines[${tier}].${side}[${index}]`;
        const spec = object(entry, location);
        keys(spec, ["widget", "priority", "settings"], location);
        if (typeof spec.widget !== "string" || !/^[a-z][a-z0-9-]*$/.test(spec.widget)) {
          throw new Error(`${location}.widget must be a lowercase widget name`);
        }
        const priority = spec.priority ?? 50;
        if (typeof priority !== "number" || !Number.isFinite(priority)) throw new Error(`${location}.priority must be finite`);
        return { widget: spec.widget, priority, settings: object(spec.settings ?? {}, `${location}.settings`) };
      });
    };
    return { left: group("left"), center: group("center"), right: group("right") };
  });
  return { separator, lines };
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(JSON.parse(await readFile(path, "utf8")));
}

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import statusLines from "../src/index.ts";

function registeredConfig(config?: string): string {
  let defaultPath = "";
  const pi = {
    registerFlag(name: string, options: { default: string }) {
      if (name === "status-lines-config") defaultPath = options.default;
    },
    on() {}, registerCommand() {},
  } as unknown as ExtensionAPI;
  statusLines(pi, config);
  return defaultPath;
}

test("normal Pi loading defaults to the package JSON", () => {
  assert.equal(registeredConfig(), fileURLToPath(new URL("../status-lines.json", import.meta.url)));
});

test("a managed loader can supply generated JSON without global environment changes", () => {
  assert.equal(registeredConfig("/nix/store/generated-status-lines.json"), "/nix/store/generated-status-lines.json");
});

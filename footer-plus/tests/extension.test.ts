import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import statusLines from "../src/index.ts";

function registeredConfig(config?: string): string {
  let defaultPath = "";
  const pi = {
    registerFlag(name: string, options: { default: string }) {
      if (name === "footer-config") defaultPath = options.default;
    },
    on() {}, registerCommand() {}, registerShortcut() {},
  } as unknown as ExtensionAPI;
  statusLines(pi, config);
  return defaultPath;
}

test("normal Pi loading defaults to the package JSON", () => {
  assert.equal(registeredConfig(), fileURLToPath(new URL("../footer.json", import.meta.url)));
});

test("a managed loader can supply generated JSON without global environment changes", () => {
  assert.equal(registeredConfig("/nix/store/generated-footer.json"), "/nix/store/generated-footer.json");
});

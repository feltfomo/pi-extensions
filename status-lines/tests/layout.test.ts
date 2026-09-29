import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { layoutRow } from "../src/lib/layout.ts";

const cell = (text: string, priority = 50) => ({ text, priority });

test("left, terminal-centered, and right widgets occupy their own regions", () => {
  const output = layoutRow({ left: [cell("project")], center: [cell("AI")], right: [cell("weekly")] }, 40, " | ");
  assert.equal(output.indexOf("project"), 0);
  assert.equal(output.indexOf("AI"), 19);
  assert.equal(output.indexOf("weekly"), 34);
  assert.equal(visibleWidth(output), 40);
});

test("empty regions do not add separators", () => {
  assert.equal(layoutRow({ left: [cell(""), cell("one"), cell("two")], center: [], right: [] }, 80, " | "), "one | two");
});

test("narrow widths retain the highest-priority widget and truncate by terminal columns", () => {
  const row = { left: [cell("low", 1)], center: [cell("middle", 2)], right: [cell("\x1b[31m界界weekly\x1b[0m", 100)] };
  for (let width = 0; width <= 80; width++) {
    const output = layoutRow(row, width, " | ");
    assert.ok(visibleWidth(output) <= width, `width ${width}`);
    assert.ok(!/[\r\n]/.test(output));
  }
  assert.ok(!layoutRow(row, 10, " | ").includes("low"));
  assert.ok(layoutRow(row, 12, " | ").includes("weekly"));
});

test("center is anchored to the terminal even with unequal side widths", () => {
  const output = layoutRow({ left: [cell("longer left")], center: [cell("MID")], right: [cell("R")] }, 50, " | ");
  assert.equal(output.indexOf("MID"), 23);
});

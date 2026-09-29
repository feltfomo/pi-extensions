import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface Cell { text: string; priority: number }
export interface Row { left: Cell[]; center: Cell[]; right: Cell[] }
type Side = keyof Row;
const sides: Side[] = ["left", "center", "right"];

export function layoutRow(row: Row, width: number, separator: string): string {
  width = Math.max(0, Math.floor(width));
  if (!width) return "";
  const groups: Row = { left: [...row.left], center: [...row.center], right: [...row.right] };
  const texts = () => sides.map((side) => groups[side].map((cell) => cell.text).filter(Boolean).join(separator));
  const positions = (values: string[]) => {
    const sizes = values.map(visibleWidth);
    return { sizes, starts: [0, Math.floor((width - sizes[1]) / 2), width - sizes[2]] };
  };
  const fits = (values: string[]) => {
    const { sizes, starts } = positions(values);
    let end = -2;
    for (let i = 0; i < 3; i++) {
      if (!sizes[i]) continue;
      if (starts[i] < end + 2 || starts[i] < 0 || starts[i] + sizes[i] > width) return false;
      end = starts[i] + sizes[i];
    }
    return true;
  };
  while (!fits(texts())) {
    const candidates = sides.flatMap((side) => groups[side].map((cell, index) => ({ side, index, priority: cell.priority })));
    if (candidates.length <= 1) {
      for (const side of sides) {
        if (groups[side][0]) groups[side][0] = { ...groups[side][0], text: truncateToWidth(groups[side][0].text, width) };
      }
      break;
    }
    candidates.sort((a, b) => a.priority - b.priority);
    const drop = candidates[0];
    groups[drop.side].splice(drop.index, 1);
  }
  const values = texts();
  const { starts } = positions(values);
  let output = "";
  for (let i = 0; i < 3; i++) {
    if (!values[i]) continue;
    output += " ".repeat(Math.max(0, starts[i] - visibleWidth(output))) + values[i];
  }
  return truncateToWidth(output, width);
}

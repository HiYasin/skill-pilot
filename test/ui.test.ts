import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CLAUDE_MD_END, CLAUDE_MD_START } from "../src/constants.ts";
import { cleanupClaudeMd } from "../src/legacy/claude-md.ts";
import { formatTime, wrapText } from "../src/ui/format.ts";
import { buildRows, reducePicker, splitKeys, type PickerState } from "../src/ui/picker.ts";
import { tmpDir, writeFile } from "./helpers.ts";

const items = ["a", "b", "c"];
const start = (selected = [true, false, true]): PickerState => ({ cursor: 0, selected, offset: 0, done: false, cancelled: false });

describe("picker", () => {
  it("moves with arrows and j/k, wrapping around", () => {
    strictEqual(reducePicker(start(), "\x1b[A", items).cursor, 2);
    strictEqual(reducePicker(start(), "j", items).cursor, 1);
    strictEqual(reducePicker({ ...start(), cursor: 2 }, "\x1b[B", items).cursor, 0);
  });

  it("toggles one item with space and all items with a", () => {
    deepStrictEqual(reducePicker(start(), " ", items).selected, [false, false, true]);
    deepStrictEqual(reducePicker(start(), "a", items).selected, [true, true, true]);
    deepStrictEqual(reducePicker(start([true, true, true]), "a", items).selected, [false, false, false]);
  });

  it("runs shortcuts and finishes on enter or ctrl-c", () => {
    const shortcuts = [{ key: "n", label: "new", select: (xs: string[]) => xs.map((x) => x === "b") }];
    deepStrictEqual(reducePicker(start(), "n", items, shortcuts).selected, [false, true, false]);
    strictEqual(reducePicker(start(), "\r", items).done, true);
    const cancelled = reducePicker(start(), "\x03", items);
    strictEqual(cancelled.done && cancelled.cancelled, true);
  });

  it("splits a chunk into keys", () => {
    deepStrictEqual(splitKeys("j\x1b[A k"), ["j", "\x1b[A", " ", "k"]);
  });

  it("adds group headings only when there are several groups", () => {
    strictEqual(buildRows(items, () => "same").length, 3);
    deepStrictEqual(
      buildRows(items, (x) => (x === "c" ? "two" : "one")).map((r) => r.kind),
      ["group", "item", "item", "group", "item"],
    );
  });
});

describe("format helpers", () => {
  it("formats durations", () => {
    strictEqual(formatTime(250), "250ms");
    strictEqual(formatTime(1530), "1.5s");
    strictEqual(formatTime(125_000), "2m 5s");
  });

  it("wraps text and splits long words", () => {
    deepStrictEqual(wrapText("one two three", 7), ["one two", "three"]);
    deepStrictEqual(wrapText("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  });
});

describe("CLAUDE.md cleanup", () => {
  it("removes only the marked section", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "CLAUDE.md", `# Notes\n\nKeep me.\n\n${CLAUDE_MD_START}\nold skills\n${CLAUDE_MD_END}\n`);
    deepStrictEqual(cleanupClaudeMd(dir), { cleaned: true, deleted: false });
    strictEqual(readFileSync(join(dir, "CLAUDE.md"), "utf-8"), "# Notes\n\nKeep me.\n");
  });

  it("deletes a file left empty and ignores files without markers", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "CLAUDE.md", `${CLAUDE_MD_START}\nx\n${CLAUDE_MD_END}`);
    deepStrictEqual(cleanupClaudeMd(dir), { cleaned: true, deleted: true });
    strictEqual(existsSync(join(dir, "CLAUDE.md")), false);

    writeFile(dir, "CLAUDE.md", "# Mine");
    deepStrictEqual(cleanupClaudeMd(dir), { cleaned: false, deleted: false });
  });
});

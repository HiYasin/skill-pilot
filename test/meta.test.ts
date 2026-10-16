import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { META } from "../src/meta.ts";
import { gradientAt, hexToRgb } from "../src/ui/banner.ts";
import { SUPPORTED_CHARACTERS, pixelRows, renderWordmark } from "../src/ui/font.ts";
import { nextMeta, planMetaChange, readMeta, validateMeta } from "../scripts/set-meta.ts";
import { tmpDir } from "./helpers.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("wordmark font", () => {
  it("has 7 equal-width rows for every glyph", () => {
    for (const ch of SUPPORTED_CHARACTERS) {
      const rows = pixelRows(ch);
      strictEqual(rows.length, 7, ch);
      strictEqual(new Set(rows.map((r) => r.length)).size, 1, ch);
    }
  });

  it("renders 4 lines of equal width using half blocks", () => {
    const lines = renderWordmark("ab-9");
    strictEqual(lines.length, 4);
    strictEqual(new Set(lines.map((l) => l.length)).size, 1);
    ok(lines.join("").split("").every((c) => " ▀▄█".includes(c)));
  });

  it("can draw the current wordmark", () => {
    for (const ch of META.wordmark.toUpperCase()) ok(SUPPORTED_CHARACTERS.includes(ch), ch);
  });
});

describe("banner colours", () => {
  it("parses hex and walks the gradient end to end", () => {
    deepStrictEqual(hexToRgb("#22d3ee"), [34, 211, 238]);
    deepStrictEqual(hexToRgb("#fff"), [255, 255, 255]);
    const stops = META.gradient.map(hexToRgb);
    deepStrictEqual(gradientAt(stops, 0), stops[0]);
    deepStrictEqual(gradientAt(stops, 1), stops.at(-1));
  });
});

function copyProject(dest: string): void {
  for (const rel of ["src/meta.ts", "package.json", "package-lock.json", "registry/index.json", ".github/workflows/compat.yml", "README.md"]) {
    mkdirSync(dirname(join(dest, rel)), { recursive: true });
    copyFileSync(join(ROOT, rel), join(dest, rel));
  }
}

describe("set-meta", () => {
  it("derives command name and env prefix from a scoped package name", () => {
    const next = nextMeta(readMeta(ROOT), { name: "@acme/stack-skills", repo: "acme/stack-skills" });
    strictEqual(next.packageName, "@acme/stack-skills");
    strictEqual(next.cliName, "stack-skills");
    strictEqual(next.envPrefix, "STACK_SKILLS");
    strictEqual(next.wordmark, "stack-skills");
    deepStrictEqual(validateMeta(next), []);
  });

  it("rejects invalid names, repos and prefixes", () => {
    const bad = nextMeta(readMeta(ROOT), { name: "Bad Name", repo: "no-slash", envPrefix: "lower" });
    strictEqual(validateMeta(bad).length, 3);
  });

  it("updates every file that carries the metadata and leaves hashes alone", (t) => {
    const root = tmpDir(t);
    copyProject(root);
    const old = readMeta(root);
    const next = nextMeta(old, { name: "zz-meta-test", repo: "acme-test/zz-meta-test" });
    const changes = planMetaChange(root, old, next, "Acme Ltd");
    const byFile = new Map(changes.map((c) => [c.file, c.after]));

    ok(byFile.get("src/meta.ts")!.includes('githubRepo: "acme-test/zz-meta-test"'));
    ok(byFile.get("src/meta.ts")!.includes('envPrefix: "ZZ_META_TEST"'));

    const pkg = JSON.parse(byFile.get("package.json")!);
    strictEqual(pkg.name, "zz-meta-test");
    deepStrictEqual(pkg.bin, { "zz-meta-test": "bin.mjs" });
    strictEqual(pkg.repository.url, "git+https://github.com/acme-test/zz-meta-test.git");
    strictEqual(pkg.author, "Acme Ltd");

    const before = JSON.parse(readFileSync(join(root, "registry/index.json"), "utf-8"));
    const after = JSON.parse(byFile.get("registry/index.json")!);
    type Entry = { source: string; skillPath: string; bundleHash: string };
    for (const [name, entry] of Object.entries(after.skills) as [string, Entry][]) {
      const was = before.skills[name] as Entry;
      if (was.source === old.githubRepo) {
        // Own skills move to the new repo.
        strictEqual(entry.source, "acme-test/zz-meta-test");
        strictEqual(entry.skillPath, `acme-test/zz-meta-test/${name}`);
      } else {
        // Upstream skills keep their original owner.
        strictEqual(entry.source, was.source);
        strictEqual(entry.skillPath, was.skillPath);
      }
      strictEqual(entry.bundleHash, was.bundleHash);
    }

    // Paths are reported with forward slashes on every OS (Windows regression).
    ok(changes.every((c) => !c.file.includes("\\")), changes.map((c) => c.file).join(", "));
    ok(byFile.has(".github/workflows/compat.yml"), `changed: ${[...byFile.keys()].join(", ")}`);
    ok(byFile.get(".github/workflows/compat.yml")!.includes("ZZ_META_TEST_REGISTRY_BASE_URL"));
    ok(!byFile.get("README.md")!.includes(old.githubRepo));
    ok(byFile.get("README.md")!.includes("npx zz-meta-test"));
  });

  it("can rename twice, from a scoped name back to a plain one", (t) => {
    const root = tmpDir(t);
    copyProject(root);
    const apply = (opts: { name: string; repo: string }): void => {
      const old = readMeta(root);
      for (const c of planMetaChange(root, old, nextMeta(old, opts))) writeFileSync(join(root, c.file), c.after);
    };
    apply({ name: "@zz-scope/zz-two", repo: "zz-scope/zz-two" });
    apply({ name: "zz-three", repo: "zz-org/zz-three" });
    const readme = readFileSync(join(root, "README.md"), "utf-8");
    ok(readme.includes("npx zz-three"));
    ok(!readme.includes("zz-two"), "no trace of the intermediate name");
    strictEqual(readMeta(root).envPrefix, "ZZ_THREE");
  });
});

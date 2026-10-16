import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { TECHNOLOGIES } from "../src/catalog/technologies.ts";
import { bundleHash } from "../src/install/hash.ts";
import { bumpVersion, changelogSection } from "../scripts/release.ts";
import { validateRegistry } from "../scripts/validate-registry.ts";

describe("catalog", () => {
  it("has unique, lowercase technology ids that do not clash with special targets", () => {
    const ids = TECHNOLOGIES.map((t) => t.id);
    strictEqual(new Set(ids).size, ids.length);
    for (const id of ids) ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id), id);
    ok(!ids.includes("web-frontend") && !ids.includes("*"));
  });
});

describe("shipped registry", () => {
  it("matches skills-src/, skills-upstream.json and every hash", () => {
    const { errors } = validateRegistry();
    deepStrictEqual(errors, []);
  });
});

describe("bundleHash", () => {
  it("does not depend on key order or path separators", () => {
    strictEqual(bundleHash({ "a/b.md": "1", "c.md": "2" }), bundleHash({ "c.md": "2", "a\\b.md": "1" }));
  });
});

describe("release helpers", () => {
  it("bumps versions", () => {
    strictEqual(bumpVersion("1.2.3", "patch"), "1.2.4");
    strictEqual(bumpVersion("1.2.3", "minor"), "1.3.0");
    strictEqual(bumpVersion("1.2.3-beta.1", "major"), "2.0.0");
  });

  it("groups conventional commits", () => {
    const text = changelogSection(
      "1.1.0",
      [
        { hash: "a".repeat(40), subject: "feat(detect): add Laravel", body: "" },
        { hash: "b".repeat(40), subject: "fix: windows symlinks", body: "" },
        { hash: "c".repeat(40), subject: "feat!: new lockfile", body: "" },
        { hash: "d".repeat(40), subject: "chore(release): v1.0.0", body: "" },
      ],
      "https://github.com/acme/tool",
      "2026-10-14",
    );
    ok(text.startsWith("## v1.1.0 (2026-10-14)"));
    ok(text.includes("### Features\n\n- add Laravel"));
    ok(text.includes("### Fixes\n\n- windows symlinks"));
    ok(text.includes("### Breaking changes\n\n- new lockfile"));
    ok(!text.includes("v1.0.0"));
  });
});

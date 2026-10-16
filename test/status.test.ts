import { deepStrictEqual } from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { localSkillState } from "../src/install/status.ts";
import { buildRegistry, tmpDir, writeFile, writeJson } from "./helpers.ts";

const lock = (names: string[]) => ({
  version: 1,
  skills: Object.fromEntries(names.map((n) => [n, { source: "acme/skills", sourceType: "registry", computedHash: "x" }])),
});

describe("localSkillState", () => {
  it("only counts skills whose files are still on disk", (t) => {
    const root = tmpDir(t);
    const { registry, skillsDir } = buildRegistry(root, [
      { name: "kept", files: { "SKILL.md": "kept", "references/a.md": "a" } },
      { name: "deleted", files: { "SKILL.md": "deleted" } },
      { name: "edited", files: { "SKILL.md": "original" } },
    ]);
    const project = join(root, "project");
    writeJson(project, "skills-lock.json", lock(["kept", "deleted", "edited", "foreign"]));

    // kept: identical copy; deleted: folder removed; edited: changed by hand; foreign: not in our registry.
    for (const name of ["kept", "deleted", "edited"]) {
      for (const rel of registry.skills[name].files) {
        writeFile(join(project, ".agents/skills", name), rel, readFixture(skillsDir, name, rel));
      }
    }
    rmSync(join(project, ".agents/skills/deleted"), { recursive: true });
    writeFileSync(join(project, ".agents/skills/edited/SKILL.md"), "changed");
    writeFile(project, ".agents/skills/foreign/SKILL.md", "from another tool");

    const state = localSkillState(project, registry);
    deepStrictEqual([...state.installed].sort(), ["foreign", "kept"]);
    deepStrictEqual([...state.outdated], ["edited"]);
  });

  it("treats a missing lockfile as nothing installed", (t) => {
    const project = tmpDir(t);
    writeFile(project, ".agents/skills/orphan/SKILL.md", "x");
    const state = localSkillState(project, null);
    deepStrictEqual([state.installed.size, state.outdated.size], [0, 0]);
  });
});

function readFixture(skillsDir: string, name: string, rel: string): string {
  return readFileSync(join(skillsDir, name, ...rel.split("/")), "utf-8");
}

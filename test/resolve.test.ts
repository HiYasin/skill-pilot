import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import type { SkillTargets, Technology } from "../src/catalog/types.ts";
import type { Registry, RegistryEntry } from "../src/install/manifest.ts";
import { collectSkills, combosOf, parseSkillPath, technologiesWithSkills } from "../src/resolve.ts";

const tech = (id: string, name = id.toUpperCase()): Technology => ({ id, name, detect: {} });

function registryOf(skills: Record<string, Partial<SkillTargets> | null>, rejected: string[] = []): Registry {
  const entries: Record<string, RegistryEntry> = {};
  for (const [name, targets] of Object.entries(skills)) {
    entries[name] = {
      source: "acme/skills",
      skillPath: `acme/skills/${name}`,
      commitSha: "x",
      license: null,
      files: ["SKILL.md"],
      sha256: { "SKILL.md": "h" },
      bundleHash: "b",
      review: {
        status: rejected.includes(name) ? "rejected" : "approved",
        flags: [],
        summary: "",
        model: "none",
        promptVersion: "1",
        reviewedAt: "",
      },
      ...(targets ? { targets: { any: targets.any ?? [], all: targets.all ?? [] } } : {}),
    };
  }
  return { version: 1, generatedAt: "", skills: entries };
}

describe("parseSkillPath", () => {
  it("splits owner/repo/name", () => {
    deepStrictEqual(parseSkillPath("vercel-labs/agent-skills/react"), {
      repo: "vercel-labs/agent-skills",
      name: "react",
      full: "vercel-labs/agent-skills/react",
    });
  });
});

describe("collectSkills", () => {
  const registry = registryOf({
    "a-only": { any: ["a"] },
    "a-or-b": { any: ["b", "a"] },
    "c-only": { any: ["c"] },
    "a-and-b": { all: ["b", "a"] },
    "a-and-c": { all: ["a", "c"] },
    design: { any: ["web-frontend"] },
    everywhere: { any: ["*"] },
    untargeted: null,
  });

  it("matches stack-any, stack-all, web-frontend and * in catalog order", () => {
    const skills = collectSkills({ detected: [tech("a"), tech("b")], isFrontend: true, registry });
    deepStrictEqual(
      skills.map((s) => [s.name, s.sources]),
      [
        ["a-only", ["A"]],
        ["a-or-b", ["A", "B"]],
        ["a-and-b", ["A + B"]],
        ["design", ["Web frontend"]],
        ["everywhere", ["Every project"]],
      ],
    );
    deepStrictEqual(combosOf(skills), ["A + B"]);
    strictEqual(skills.find((s) => s.name === "a-and-b")!.combo, "A + B");
  });

  it("leaves out frontend skills for backends and combos with a missing technology", () => {
    const skills = collectSkills({ detected: [tech("a")], isFrontend: false, registry });
    deepStrictEqual(skills.map((s) => s.name), ["a-only", "a-or-b", "everywhere"]);
    deepStrictEqual(combosOf(skills), []);
  });

  it("requires both conditions when a skill has stack-any and stack-all", () => {
    const both = registryOf({ both: { any: ["c"], all: ["a"] } });
    strictEqual(collectSkills({ detected: [tech("a")], isFrontend: false, registry: both }).length, 0);
    strictEqual(collectSkills({ detected: [tech("a"), tech("c")], isFrontend: false, registry: both }).length, 1);
  });

  it("skips rejected skills and marks installed and outdated ones", () => {
    const reg = registryOf({ one: { any: ["a"] }, two: { any: ["a"] }, bad: { any: ["a"] } }, ["bad"]);
    const skills = collectSkills({
      detected: [tech("a")],
      isFrontend: false,
      registry: reg,
      installedNames: new Set(["one"]),
      outdatedNames: new Set(["two"]),
    });
    deepStrictEqual(
      skills.map((s) => [s.name, s.installed, s.outdated]),
      [["one", true, false], ["two", false, true]],
    );
  });

  it("returns nothing without a registry", () => {
    deepStrictEqual(collectSkills({ detected: [tech("a")], isFrontend: true, registry: null }), []);
  });
});

describe("technologiesWithSkills", () => {
  it("counts stack-any and single-id stack-all, not combos or web-frontend", () => {
    const reg = registryOf({ x: { any: ["a", "web-frontend"] }, y: { all: ["b"] }, z: { all: ["c", "d"] } });
    deepStrictEqual([...technologiesWithSkills(reg)].sort(), ["a", "b"]);
  });
});

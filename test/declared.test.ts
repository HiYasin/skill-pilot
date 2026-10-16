import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { declaredSkills } from "../scripts/lib/shared.ts";
import { scaffoldSkill } from "../scripts/new-skill.ts";
import { tmpDir, writeFile, writeJson } from "./helpers.ts";

const TECH = ["nextjs", "react", "nestjs", "prisma", "postgresql", "redis"];

function skillMd(name: string, metadata: string, description = "Does a thing. Use when doing the thing."): string {
  return `---\nname: ${name}\ndescription: ${description}\nmetadata:\n${metadata}\n---\n\n# ${name}\n`;
}

function setup(t: TestContext) {
  const root = tmpDir(t);
  const srcDir = join(root, "skills-src");
  const upstreamFile = join(root, "skills-upstream.json");
  const run = () => declaredSkills({ srcDir, upstreamFile, technologyIds: TECH, ownRepo: "hiyasin/skill-pilot" });
  return { root, srcDir, upstreamFile, run };
}

describe("declaredSkills: own skills from skills-src/", () => {
  it("reads stack-any and stack-all from SKILL.md and builds the address", (t) => {
    const { srcDir, run } = setup(t);
    writeFile(srcDir, "redis-caching/SKILL.md", skillMd("redis-caching", "  stack-any: redis"));
    writeFile(srcDir, "nest-prisma/SKILL.md", skillMd("nest-prisma", "  stack-all: nestjs, prisma"));
    writeFile(srcDir, "nest-prisma/references/tx.md", "extra file");
    const { skills, problems } = run();
    deepStrictEqual(problems, []);
    const redis = skills.get("redis-caching")!;
    strictEqual(redis.path, "hiyasin/skill-pilot/redis-caching");
    strictEqual(redis.origin, "own");
    deepStrictEqual(redis.targets, { any: ["redis"], all: [] });
    deepStrictEqual(skills.get("nest-prisma")!.targets, { any: [], all: ["nestjs", "prisma"] });
  });

  it("skips folders starting with _ or .", (t) => {
    const { srcDir, run } = setup(t);
    writeFile(srcDir, "_draft/SKILL.md", "not even valid");
    writeFile(srcDir, ".hidden/SKILL.md", "nope");
    const { skills, problems } = run();
    strictEqual(skills.size, 0);
    deepStrictEqual(problems, []);
  });

  it("reports every problem with the file to fix", (t) => {
    const { srcDir, run } = setup(t);
    writeFile(srcDir, "no-skill-md/README.md", "x");
    writeFile(srcDir, "wrong-name/SKILL.md", skillMd("other-name", "  stack-any: react"));
    writeFile(srcDir, "typo/SKILL.md", skillMd("typo", "  stack-any: postgres"));
    writeFile(srcDir, "untargeted/SKILL.md", skillMd("untargeted", "  author: yasin"));
    writeFile(srcDir, "todo/SKILL.md", skillMd("todo", "  stack-any: react", "TODO: write this"));
    writeFile(srcDir, "no-frontmatter/SKILL.md", "# hello");

    const { skills, problems } = run();
    strictEqual(skills.size, 0);
    const byName = (n: string) => problems.filter((p) => p.name === n).map((p) => p.message).join(" | ");
    ok(byName("no-skill-md").includes("SKILL.md is missing"));
    ok(byName("wrong-name").includes('must match the folder name "wrong-name"'));
    ok(byName("typo").includes('did you mean "postgresql"'));
    ok(byName("untargeted").includes('no "stack-any" or "stack-all"'));
    ok(byName("todo").includes("TODO placeholder"));
    ok(byName("no-frontmatter").includes("frontmatter"));
    ok(problems.every((p) => p.where.startsWith("skills-src/")));
  });
});

describe("declaredSkills: upstream skills from skills-upstream.json", () => {
  it("reads entries and ignores $ and _ comment keys", (t) => {
    const { upstreamFile, run } = setup(t);
    writeJson(upstreamFile.replace(/[^/\\]+$/, ""), "skills-upstream.json", {
      $comment: "notes",
      _note: "also ignored",
      "vercel-labs/agent-skills/react-best-practices": { "stack-any": "react" },
      "supabase/agent-skills/supabase-postgres": { "stack-all": ["nextjs", "postgresql"] },
    });
    const { skills, problems } = run();
    deepStrictEqual(problems, []);
    const react = skills.get("react-best-practices")!;
    deepStrictEqual([react.origin, react.repo, react.targets], ["upstream", "vercel-labs/agent-skills", { any: ["react"], all: [] }]);
    deepStrictEqual(skills.get("supabase-postgres")!.targets, { any: [], all: ["nextjs", "postgresql"] });
  });

  it("reports bad keys, values, unknown fields, own-repo entries and invalid JSON", (t) => {
    const { root, run } = setup(t);
    writeJson(root, "skills-upstream.json", {
      "not-a-path": { "stack-any": "react" },
      "acme/repo/no-targets": {},
      "acme/repo/bad-value": "react",
      "acme/repo/extra-key": { "stack-any": "react", stack: "x" },
      "hiyasin/skill-pilot/mine": { "stack-any": "react" },
    });
    const messages = run().problems.map((p) => p.message).join(" | ");
    ok(messages.includes("owner/repo/skill-folder"));
    ok(messages.includes('no "stack-any" or "stack-all"'));
    ok(messages.includes("value must be an object"));
    ok(messages.includes('unknown key "stack"'));
    ok(messages.includes("belong in skills-src/mine/"));

    writeFile(root, "skills-upstream.json", "{ broken");
    ok(run().problems[0].message.includes("not valid JSON"));
  });

  it("rejects an upstream skill whose name clashes with an own skill", (t) => {
    const { root, srcDir, run } = setup(t);
    writeFile(srcDir, "react-best-practices/SKILL.md", skillMd("react-best-practices", "  stack-any: react"));
    writeJson(root, "skills-upstream.json", { "vercel-labs/agent-skills/react-best-practices": { "stack-any": "react" } });
    const { skills, problems } = run();
    strictEqual(skills.get("react-best-practices")!.origin, "own");
    ok(problems[0].message.includes("already used by hiyasin/skill-pilot/react-best-practices"));
  });
});

describe("new-skill scaffold", () => {
  it("creates a SKILL.md that sync refuses until the TODOs are filled in", (t) => {
    const { srcDir, run } = setup(t);
    scaffoldSkill("redis-caching", { srcDir, technologyIds: TECH });
    const first = run().problems.map((p) => p.message).join(" | ");
    ok(first.includes("TODO placeholder"));
    ok(first.includes('no "stack-any" or "stack-all"'));
  });

  it("creates a ready skill when targets and description are given", (t) => {
    const { srcDir, run } = setup(t);
    const file = scaffoldSkill("redis-caching", {
      srcDir,
      technologyIds: TECH,
      any: "redis",
      description: "Cache with Redis: keys, TTLs and invalidation. Use when adding caching.",
    });
    ok(file.endsWith(join("redis-caching", "SKILL.md")));
    ok(run().problems.some((p) => p.message.includes('"- TODO" placeholders')), "body TODOs block sync");

    // Write the body, then it is accepted.
    writeFileSync(file, readFileSync(file, "utf-8").replace(/^- TODO$/gm, "- Use short, namespaced keys."));
    const { skills, problems } = run();
    deepStrictEqual(problems, []);
    deepStrictEqual(skills.get("redis-caching")!.targets, { any: ["redis"], all: [] });
  });

  it("refuses bad names, unknown ids and existing folders", (t) => {
    const { srcDir } = setup(t);
    const attempt = (name: string, any?: string): string => {
      try {
        scaffoldSkill(name, { srcDir, technologyIds: TECH, any });
        return "created";
      } catch (err) {
        return (err as Error).message;
      }
    };
    ok(attempt("Bad_Name").includes("lowercase"));
    ok(attempt("ok-name", "postgres").includes('did you mean "postgresql"'));
    strictEqual(attempt("ok-name", "redis"), "created");
    ok(attempt("ok-name", "redis").includes("already exists"));
  });
});

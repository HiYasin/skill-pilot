import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it, type TestContext } from "node:test";

import { AGENTS, findAgent } from "../src/catalog/agents.ts";
import { envName } from "../src/constants.ts";
import { chooseAgents, detectAgents } from "../src/agents.ts";
import { cachedSkillDir } from "../src/install/cache.ts";
import type { FetchLike } from "../src/install/download.ts";
import { installAll, installSkill, type InstallOptions } from "../src/install/installer.ts";
import { readLockfile } from "../src/install/lockfile.ts";
import type { Registry } from "../src/install/manifest.ts";
import type { SkillEntry } from "../src/resolve.ts";
import { buildRegistry, tmpDir, writeFile, writeJson, type FixtureSkill } from "./helpers.ts";

const entry = (name: string): SkillEntry => ({ path: `acme/skills/${name}`, name, sources: ["Test"], installed: false, outdated: false });
const universal = [findAgent("universal")!];
const withClaude = [findAgent("universal")!, findAgent("claude-code")!];

/** Serves files from a registry folder, counting requests. */
function fakeFetch(skillsDir: string, override?: (url: string) => Response | null): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const custom = override?.(url);
    if (custom) return custom;
    const rel = decodeURIComponent(new URL(url).pathname.replace(/^\/skills\//, ""));
    const path = join(skillsDir, ...rel.split("/"));
    if (!existsSync(path)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(path));
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

interface Setup {
  project: string;
  registry: Registry;
  skillsDir: string;
  opts: (extra?: Partial<InstallOptions>) => InstallOptions;
}

function setup(t: TestContext, skills: FixtureSkill[] = [{ name: "alpha", files: { "SKILL.md": "# alpha", "references/a.md": "ref" } }]): Setup {
  const root = tmpDir(t);
  process.env[envName("CACHE_DIR")] = join(root, "cache");
  const project = join(root, "project");
  writeJson(project, "package.json", {});
  const { registry, skillsDir } = buildRegistry(root, skills);
  return {
    project,
    registry,
    skillsDir,
    opts: (extra = {}) => ({
      projectDir: project,
      registry,
      localRegistryDir: null,
      bases: ["https://registry.test/skills"],
      fetchImpl: fakeFetch(skillsDir),
      ...extra,
    }),
  };
}

describe("installSkill", () => {
  beforeEach(() => {
    delete process.env[envName("CACHE_DIR")];
  });

  it("copies from a local registry, links agents and writes the lockfile", async (t) => {
    const s = setup(t);
    const result = await installSkill(entry("alpha"), withClaude, s.opts({ localRegistryDir: s.skillsDir }));
    strictEqual(result.ok, true, result.error);
    strictEqual(result.source, "local-registry");
    strictEqual(readFileSync(join(s.project, ".agents/skills/alpha/references/a.md"), "utf-8"), "ref");
    const link = join(s.project, ".claude/skills/alpha");
    ok(lstatSync(link).isSymbolicLink() || lstatSync(link).isDirectory());
    strictEqual(readFileSync(join(link, "SKILL.md"), "utf-8"), "# alpha");
    deepStrictEqual(readLockfile(s.project).skills.alpha, {
      source: "acme/skills",
      sourceType: "registry",
      computedHash: s.registry.skills.alpha.bundleHash,
    });
  });

  it("downloads into the cache, then reuses the cache", async (t) => {
    const s = setup(t);
    const fetch1 = fakeFetch(s.skillsDir);
    const first = await installSkill(entry("alpha"), universal, s.opts({ fetchImpl: fetch1 }));
    strictEqual(first.source, "download", first.error);
    strictEqual(fetch1.calls.length, 2);
    ok(existsSync(join(cachedSkillDir(s.registry.skills.alpha.bundleHash), "SKILL.md")));

    // A second project: same skill comes from the cache with no network.
    const project2 = join(s.project, "..", "project2");
    writeJson(project2, "package.json", {});
    const fetch2 = fakeFetch(s.skillsDir);
    const second = await installSkill(entry("alpha"), universal, s.opts({ projectDir: project2, fetchImpl: fetch2 }));
    strictEqual(second.source, "cache");
    strictEqual(fetch2.calls.length, 0);
  });

  it("leaves a verified install alone and refreshes a modified one", async (t) => {
    const s = setup(t);
    await installSkill(entry("alpha"), universal, s.opts());
    const again = await installSkill(entry("alpha"), universal, s.opts());
    strictEqual(again.source, "up-to-date");

    writeFileSync(join(s.project, ".agents/skills/alpha/SKILL.md"), "tampered");
    const fixed = await installSkill(entry("alpha"), universal, s.opts());
    strictEqual(fixed.ok, true);
    strictEqual(fixed.source, "cache");
    strictEqual(readFileSync(join(s.project, ".agents/skills/alpha/SKILL.md"), "utf-8"), "# alpha");
  });

  it("falls back to the next base URL and rejects bytes that do not match the manifest", async (t) => {
    const s = setup(t);
    const fetchImpl = fakeFetch(s.skillsDir, (url) =>
      url.startsWith("https://bad.test/") ? new Response("evil content") : null,
    );
    const result = await installSkill(entry("alpha"), universal, s.opts({
      fetchImpl,
      bases: ["https://bad.test/skills", "https://registry.test/skills"],
    }));
    strictEqual(result.ok, true, result.error);
    ok(fetchImpl.calls.some((u) => u.startsWith("https://bad.test/")));
    strictEqual(readFileSync(join(s.project, ".agents/skills/alpha/SKILL.md"), "utf-8"), "# alpha");
  });

  it("fails without writing anything when every source serves wrong bytes", async (t) => {
    const s = setup(t);
    const result = await installSkill(entry("alpha"), universal, s.opts({
      fetchImpl: fakeFetch(s.skillsDir, () => new Response("evil")),
    }));
    strictEqual(result.ok, false);
    ok(result.error?.includes("hash mismatch"));
    strictEqual(existsSync(join(s.project, ".agents/skills/alpha")), false);
    strictEqual(existsSync(join(s.project, "skills-lock.json")), false);
  });

  it("refuses archives, path traversal, rejected skills and unknown names", async (t) => {
    const s = setup(t, [
      { name: "zipped", files: { "SKILL.md": "x", "bundle.zip": "PK" } },
      { name: "rejected", files: { "SKILL.md": "x" }, status: "rejected" },
    ]);
    s.registry.skills.escape = { ...s.registry.skills.zipped, files: ["../../evil.md"] };

    for (const [name, needle] of [
      ["zipped", "archives"],
      ["escape", "traversal"],
      ["rejected", "rejected"],
      ["missing", "not in the registry"],
    ]) {
      const result = await installSkill(entry(name), universal, s.opts());
      strictEqual(result.ok, false, name);
      ok(result.error?.includes(needle), `${name}: ${result.error}`);
    }
  });

  it("copies instead of linking when asked", async (t) => {
    const s = setup(t);
    const result = await installSkill(entry("alpha"), withClaude, s.opts({ forceCopy: true }));
    deepStrictEqual(result.links, [{ agent: "claude-code", mode: "copy" }]);
    ok(!lstatSync(join(s.project, ".claude/skills/alpha")).isSymbolicLink());
  });

  it("keeps other lockfile entries and sorts keys", async (t) => {
    const s = setup(t, [
      { name: "zeta", files: { "SKILL.md": "z" } },
      { name: "alpha", files: { "SKILL.md": "a" } },
    ]);
    writeJson(s.project, "skills-lock.json", { version: 1, skills: { other: { source: "x", sourceType: "manual", computedHash: "h" } } });
    await installAll([entry("zeta"), entry("alpha")], universal, s.opts());
    deepStrictEqual(Object.keys(readLockfile(s.project).skills), ["alpha", "other", "zeta"]);
  });
});

describe("installAll", () => {
  it("returns results in input order with limited concurrency", async (t) => {
    const s = setup(t, ["a", "b", "c", "d"].map((name) => ({ name, files: { "SKILL.md": name } })));
    let running = 0;
    let peak = 0;
    const slowFetch = fakeFetch(s.skillsDir);
    const fetchImpl = (async (url: string) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return slowFetch(url);
    }) as FetchLike;
    const results = await installAll(["a", "b", "c", "d"].map(entry), universal, { ...s.opts({ fetchImpl }), concurrency: 2 });
    deepStrictEqual(results.map((r) => r.name), ["a", "b", "c", "d"]);
    ok(results.every((r) => r.ok));
    ok(peak <= 2, `peak ${peak}`);
  });
});

describe("agents", () => {
  it("always includes universal and detects agents by ~/<folder>/skills", (t) => {
    const home = tmpDir(t);
    writeFile(home, ".claude/skills/.keep", "");
    writeFile(home, ".kiro/other/.keep", "");
    deepStrictEqual(detectAgents(home).map((a) => a.id), ["universal", "claude-code"]);
  });

  it("uses -a ids, keeps universal and reports unknown ids", () => {
    const choice = chooseAgents(["cline", "cursor", "cline"]);
    deepStrictEqual(choice.agents.map((a) => a.id), ["universal", "cline"]);
    deepStrictEqual(choice.unknown, ["cursor"]);
  });

  it("has unique ids and folders", () => {
    strictEqual(new Set(AGENTS.map((a) => a.id)).size, AGENTS.length);
    const folders = AGENTS.map((a) => a.folder).filter(Boolean);
    strictEqual(new Set(folders).size, folders.length);
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";

import { bundleHash, sha256 } from "../src/install/hash.ts";
import type { Registry, RegistryEntry } from "../src/install/manifest.ts";

/** A fresh temporary folder removed when the test ends. */
export function tmpDir(t: TestContext, prefix = "sp-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function writeFile(root: string, rel: string, content: string): string {
  const path = join(root, ...rel.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

export function writeJson(root: string, rel: string, value: unknown): string {
  return writeFile(root, rel, JSON.stringify(value, null, 2));
}

export function writePackageJson(root: string, deps: Record<string, string> = {}, extra: object = {}): void {
  writeJson(root, "package.json", { name: "fixture", dependencies: deps, ...extra });
}

export interface FixtureSkill {
  name: string;
  files: Record<string, string>;
  status?: "approved" | "flagged" | "rejected";
  /** stack-any / stack-all for the manifest entry. Defaults to none. */
  targets?: { any?: string[]; all?: string[] };
}

/**
 * Build a registry folder (`skills/<name>/...`) plus its manifest from
 * in-memory files, exactly as sync-skills would.
 */
export function buildRegistry(root: string, skills: FixtureSkill[]): { registry: Registry; skillsDir: string } {
  const skillsDir = join(root, "registry", "skills");
  const registry: Registry = { version: 1, generatedAt: "2026-01-01T00:00:00Z", skills: {} };
  for (const skill of skills) {
    const hashes: Record<string, string> = {};
    for (const [rel, content] of Object.entries(skill.files)) {
      writeFile(join(skillsDir, skill.name), rel, content);
      hashes[rel] = sha256(content);
    }
    const entry: RegistryEntry = {
      source: "acme/skills",
      skillPath: `acme/skills/${skill.name}`,
      commitSha: "abc123",
      license: "MIT",
      files: Object.keys(hashes).sort(),
      sha256: hashes,
      bundleHash: bundleHash(hashes),
      review: {
        status: skill.status ?? "approved",
        flags: skill.status === "flagged" ? ["broad shell command"] : [],
        summary: "fixture",
        model: "none",
        promptVersion: "1.0.0",
        reviewedAt: "2026-01-01T00:00:00Z",
      },
    };
    if (skill.targets) entry.targets = { any: skill.targets.any ?? [], all: skill.targets.all ?? [] };
    registry.skills[skill.name] = entry;
  }
  writeJson(root, "registry/index.json", registry);
  return { registry, skillsDir };
}

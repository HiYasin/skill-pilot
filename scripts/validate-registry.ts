#!/usr/bin/env node
// Checks that the registry matches skills-src/ and skills-upstream.json, that
// every skill's stack-any / stack-all is valid and synced, and that every file
// matches its recorded hash. Runs in CI and before every npm publish.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { bundleHash, sha256File } from "../src/install/hash.ts";
import { MANIFEST_PATH, REGISTRY_SKILLS_DIR, unsafeRelPath, type Registry } from "../src/install/manifest.ts";
import { TECHNOLOGIES } from "../src/catalog/technologies.ts";
import { checkTargets, emptyTargets } from "../src/targets.ts";
import { color, declaredSkills, formatProblem, isMain, listFiles, sameTargets, type DeclaredOptions } from "./lib/shared.ts";

export function validateRegistry(
  manifestPath = MANIFEST_PATH,
  skillsDir = REGISTRY_SKILLS_DIR,
  declaredOptions: DeclaredOptions = {},
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  let registry: Registry;
  try {
    registry = JSON.parse(readFileSync(manifestPath, "utf-8")) as Registry;
  } catch (err) {
    return { errors: [`cannot read manifest ${manifestPath}: ${(err as Error).message}`], warnings };
  }

  const { skills: declared, problems } = declaredSkills(declaredOptions);
  errors.push(...problems.map(formatProblem));
  const technologyIds = declaredOptions.technologyIds ?? TECHNOLOGIES.map((t) => t.id);
  const sourceOf = (origin: "own" | "upstream", name: string): string =>
    origin === "own" ? `skills-src/${name}` : "skills-upstream.json";

  for (const [name, decl] of declared) {
    const entry = registry.skills[name];
    if (!entry) {
      errors.push(`${name}: in ${sourceOf(decl.origin, name)} but missing from the manifest (run: npm run sync:skills -- --only ${name})`);
      continue;
    }
    if (entry.skillPath !== decl.path) {
      errors.push(`${name}: manifest has ${entry.skillPath}, expected ${decl.path} (run sync:skills)`);
    }
    if (!sameTargets(entry.targets, decl.targets)) {
      errors.push(`${name}: stack-any / stack-all changed since the last sync (run: npm run sync:skills -- --only ${name})`);
    }
    if (entry.review?.status === "rejected") errors.push(`${name}: review status is "rejected"`);

    const dir = join(skillsDir, name);
    if (!existsSync(dir)) {
      errors.push(`${name}: folder ${dir} is missing`);
      continue;
    }
    if (!entry.files.includes("SKILL.md")) errors.push(`${name}: no SKILL.md listed`);

    for (const rel of entry.files) {
      const problem = unsafeRelPath(rel);
      if (problem) {
        errors.push(`${name}: ${rel}: ${problem}`);
        continue;
      }
      const abs = join(dir, ...rel.split("/"));
      if (!existsSync(abs)) errors.push(`${name}: missing file ${rel}`);
      else if (sha256File(abs) !== entry.sha256[rel]) errors.push(`${name}: hash mismatch for ${rel}`);
    }
    if (bundleHash(entry.sha256) !== entry.bundleHash) errors.push(`${name}: bundle hash does not match file hashes`);

    const extra = listFiles(dir).filter((f) => !entry.files.includes(f));
    if (extra.length > 0) warnings.push(`${name}: files not in manifest (will not be installed): ${extra.join(", ")}`);
  }

  for (const [name, entry] of Object.entries(registry.skills)) {
    if (emptyTargets(entry.targets)) errors.push(`${name}: no stack-any / stack-all in the manifest, the CLI will never offer it`);
    else for (const p of checkTargets(entry.targets!, technologyIds)) errors.push(`${name}: ${p}`);
    if (!declared.has(name) && !problems.some((p) => p.name === name)) {
      warnings.push(`${name}: in the manifest but not in skills-src/ or skills-upstream.json (a full sync removes it)`);
    }
  }
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !registry.skills[entry.name]) {
        warnings.push(`${entry.name}: folder exists but is not in the manifest`);
      }
    }
  }

  return { errors, warnings };
}

if (isMain(import.meta.url)) {
  const { errors, warnings } = validateRegistry();
  for (const w of warnings) console.log(color.yellow(`  ⚠ ${w}`));
  for (const e of errors) console.log(color.red(`  ✘ ${e}`));
  if (errors.length > 0) {
    console.log(color.red(`\n  Registry invalid: ${errors.length} error(s).\n`));
    process.exitCode = 1;
  } else {
    const count = declaredSkills().skills.size;
    console.log(color.green(`  ✔ Registry valid: ${count} skills, ${warnings.length} warning(s).`));
  }
}

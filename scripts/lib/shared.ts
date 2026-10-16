import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TECHNOLOGIES } from "../../src/catalog/technologies.ts";
import type { SkillTargets } from "../../src/catalog/types.ts";
import { GITHUB_REPO, PACKAGE_ROOT } from "../../src/constants.ts";
import { parseSkillPath } from "../../src/resolve.ts";
import { checkTargets, parseTargetList } from "../../src/targets.ts";
import { FrontmatterError, invalidSkillName, parseFrontmatter } from "./frontmatter.ts";

export const SKILLS_SRC_DIR = join(PACKAGE_ROOT, "skills-src");
export const UPSTREAM_FILE = join(PACKAGE_ROOT, "skills-upstream.json");

export interface DeclaredSkill {
  /** Folder name, unique across the registry. */
  name: string;
  /** "owner/repo/skill-name". */
  path: string;
  /** "owner/repo". */
  repo: string;
  /** "own" = skills-src/<name>; "upstream" = listed in skills-upstream.json. */
  origin: "own" | "upstream";
  targets: SkillTargets;
  /** Own skills: the folder holding SKILL.md. */
  dir?: string;
  /** Own skills: `license` from the frontmatter, if any. */
  license?: string;
}

export interface SkillProblem {
  /** Skill name when the problem belongs to one skill, otherwise undefined. */
  name?: string;
  /** Where to fix it, e.g. "skills-src/redis-caching/SKILL.md". */
  where: string;
  message: string;
}

export interface DeclaredResult {
  /** Valid skills, keyed by name. */
  skills: Map<string, DeclaredSkill>;
  /** Everything that stopped a skill from being declared. */
  problems: SkillProblem[];
}

export interface DeclaredOptions {
  srcDir?: string;
  upstreamFile?: string;
  technologyIds?: string[];
  ownRepo?: string;
}

function targetsFrom(anyValue: unknown, allValue: unknown): SkillTargets {
  return { any: parseTargetList(anyValue), all: parseTargetList(allValue) };
}

/** Own skills: every folder in skills-src/ except those starting with "_" or ".". */
function ownSkills(opts: Required<DeclaredOptions>, add: (s: DeclaredSkill) => void, problem: (p: SkillProblem) => void): void {
  if (!existsSync(opts.srcDir)) return;
  for (const entry of readdirSync(opts.srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const folder = entry.name;
    const where = `skills-src/${folder}/SKILL.md`;
    const dir = join(opts.srcDir, folder);
    const fail = (message: string): void => problem({ name: folder, where, message });

    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd)) {
      fail("SKILL.md is missing");
      continue;
    }

    let fm;
    let text = "";
    try {
      text = readFileSync(skillMd, "utf-8");
      fm = parseFrontmatter(text);
    } catch (err) {
      fail(err instanceof FrontmatterError ? err.message : `could not read frontmatter: ${(err as Error).message}`);
      continue;
    }

    const issues: string[] = [];
    const name = fm.fields.name ?? "";
    const nameProblem = invalidSkillName(name);
    if (nameProblem) issues.push(nameProblem);
    else if (name !== folder) issues.push(`name "${name}" must match the folder name "${folder}"`);
    if (invalidSkillName(folder)) issues.push(`folder name "${folder}" is not a valid skill name`);

    const description = fm.fields.description ?? "";
    if (!description) issues.push("description is missing");
    else if (description.length > 1024) issues.push("description is longer than 1024 characters");
    else if (/\bTODO\b/.test(description)) issues.push("description still contains the TODO placeholder");
    // The `- TODO` bullets new-skill writes into the body.
    if (/^[ \t]*- TODO[ \t]*\r?$/m.test(text)) issues.push('the body still has "- TODO" placeholders from new-skill');

    const targets = targetsFrom(fm.metadata["stack-any"], fm.metadata["stack-all"]);
    issues.push(...checkTargets(targets, opts.technologyIds));

    if (issues.length > 0) {
      for (const message of issues) fail(message);
      continue;
    }
    add({
      name: folder,
      path: `${opts.ownRepo}/${folder}`,
      repo: opts.ownRepo,
      origin: "own",
      targets,
      dir,
      license: fm.fields.license,
    });
  }
}

/** Upstream skills: skills-upstream.json. Keys starting with "$" or "_" are comments. */
function upstreamSkills(opts: Required<DeclaredOptions>, add: (s: DeclaredSkill) => void, problem: (p: SkillProblem) => void): void {
  if (!existsSync(opts.upstreamFile)) return;
  const where = "skills-upstream.json";
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(opts.upstreamFile, "utf-8"));
  } catch (err) {
    problem({ where, message: `not valid JSON: ${(err as Error).message}` });
    return;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    problem({ where, message: 'must be an object: { "owner/repo/skill": { "stack-any": "react" } }' });
    return;
  }

  for (const [path, value] of Object.entries(data as Record<string, unknown>)) {
    if (path.startsWith("$") || path.startsWith("_")) continue;
    const { name, repo } = parseSkillPath(path);
    const fail = (message: string): void => problem({ name: name || path, where: `${where} → "${path}"`, message });

    if (!name || !repo || path.split("/").filter(Boolean).length !== 3) {
      fail("key must be owner/repo/skill-folder, e.g. vercel-labs/agent-skills/react-best-practices");
      continue;
    }
    if (repo === opts.ownRepo) {
      fail(`skills from your own repo belong in skills-src/${name}/, not in skills-upstream.json`);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail('value must be an object like { "stack-any": "react" }');
      continue;
    }
    const v = value as Record<string, unknown>;
    const unknownKeys = Object.keys(v).filter((k) => k !== "stack-any" && k !== "stack-all");
    if (unknownKeys.length > 0) {
      fail(`unknown key${unknownKeys.length > 1 ? "s" : ""} ${unknownKeys.map((k) => `"${k}"`).join(", ")} (use "stack-any" / "stack-all")`);
      continue;
    }
    const targets = targetsFrom(v["stack-any"], v["stack-all"]);
    const issues = checkTargets(targets, opts.technologyIds);
    if (issues.length > 0) {
      for (const message of issues) fail(message);
      continue;
    }
    add({ name, path, repo, origin: "upstream", targets });
  }
}

/**
 * Every skill that should be in the registry: own skills from skills-src/
 * (targets in SKILL.md frontmatter) and upstream skills from
 * skills-upstream.json. Skills with problems are left out and reported.
 */
export function declaredSkills(options: DeclaredOptions = {}): DeclaredResult {
  const opts: Required<DeclaredOptions> = {
    srcDir: options.srcDir ?? SKILLS_SRC_DIR,
    upstreamFile: options.upstreamFile ?? UPSTREAM_FILE,
    technologyIds: options.technologyIds ?? TECHNOLOGIES.map((t) => t.id),
    ownRepo: options.ownRepo ?? GITHUB_REPO,
  };
  const skills = new Map<string, DeclaredSkill>();
  const problems: SkillProblem[] = [];
  const problem = (p: SkillProblem): void => {
    problems.push(p);
  };
  const add = (skill: DeclaredSkill): void => {
    const existing = skills.get(skill.name);
    if (existing) {
      problem({
        name: skill.name,
        where: skill.origin === "upstream" ? `skills-upstream.json → "${skill.path}"` : `skills-src/${skill.name}`,
        message: `skill name "${skill.name}" is already used by ${existing.path}; names must be unique`,
      });
      return;
    }
    skills.set(skill.name, skill);
  };

  ownSkills(opts, add, problem);
  upstreamSkills(opts, add, problem);
  return { skills, problems };
}

export function formatProblem(p: SkillProblem): string {
  return `${p.where}: ${p.message}`;
}

/** Relative file paths (forward slashes) under `dir`, sorted, skipping dotfiles and dot-folders. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) out.push(relative(dir, abs).split("\\").join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** True when the module at `metaUrl` is the script node was started with. */
export function isMain(metaUrl: string): boolean {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

export function fileSize(path: string): number {
  return statSync(path).size;
}

export function sameTargets(a: SkillTargets | undefined, b: SkillTargets | undefined): boolean {
  const norm = (t: SkillTargets | undefined): string =>
    JSON.stringify({ any: [...(t?.any ?? [])].sort(), all: [...(t?.all ?? [])].sort() });
  return norm(a) === norm(b);
}

export const color = {
  red: (s: string) => `\x1b[31m${s}\x1b[39m`,
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
};

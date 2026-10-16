import { existsSync } from "node:fs";
import { join } from "node:path";

import { CANONICAL_SKILLS_DIR } from "../catalog/agents.ts";
import type { Agent } from "../catalog/types.ts";
import { env } from "../constants.ts";
import type { SkillEntry } from "../resolve.ts";
import { cachedSkillDir } from "./cache.ts";
import { downloadSkill, type FetchLike } from "./download.ts";
import { copyListedFiles, linkOrCopy, removePath, verifyDir } from "./files.ts";
import { recordInLockfile } from "./lockfile.ts";
import { REGISTRY_SKILLS_DIR, loadRegistry, unsafeRelPath, type Registry } from "./manifest.ts";

export interface InstallOptions {
  projectDir: string;
  registry?: Registry | null;
  /** Folder holding `<skill>/` copies shipped beside the CLI (a dev checkout). */
  localRegistryDir?: string | null;
  fetchImpl?: FetchLike;
  bases?: string[];
  /** Force copies instead of symlinks (tests, odd filesystems). */
  forceCopy?: boolean;
  trace?: (skill: string, message: string) => void;
}

export type InstallSource = "up-to-date" | "local-registry" | "cache" | "download";

export interface InstallResult {
  name: string;
  ok: boolean;
  source?: InstallSource;
  links: { agent: string; mode: "symlink" | "copy" }[];
  error?: string;
  /** Extra lines shown with --verbose. */
  details: string[];
}

function localRegistryDir(opts: InstallOptions): string | null {
  if (opts.localRegistryDir !== undefined) return opts.localRegistryDir;
  if (env("IGNORE_LOCAL_REGISTRY")) return null;
  return existsSync(REGISTRY_SKILLS_DIR) ? REGISTRY_SKILLS_DIR : null;
}

/**
 * Install one skill:
 *   1. keep the canonical copy in `.agents/skills/<name>` if it still verifies,
 *   2. otherwise fill it from the local registry, the cache, or a download,
 *   3. link it into every chosen agent folder,
 *   4. record it in skills-lock.json.
 */
export async function installSkill(
  skill: SkillEntry,
  agents: Agent[],
  opts: InstallOptions,
): Promise<InstallResult> {
  const result: InstallResult = { name: skill.name, ok: false, links: [], details: [] };
  const trace = (msg: string): void => {
    result.details.push(msg);
    opts.trace?.(skill.name, msg);
  };
  const fail = (error: string): InstallResult => ({ ...result, ok: false, error });

  const registry = opts.registry !== undefined ? opts.registry : loadRegistry();
  if (!registry) return fail("registry manifest is missing or unreadable");
  const entry = registry.skills[skill.name];
  if (!entry) return fail(`"${skill.name}" is not in the registry`);
  if (entry.review.status === "rejected") return fail("the registry review rejected this skill");
  for (const rel of entry.files) {
    const problem = unsafeRelPath(rel);
    if (problem) return fail(`refusing file ${rel}: ${problem}`);
  }

  const canonical = join(opts.projectDir, ...CANONICAL_SKILLS_DIR.split("/"), skill.name);

  try {
    const current = verifyDir(canonical, entry);
    if (current.ok) {
      result.source = "up-to-date";
      trace("installed copy verified, nothing to download");
    } else {
      if (existsSync(canonical)) trace(`installed copy needs refresh: ${current.reason}`);
      removePath(canonical);

      const local = localRegistryDir(opts);
      const localDir = local ? join(local, skill.name) : null;
      const cached = cachedSkillDir(entry.bundleHash);

      if (localDir && verifyDir(localDir, entry).ok) {
        copyListedFiles(localDir, canonical, entry.files);
        result.source = "local-registry";
        trace(`copied from local registry ${localDir}`);
      } else if (verifyDir(cached, entry).ok) {
        copyListedFiles(cached, canonical, entry.files);
        result.source = "cache";
        trace(`copied from cache ${cached}`);
      } else {
        trace(`downloading ${entry.files.length} file(s) to cache ${cached}`);
        await downloadSkill(skill.name, entry, cached, {
          fetchImpl: opts.fetchImpl,
          bases: opts.bases,
          trace,
        });
        copyListedFiles(cached, canonical, entry.files);
        result.source = "download";
      }

      const final = verifyDir(canonical, entry);
      if (!final.ok) return fail(`installed files failed verification: ${final.reason}`);
    }
  } catch (err) {
    return fail((err as Error).message);
  }

  const linkErrors: string[] = [];
  for (const agent of agents) {
    if (!agent.folder) continue;
    const linkPath = join(opts.projectDir, agent.folder, "skills", skill.name);
    try {
      const mode = linkOrCopy(canonical, linkPath, opts.forceCopy);
      result.links.push({ agent: agent.id, mode });
      trace(`${mode === "symlink" ? "linked" : "copied"} ${agent.folder}/skills/${skill.name}`);
    } catch (err) {
      linkErrors.push(`${agent.folder}: ${(err as Error).message}`);
    }
  }

  try {
    recordInLockfile(opts.projectDir, skill.name, {
      source: entry.source,
      sourceType: "registry",
      computedHash: entry.bundleHash,
    });
  } catch (err) {
    return fail(`could not update skills-lock.json: ${(err as Error).message}`);
  }

  if (linkErrors.length > 0) return fail(`agent links failed: ${linkErrors.join("; ")}`);
  return { ...result, ok: true };
}

export interface InstallAllHooks {
  onStart?: (skill: SkillEntry) => void;
  onDone?: (skill: SkillEntry, result: InstallResult) => void;
}

/** Install with a fixed number of workers. Results come back in input order. */
export async function installAll(
  skills: SkillEntry[],
  agents: Agent[],
  opts: InstallOptions & { concurrency?: number },
  hooks: InstallAllHooks = {},
): Promise<InstallResult[]> {
  const results: InstallResult[] = new Array(skills.length);
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < skills.length) {
      const index = next++;
      const skill = skills[index];
      hooks.onStart?.(skill);
      const result = await installSkill(skill, agents, opts);
      results[index] = result;
      hooks.onDone?.(skill, result);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, skills.length) }, worker));
  return results;
}

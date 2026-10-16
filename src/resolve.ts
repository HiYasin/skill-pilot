import type { Technology } from "./catalog/types.ts";
import type { Registry } from "./install/manifest.ts";
import { WEB_FRONTEND, matchTargets } from "./targets.ts";

export interface SkillPath {
  /** "owner/repo" */
  repo: string;
  /** Last path segment, unique across the registry. */
  name: string;
  full: string;
}

/** "owner/repo/skill-name" → { repo: "owner/repo", name: "skill-name" }. */
export function parseSkillPath(full: string): SkillPath {
  const parts = full.split("/").filter(Boolean);
  if (parts.length < 3) return { repo: "", name: parts.at(-1) ?? "", full };
  return { repo: `${parts[0]}/${parts[1]}`, name: parts.at(-1)!, full };
}

export interface SkillEntry {
  path: string;
  name: string;
  /** What made it match: technology names, a combo name, "Web frontend" or "Every project". */
  sources: string[];
  /** Present on disk and matching the registry. */
  installed: boolean;
  /** Present on disk but different from the registry (edited, or updated upstream). */
  outdated: boolean;
  /** Set for combo skills (`stack-all` with 2+ technologies): "NestJS + Prisma". */
  combo?: string;
}

export interface CollectInput {
  detected: Technology[];
  isFrontend: boolean;
  registry: Registry | null;
  installedNames?: Set<string>;
  outdatedNames?: Set<string>;
}

/**
 * Every registry skill whose `stack-any` / `stack-all` matches the project,
 * ordered like the catalog: technology skills first (in catalog order),
 * then combos, then web-frontend skills, then skills for every project.
 */
export function collectSkills({
  detected,
  isFrontend,
  registry,
  installedNames = new Set(),
  outdatedNames = new Set(),
}: CollectInput): SkillEntry[] {
  if (!registry) return [];
  const matched: (SkillEntry & { rank: number })[] = [];

  for (const [name, entry] of Object.entries(registry.skills)) {
    if (!entry.targets || entry.review?.status === "rejected") continue;
    const match = matchTargets(entry.targets, { detected, isFrontend });
    if (!match) continue;
    matched.push({
      path: entry.skillPath,
      name,
      sources: match.sources,
      combo: match.combo,
      rank: match.rank,
      installed: installedNames.has(name),
      outdated: outdatedNames.has(name),
    });
  }

  return matched
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map(({ rank: _rank, ...skill }) => skill);
}

/** Unique combo names among the matched skills, in display order. */
export function combosOf(skills: SkillEntry[]): string[] {
  return [...new Set(skills.map((s) => s.combo).filter((c): c is string => Boolean(c)))];
}

/**
 * Technology ids that at least one registry skill targets on its own
 * (through `stack-any`, or a single-id `stack-all`). Shown with a check mark
 * in "Detected technologies"; the rest are shown dimmed.
 */
export function technologiesWithSkills(registry: Registry | null): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(registry?.skills ?? {})) {
    for (const id of entry.targets?.any ?? []) if (id !== WEB_FRONTEND) ids.add(id);
    if (entry.targets?.all.length === 1) ids.add(entry.targets.all[0]);
  }
  return ids;
}

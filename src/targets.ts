// `stack-any` / `stack-all`: how a skill says when it should be offered.
//
//   stack-any: nextjs, react     offered when ANY of these is detected
//   stack-all: nestjs, prisma    offered only when ALL are detected (a "combo")
//   stack-any: web-frontend      every web frontend
//   stack-any: "*"               every project
//
// When a skill has both, both must hold.

import type { SkillTargets, Technology } from "./catalog/types.ts";

/** Matches any project that looks like a web frontend (packages or .html/.css/.tsx/... files). */
export const WEB_FRONTEND = "web-frontend";
/** Matches every project. */
export const EVERY_PROJECT = "*";
export const SPECIAL_TARGETS = [WEB_FRONTEND, EVERY_PROJECT];

/** "nextjs, react" | ["nextjs", "react"] → ["nextjs", "react"]. */
export function parseTargetList(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))];
}

export function emptyTargets(targets: SkillTargets | undefined): boolean {
  return !targets || (targets.any.length === 0 && targets.all.length === 0);
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

/** Closest known id, for "did you mean …?" messages. */
export function suggestId(unknown: string, known: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of known) {
    const score = id.startsWith(unknown) || unknown.startsWith(id) ? 0.5 : levenshtein(unknown, id);
    if (score < bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best !== null && bestScore <= Math.max(2, unknown.length / 3) ? best : null;
}

/** Problems with a set of targets: unknown ids (with a suggestion) or no targets at all. */
export function checkTargets(targets: SkillTargets, technologyIds: string[]): string[] {
  const problems: string[] = [];
  if (emptyTargets(targets)) {
    problems.push('no "stack-any" or "stack-all": add one so the CLI knows when to offer it');
  }
  const known = [...technologyIds, ...SPECIAL_TARGETS];
  for (const [key, ids] of [["stack-any", targets.any], ["stack-all", targets.all]] as const) {
    for (const id of ids) {
      if (known.includes(id)) continue;
      const hint = suggestId(id, known);
      problems.push(
        `${key}: unknown technology "${id}"` +
          (hint ? ` (did you mean "${hint}"?)` : " (add it to src/catalog/technologies.ts first)"),
      );
    }
  }
  if (targets.all.includes(EVERY_PROJECT)) problems.push('"*" only makes sense in stack-any');
  return problems;
}

export interface DetectedContext {
  /** Detected technologies, in catalog order. */
  detected: Technology[];
  isFrontend: boolean;
}

export interface TargetMatch {
  /** Names shown as "← React, Next.js" and used to group the picker. */
  sources: string[];
  /** Set when the skill is a combo (stack-all with 2+ ids): "NestJS + Prisma". */
  combo?: string;
  /** Sort key: catalog position of the first matching technology, then combos, frontend, everything. */
  rank: number;
}

const FRONTEND_LABEL = "Web frontend";
const EVERY_LABEL = "Every project";

/** Does a skill with these targets apply to the project? Returns how it matched, or null. */
export function matchTargets(targets: SkillTargets, ctx: DetectedContext): TargetMatch | null {
  if (emptyTargets(targets)) return null;
  const index = new Map(ctx.detected.map((t, i) => [t.id, i]));
  const name = (id: string): string =>
    id === WEB_FRONTEND ? FRONTEND_LABEL : id === EVERY_PROJECT ? EVERY_LABEL : (ctx.detected[index.get(id)!]?.name ?? id);
  const has = (id: string): boolean =>
    id === EVERY_PROJECT || (id === WEB_FRONTEND ? ctx.isFrontend : index.has(id));
  const rankOf = (id: string): number =>
    id === WEB_FRONTEND ? 2000 : id === EVERY_PROJECT ? 3000 : (index.get(id) ?? 999);

  if (targets.all.length > 0 && !targets.all.every(has)) return null;
  const anyHits = targets.any.filter(has);
  if (targets.any.length > 0 && anyHits.length === 0) return null;

  // Order hits like the catalog so labels read the same way every run.
  const sortIds = (ids: string[]): string[] => [...ids].sort((a, b) => rankOf(a) - rankOf(b));

  if (targets.all.length >= 2) {
    const combo = sortIds(targets.all).map(name).join(" + ");
    return { sources: [combo], combo, rank: 1000 + Math.min(...targets.all.map(rankOf)) };
  }
  const hits = sortIds(targets.all.length === 1 ? [...targets.all, ...anyHits] : anyHits);
  const unique = [...new Set(hits)];
  return { sources: unique.map(name), rank: rankOf(unique[0]) };
}

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LOCKFILE_NAME = "skills-lock.json";

export interface LockEntry {
  source: string;
  sourceType: string;
  computedHash: string;
}

export interface Lockfile {
  version: 1;
  skills: Record<string, LockEntry>;
}

export function readLockfile(projectDir: string): Lockfile {
  try {
    const parsed = JSON.parse(readFileSync(join(projectDir, LOCKFILE_NAME), "utf-8")) as Partial<Lockfile>;
    if (parsed && typeof parsed === "object" && parsed.skills && typeof parsed.skills === "object") {
      return { version: 1, skills: parsed.skills as Record<string, LockEntry> };
    }
  } catch {
    // Missing or unreadable lockfile: start fresh.
  }
  return { version: 1, skills: {} };
}

export function installedSkillNames(projectDir: string): Set<string> {
  return new Set(Object.keys(readLockfile(projectDir).skills));
}

/**
 * Add or replace one entry. Keys are written sorted so the file diffs cleanly.
 * Entries written by other tools are kept as they are.
 */
export function recordInLockfile(projectDir: string, skillName: string, entry: LockEntry): void {
  const lock = readLockfile(projectDir);
  lock.skills[skillName] = entry;
  const sorted: Record<string, LockEntry> = {};
  for (const key of Object.keys(lock.skills).sort()) sorted[key] = lock.skills[key];
  writeFileSync(
    join(projectDir, LOCKFILE_NAME),
    JSON.stringify({ version: 1, skills: sorted }, null, 2) + "\n",
  );
}

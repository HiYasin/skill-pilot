import { existsSync } from "node:fs";
import { join } from "node:path";

import { CANONICAL_SKILLS_DIR } from "../catalog/agents.ts";
import { verifyDir } from "./files.ts";
import { readLockfile } from "./lockfile.ts";
import type { Registry } from "./manifest.ts";

export interface LocalSkillState {
  /** In skills-lock.json and the files on disk match the registry. */
  installed: Set<string>;
  /** In skills-lock.json and on disk, but the files differ (edited, or a newer version exists). */
  outdated: Set<string>;
}

/**
 * What is really installed in a project. skills-lock.json alone is not
 * enough: people delete `.agents/skills/<name>` without touching the
 * lockfile, so every entry is checked against the files on disk.
 *
 *   lock entry + folder matches the registry  → installed
 *   lock entry + folder differs               → outdated
 *   lock entry + folder missing               → not installed
 *   no lock entry                             → not installed
 */
export function localSkillState(projectDir: string, registry: Registry | null): LocalSkillState {
  const state: LocalSkillState = { installed: new Set(), outdated: new Set() };

  for (const name of Object.keys(readLockfile(projectDir).skills)) {
    const dir = join(projectDir, ...CANONICAL_SKILLS_DIR.split("/"), name);
    if (!existsSync(join(dir, "SKILL.md"))) continue;

    const entry = registry?.skills[name];
    if (!entry) {
      // Not in this registry (another tool's skill): trust the files that are there.
      state.installed.add(name);
    } else if (verifyDir(dir, entry).ok) {
      state.installed.add(name);
    } else {
      state.outdated.add(name);
    }
  }

  return state;
}

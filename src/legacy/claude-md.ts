import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CLAUDE_MD_END, CLAUDE_MD_START } from "../constants.ts";

export interface CleanupResult {
  cleaned: boolean;
  deleted: boolean;
}

/**
 * Older install flows wrote a marker-delimited section into CLAUDE.md. Skills
 * now live in agent skill folders, so remove that section, and delete the
 * file when nothing else is left in it. Only our own markers are touched.
 */
export function cleanupClaudeMd(projectDir: string): CleanupResult {
  const path = join(projectDir, "CLAUDE.md");
  if (!existsSync(path)) return { cleaned: false, deleted: false };

  const text = readFileSync(path, "utf-8");
  const start = text.indexOf(CLAUDE_MD_START);
  const end = text.indexOf(CLAUDE_MD_END);
  if (start === -1 || end === -1 || end < start) return { cleaned: false, deleted: false };

  const remaining = (text.slice(0, start) + text.slice(end + CLAUDE_MD_END.length))
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (remaining === "" || remaining === "# CLAUDE.md") {
    unlinkSync(path);
    return { cleaned: true, deleted: true };
  }
  writeFileSync(path, remaining + "\n");
  return { cleaned: true, deleted: false };
}

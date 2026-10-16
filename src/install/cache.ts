import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CLI_NAME, env } from "../constants.ts";
import { removePath } from "./files.ts";

/**
 * `<CLI>_CACHE_DIR`, else the platform cache folder:
 * $XDG_CACHE_HOME or ~/.cache on Linux/macOS, %LOCALAPPDATA% on Windows.
 */
export function cacheDir(): string {
  const override = env("CACHE_DIR");
  if (override) return override;
  const base =
    process.platform === "win32"
      ? (process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"))
      : (process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"));
  return join(base, CLI_NAME, "skills-registry");
}

/** Cached copies are keyed by bundle hash, so a changed skill never reuses stale files. */
export function cachedSkillDir(bundleHash: string): string {
  return join(cacheDir(), bundleHash);
}

export function clearCache(): { dir: string; removed: boolean } {
  const dir = cacheDir();
  const removed = existsSync(dir);
  removePath(dir);
  return { dir, removed };
}

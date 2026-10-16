import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { sha256File } from "./hash.ts";
import type { RegistryEntry } from "./manifest.ts";

export interface Verdict {
  ok: boolean;
  reason?: string;
}

/** Check that every file the manifest lists exists in `dir` with the recorded hash. */
export function verifyDir(dir: string, entry: RegistryEntry): Verdict {
  if (!existsSync(dir)) return { ok: false, reason: "folder missing" };
  for (const rel of entry.files) {
    const abs = join(dir, ...rel.split("/"));
    if (!existsSync(abs)) return { ok: false, reason: `missing ${rel}` };
    const expected = entry.sha256[rel];
    if (!expected) return { ok: false, reason: `no recorded hash for ${rel}` };
    if (sha256File(abs) !== expected) return { ok: false, reason: `hash mismatch for ${rel}` };
  }
  return { ok: true };
}

/** Copy only the files the manifest lists, so stray files never travel along. */
export function copyListedFiles(srcDir: string, destDir: string, files: string[]): void {
  for (const rel of files) {
    const parts = rel.split("/");
    const dest = join(destDir, ...parts);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(srcDir, ...parts), dest);
  }
}

export function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

export function removePath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export type LinkMode = "symlink" | "copy";

/**
 * Point `linkPath` at `target` with a relative directory symlink so the
 * project stays portable. Falls back to a plain copy where symlinks are not
 * allowed (Windows without Developer Mode, some network drives).
 */
export function linkOrCopy(target: string, linkPath: string, forceCopy = false): LinkMode {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (pathExists(linkPath)) removePath(linkPath);
  if (!forceCopy) {
    try {
      const rel = relative(dirname(linkPath), target);
      symlinkSync(rel, linkPath, process.platform === "win32" ? "junction" : "dir");
      return "symlink";
    } catch {
      // fall through to copy
    }
  }
  copyDir(target, linkPath);
  return "copy";
}

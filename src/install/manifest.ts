import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SkillTargets } from "../catalog/types.ts";
import { PACKAGE_ROOT } from "../constants.ts";

export type ReviewStatus = "approved" | "flagged" | "rejected";

export interface Review {
  status: ReviewStatus;
  flags: string[];
  summary: string;
  model: string;
  promptVersion: string;
  reviewedAt: string;
}

export interface RegistryEntry {
  /** "owner/repo" the files came from. */
  source: string;
  /** Full catalog path, "owner/repo/skill-name". */
  skillPath: string;
  /** Upstream commit the files were taken from ("local" for first-party skills). */
  commitSha: string;
  /** SPDX licence id when known. */
  license: string | null;
  /** Relative paths, forward slashes. */
  files: string[];
  sha256: Record<string, string>;
  bundleHash: string;
  review: Review;
  /** When the CLI offers this skill (from `stack-any` / `stack-all`). Missing = never offered. */
  targets?: SkillTargets;
}

export interface Registry {
  version: 1;
  generatedAt: string;
  skills: Record<string, RegistryEntry>;
}

export const REGISTRY_DIR = join(PACKAGE_ROOT, "registry");
export const REGISTRY_SKILLS_DIR = join(REGISTRY_DIR, "skills");
export const MANIFEST_PATH = join(REGISTRY_DIR, "index.json");

let cached: Registry | null | undefined;
let cachedPath: string | undefined;

export function loadRegistry(path: string = MANIFEST_PATH): Registry | null {
  if (cached !== undefined && cachedPath === path) return cached;
  try {
    cached = JSON.parse(readFileSync(path, "utf-8")) as Registry;
  } catch {
    cached = null;
  }
  cachedPath = path;
  return cached;
}

/** Test hook: forget the cached manifest. */
export function resetRegistryCache(): void {
  cached = undefined;
  cachedPath = undefined;
}

/** True when a skill's review asks the user to double-check it. */
export function hasSecurityWarning(entry: RegistryEntry | undefined): boolean {
  return entry?.review.status === "flagged";
}

/**
 * Reject manifest paths that could escape the skill folder or that we never
 * want to write (archives). The manifest is trusted, but this costs nothing.
 */
export function unsafeRelPath(rel: string): string | null {
  const norm = rel.split("\\").join("/");
  if (norm.startsWith("/") || /^[a-zA-Z]:/.test(norm)) return "absolute path";
  if (norm.split("/").some((part) => part === ".." || part === "")) return "path traversal";
  if (norm.toLowerCase().endsWith(".zip")) return "archives are not allowed";
  return null;
}

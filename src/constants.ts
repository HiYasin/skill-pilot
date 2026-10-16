import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { META } from "./meta.ts";

// Project metadata comes from src/meta.ts — change it there, not here.
export const PACKAGE_NAME: string = META.packageName;
export const CLI_NAME: string = META.cliName;
export const GITHUB_REPO: string = META.githubRepo;
export const ENV_PREFIX: string = META.envPrefix;
export const ISSUES_URL = `https://github.com/${GITHUB_REPO}/issues`;
export const HOMEPAGE_URL = `https://github.com/${GITHUB_REPO}`;

/** Markers used for the legacy CLAUDE.md section cleanup. */
export const CLAUDE_MD_START = `<!-- ${CLI_NAME}:start -->`;
export const CLAUDE_MD_END = `<!-- ${CLI_NAME}:end -->`;

/** Folder that holds `src/` or `dist/` — the package root, both in dev and when installed. */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Full environment variable name: envName("CACHE_DIR") → "<ENV_PREFIX>_CACHE_DIR". */
export function envName(name: string): string {
  return `${ENV_PREFIX}_${name}`;
}

export function env(name: string): string | undefined {
  const value = process.env[envName(name)];
  return value && value.length > 0 ? value : undefined;
}

let cachedVersion: string | undefined;

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8")) as {
      version?: string;
    };
    cachedVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion;
}

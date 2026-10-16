import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { listDir, readText, shouldDescend } from "./fs-utils.ts";
import type { Json } from "./manifests.ts";

/** `packages:` entries from pnpm-workspace.yaml (a tiny YAML subset is enough). */
export function parsePnpmWorkspace(yaml: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (line.startsWith("- ")) {
      const value = line.slice(2).trim().replace(/^['"]|['"]$/g, "");
      if (!value.startsWith("!")) patterns.push(value);
    } else if (line !== "" && !line.startsWith("#")) {
      break;
    }
  }
  return patterns;
}

function isWorkspaceFolder(dir: string): boolean {
  return ["package.json", "deno.json", "deno.jsonc"].some((f) => existsSync(join(dir, f)));
}

/**
 * Expand patterns like "apps/*", "packages/**" or "tools/cli" into existing
 * folders that contain a package.json or deno.json.
 */
export function expandPatterns(projectDir: string, patterns: string[]): string[] {
  const found = new Set<string>();
  for (const pattern of patterns) {
    const clean = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
    const star = clean.indexOf("*");
    if (star === -1) {
      const dir = join(projectDir, clean);
      if (isWorkspaceFolder(dir)) found.add(dir);
      continue;
    }
    const base = join(projectDir, clean.slice(0, star).replace(/\/$/, ""));
    const recursive = clean.includes("**");
    const visit = (dir: string, depth: number): void => {
      for (const entry of listDir(dir)) {
        if (!shouldDescend(entry)) continue;
        const child = join(dir, entry.name);
        if (isWorkspaceFolder(child)) found.add(child);
        if (recursive && depth < 3) visit(child, depth + 1);
      }
    };
    visit(base, 0);
  }
  const root = resolve(projectDir);
  return [...found].filter((d) => resolve(d) !== root);
}

/** Workspace folders from pnpm, npm/yarn/bun `workspaces`, or a Deno `workspace` array. */
export function resolveWorkspaces(projectDir: string, pkg: Json | null, deno: Json | null): string[] {
  const pnpm = readText(join(projectDir, "pnpm-workspace.yaml"));
  if (pnpm !== null) {
    const patterns = parsePnpmWorkspace(pnpm);
    if (patterns.length > 0) return expandPatterns(projectDir, patterns);
  }

  const ws = pkg?.workspaces;
  const npmPatterns = Array.isArray(ws)
    ? ws
    : ws && typeof ws === "object" && Array.isArray((ws as Json).packages)
      ? ((ws as Json).packages as unknown[])
      : null;
  if (npmPatterns && npmPatterns.length > 0) {
    return expandPatterns(projectDir, npmPatterns.filter((p): p is string => typeof p === "string"));
  }

  const denoMembers = deno?.workspace;
  if (Array.isArray(denoMembers) && denoMembers.length > 0) {
    return expandPatterns(projectDir, denoMembers.filter((p): p is string => typeof p === "string"));
  }

  return [];
}

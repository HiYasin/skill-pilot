import { existsSync } from "node:fs";
import { join } from "node:path";

import { FRONTEND_PACKAGES, WEB_FRONTEND_EXTENSIONS } from "../catalog/frontend.ts";
import { TECHNOLOGIES } from "../catalog/technologies.ts";
import type { ContentRule, Technology } from "../catalog/types.ts";
import { anyFile, hasFileWithExtension, readText } from "./fs-utils.ts";
import { dotNetCandidates, gradleCandidates } from "./layouts.ts";
import { denoImportNames, gemNames, packageNames, readDenoJson, readPackageJson, type Json } from "./manifests.ts";
import { resolveWorkspaces } from "./workspaces.ts";

export interface DetectResult {
  detected: Technology[];
  isFrontend: boolean;
  /** Workspace folders that were scanned in addition to the root. */
  workspaces: string[];
}

export interface Catalog {
  technologies: Technology[];
}

const DEFAULT_CATALOG: Catalog = { technologies: TECHNOLOGIES };

interface DirResult {
  detected: Technology[];
  frontendByPackages: boolean;
  frontendByFiles: boolean;
}

interface DirOptions {
  pkg?: Json | null;
  deno?: Json | null;
  skipFrontendFileScan?: boolean;
}

/** Return true for a web-frontend file name, including Laravel `*.blade.php`. */
function isWebFrontendFile(name: string): boolean {
  if (name.endsWith(".blade.php")) return true;
  const dot = name.lastIndexOf(".");
  return dot !== -1 && WEB_FRONTEND_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/** Run every detector against one folder. Detectors run cheapest-first and stop at the first hit. */
export function detectInDir(dir: string, technologies: Technology[], opts: DirOptions = {}): DirResult {
  const pkg = opts.pkg !== undefined ? opts.pkg : readPackageJson(dir);
  const deno = opts.deno !== undefined ? opts.deno : readDenoJson(dir);
  const deps = new Set([...packageNames(pkg), ...denoImportNames(deno)]);
  const depList = [...deps];

  // Per-run caches: a hundred technologies often ask about the same few files.
  const exists = new Map<string, boolean>();
  const contents = new Map<string, string | null>();
  const extensionScans = new Map<string, boolean>();
  let gems: string[] | undefined;

  const fileExists = (path: string): boolean => {
    let hit = exists.get(path);
    if (hit === undefined) {
      hit = existsSync(path);
      exists.set(path, hit);
    }
    return hit;
  };
  const fileText = (path: string): string | null => {
    if (!contents.has(path)) contents.set(path, readText(path));
    return contents.get(path) ?? null;
  };
  const contentMatches = (rule: ContentRule): boolean => {
    const paths = rule.scanGradleLayout
      ? gradleCandidates(dir)
      : rule.scanDotNetLayout
        ? dotNetCandidates(dir)
        : (rule.files ?? []).map((f) => join(dir, f));
    return paths.some((p) => {
      const text = fileText(p);
      return text !== null && rule.patterns.some((pattern) => text.includes(pattern));
    });
  };

  const detected: Technology[] = [];
  for (const tech of technologies) {
    const rules = tech.detect;
    let found = false;

    if (rules.packages) found = rules.packages.some((p) => deps.has(p));
    if (!found && rules.packagePatterns) {
      found = rules.packagePatterns.some((re) => depList.some((p) => re.test(p)));
    }
    if (!found && rules.configFiles) found = rules.configFiles.some((f) => fileExists(join(dir, f)));
    if (!found && rules.fileExtensions) {
      const key = rules.fileExtensions.join("|");
      if (!extensionScans.has(key)) extensionScans.set(key, hasFileWithExtension(dir, rules.fileExtensions));
      found = extensionScans.get(key) === true;
    }
    if (!found && rules.gems) {
      gems ??= gemNames(dir);
      found = rules.gems.some((g) => gems!.includes(g));
    }
    if (!found && rules.configFileContent) {
      const list = Array.isArray(rules.configFileContent) ? rules.configFileContent : [rules.configFileContent];
      found = list.some(contentMatches);
    }

    if (found) detected.push(tech);
  }

  const frontendByPackages = depList.some((p) => FRONTEND_PACKAGES.has(p));
  const frontendByFiles =
    frontendByPackages || opts.skipFrontendFileScan ? false : anyFile(dir, isWebFrontendFile, 3);

  return { detected, frontendByPackages, frontendByFiles };
}

/**
 * Scan the project root and every workspace package. A technology found in
 * several places is reported once, in catalog order.
 */
export function detectProject(projectDir: string, catalog: Catalog = DEFAULT_CATALOG): DetectResult {
  const pkg = readPackageJson(projectDir);
  const deno = readDenoJson(projectDir);

  const root = detectInDir(projectDir, catalog.technologies, { pkg, deno });
  const found = new Set(root.detected.map((t) => t.id));
  let isFrontend = root.frontendByPackages || root.frontendByFiles;

  const workspaces = resolveWorkspaces(projectDir, pkg, deno);
  for (const dir of workspaces) {
    const ws = detectInDir(dir, catalog.technologies, { skipFrontendFileScan: isFrontend });
    for (const tech of ws.detected) found.add(tech.id);
    if (ws.frontendByPackages || ws.frontendByFiles) isFrontend = true;
  }

  const detected = catalog.technologies.filter((t) => found.has(t.id));
  return { detected, isFrontend, workspaces };
}

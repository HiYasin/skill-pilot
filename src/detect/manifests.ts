import { join } from "node:path";

import { parseJsonc, readText } from "./fs-utils.ts";

export type Json = Record<string, unknown>;

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function readPackageJson(dir: string): Json | null {
  const text = readText(join(dir, "package.json"));
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Json) : null;
  } catch {
    return null;
  }
}

export function readDenoJson(dir: string): Json | null {
  for (const name of ["deno.json", "deno.jsonc"]) {
    const text = readText(join(dir, name));
    if (text === null) continue;
    try {
      const parsed = parseJsonc(text);
      if (parsed && typeof parsed === "object") return parsed as Json;
    } catch {
      // A broken deno.json should not stop the scan.
    }
  }
  return null;
}

/** All package names declared in any dependency field of package.json. */
export function packageNames(pkg: Json | null): string[] {
  if (!pkg) return [];
  const names = new Set<string>();
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (deps && typeof deps === "object") {
      for (const name of Object.keys(deps as Json)) names.add(name);
    }
  }
  return [...names];
}

/**
 * Package names from a deno.json import map. Handles bare keys and
 * `npm:` / `jsr:` specifiers: "npm:react@19" → "react", "jsr:@std/path@1" → "@std/path".
 */
export function denoImportNames(deno: Json | null): string[] {
  if (!deno) return [];
  const imports = deno.imports;
  if (!imports || typeof imports !== "object") return [];

  const names = new Set<string>();
  for (const [key, value] of Object.entries(imports as Json)) {
    names.add(key.replace(/\/$/, ""));
    if (typeof value === "string") {
      const match = /^(?:npm|jsr):(@?[^@/]+(?:\/[^@/]+)?)/.exec(value);
      if (match) names.add(match[1]);
    }
  }
  return [...names];
}

/** Gem names from `gem 'name'` lines in a Gemfile. */
export function gemNames(dir: string): string[] {
  const text = readText(join(dir, "Gemfile"));
  if (text === null) return [];
  const gems: string[] = [];
  const re = /^\s*gem\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) gems.push(match[1]);
  return gems;
}

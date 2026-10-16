import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";

/** Folders that never contain source worth scanning. */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "vendor",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".turbo",
  ".cache",
  ".terraform",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  "bin",
  "obj",
  ".vs",
  ".idea",
  "Pods",
  ".gradle",
]);

export function listDir(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function shouldDescend(entry: Dirent): boolean {
  return entry.isDirectory() && !entry.name.startsWith(".") && !SKIP_DIRS.has(entry.name);
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Walk `dir` breadth-first up to `maxDepth` folders down and return true as
 * soon as `match` accepts a file name.
 */
export function anyFile(dir: string, match: (name: string) => boolean, maxDepth: number): boolean {
  let level: string[] = [dir];
  for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
    const next: string[] = [];
    for (const current of level) {
      for (const entry of listDir(current)) {
        if (entry.isFile() && match(entry.name)) return true;
        if (depth < maxDepth && shouldDescend(entry)) next.push(join(current, entry.name));
      }
    }
    level = next;
  }
  return false;
}

export function hasFileWithExtension(dir: string, extensions: string[], maxDepth = 4): boolean {
  const wanted = extensions.map((e) => (e.startsWith(".") ? e : `.${e}`).toLowerCase());
  return anyFile(dir, (name) => {
    const lower = name.toLowerCase();
    return wanted.some((ext) => lower.endsWith(ext));
  }, maxDepth);
}

/** Remove comments and trailing commas so JSONC (deno.jsonc, tsconfig) parses as JSON. */
export function parseJsonc(text: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

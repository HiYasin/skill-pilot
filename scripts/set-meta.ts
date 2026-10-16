#!/usr/bin/env node
// Change the project metadata in one go: src/meta.ts, package.json,
// package-lock.json, registry/index.json (first-party entries), workflows,
// README and docs.
//
// Usage:
//   npm run set-meta -- --name <npm-name> --repo <owner/repo> [--env-prefix NAME] [--wordmark TEXT]
//                       [--tagline TEXT] [--author "Name"] [--dry-run]
//
// See docs/METADATA.md.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { PACKAGE_ROOT } from "../src/constants.ts";
import { color, isMain } from "./lib/shared.ts";

export interface MetaValues {
  packageName: string;
  cliName: string;
  wordmark: string;
  tagline: string;
  githubRepo: string;
  envPrefix: string;
}

export interface SetMetaOptions {
  name?: string;
  repo?: string;
  envPrefix?: string;
  wordmark?: string;
  tagline?: string;
  author?: string;
}

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const GITHUB_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const ENV_PREFIX = /^[A-Z][A-Z0-9_]*$/;
const WORDMARK = /^[A-Za-z0-9 ._-]{1,24}$/;

/** Files whose prose mentions the name. docs/METADATA.md is left alone: it documents the defaults. */
function proseFiles(root: string): string[] {
  const files = ["README.md", "ARCHITECTURE.md", "CHANGELOG.md"].map((f) => join(root, f));
  const docs = join(root, "docs");
  if (existsSync(docs)) {
    for (const f of readdirSync(docs)) {
      if (f.endsWith(".md") && f !== "METADATA.md") files.push(join(docs, f));
    }
  }
  return files.filter((f) => existsSync(f));
}

export function readMeta(root: string): MetaValues {
  const text = readFileSync(join(root, "src", "meta.ts"), "utf-8");
  const field = (key: string): string => {
    const match = new RegExp(`\\b${key}:\\s*"([^"]*)"`).exec(text);
    if (!match) throw new Error(`could not find ${key} in src/meta.ts`);
    return match[1];
  };
  return {
    packageName: field("packageName"),
    cliName: field("cliName"),
    wordmark: field("wordmark"),
    tagline: field("tagline"),
    githubRepo: field("githubRepo"),
    envPrefix: field("envPrefix"),
  };
}

/** Work out the new values from the options, keeping anything not asked to change. */
export function nextMeta(old: MetaValues, opts: SetMetaOptions): MetaValues {
  const packageName = opts.name ?? old.packageName;
  const cliName = packageName.replace(/^@[^/]+\//, "");
  const derivedPrefix = cliName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    packageName,
    cliName,
    // Keep a custom wordmark; follow the name when the wordmark was just the old name.
    wordmark: opts.wordmark ?? (old.wordmark === old.cliName ? cliName : old.wordmark),
    tagline: opts.tagline ?? old.tagline,
    githubRepo: opts.repo ?? old.githubRepo,
    envPrefix: opts.envPrefix ?? (opts.name ? derivedPrefix : old.envPrefix),
  };
}

export function validateMeta(m: MetaValues): string[] {
  const problems: string[] = [];
  if (!NPM_NAME.test(m.packageName) || m.packageName.length > 214) problems.push(`"${m.packageName}" is not a valid npm package name (lowercase, no spaces)`);
  if (!GITHUB_REPO.test(m.githubRepo)) problems.push(`"${m.githubRepo}" is not in owner/repo form`);
  if (!ENV_PREFIX.test(m.envPrefix)) problems.push(`"${m.envPrefix}" is not a valid env prefix (A-Z, 0-9, _)`);
  if (!WORDMARK.test(m.wordmark)) problems.push(`wordmark "${m.wordmark}" may only use letters, digits, space, . _ - (max 24)`);
  if (m.tagline.includes('"')) problems.push("tagline cannot contain double quotes");
  return problems;
}

function replaceAll(text: string, pairs: [string, string][]): string {
  let out = text;
  for (const [from, to] of pairs) if (from && from !== to) out = out.split(from).join(to);
  return out;
}

export interface Change {
  file: string;
  before: string;
  after: string;
}

/** Compute every file change. Nothing is written here. */
export function planMetaChange(root: string, old: MetaValues, next: MetaValues, author?: string): Change[] {
  const changes: Change[] = [];
  const edit = (file: string, transform: (text: string) => string): void => {
    // Report paths with forward slashes on every OS (Windows `join` gives backslashes).
    const key = file.split(/[\\/]+/).join("/");
    const path = join(root, ...key.split("/"));
    if (!existsSync(path)) return;
    const before = readFileSync(path, "utf-8");
    const after = transform(before);
    if (after !== before) changes.push({ file: key, before, after });
  };

  // 1. src/meta.ts — the single source of truth.
  edit("src/meta.ts", (text) => {
    let out = text;
    for (const key of ["packageName", "cliName", "wordmark", "tagline", "githubRepo", "envPrefix"] as const) {
      out = out.replace(new RegExp(`(\\b${key}:\\s*)"[^"]*"`), `$1"${next[key]}"`);
    }
    return out;
  });

  // 2. package.json.
  edit("package.json", (text) => {
    const pkg = JSON.parse(text) as Record<string, unknown>;
    pkg.name = next.packageName;
    pkg.bin = { [next.cliName]: "bin.mjs" };
    pkg.homepage = `https://github.com/${next.githubRepo}#readme`;
    pkg.repository = { type: "git", url: `git+https://github.com/${next.githubRepo}.git` };
    pkg.bugs = { url: `https://github.com/${next.githubRepo}/issues` };
    if (author) pkg.author = author;
    return JSON.stringify(pkg, null, 2) + "\n";
  });

  // 3. package-lock.json (so `npm ci` keeps working before the next install).
  edit("package-lock.json", (text) => {
    const lock = JSON.parse(text) as { name?: string; packages?: Record<string, Record<string, unknown>> };
    lock.name = next.packageName;
    const self = lock.packages?.[""];
    if (self) {
      self.name = next.packageName;
      if (self.bin) self.bin = { [next.cliName]: "bin.mjs" };
    }
    return JSON.stringify(lock, null, 2) + "\n";
  });

  // 4. registry/index.json — only first-party entries point at our repo. Hashes are untouched.
  edit("registry/index.json", (text) => {
    const registry = JSON.parse(text) as { skills: Record<string, { source: string; skillPath: string }> };
    for (const [name, entry] of Object.entries(registry.skills)) {
      if (entry.source === old.githubRepo) {
        entry.source = next.githubRepo;
        entry.skillPath = `${next.githubRepo}/${name}`;
      }
    }
    return JSON.stringify(registry, null, 2) + "\n";
  });

  // 5. Workflows use the env prefix.
  const workflowsDir = join(root, ".github", "workflows");
  if (existsSync(workflowsDir)) {
    for (const f of readdirSync(workflowsDir)) {
      edit(`.github/workflows/${f}`, (text) => replaceAll(text, [[`${old.envPrefix}_`, `${next.envPrefix}_`]]));
    }
  }

  // 6. Prose. Most specific first: a scoped package name can contain the repo,
  //    and the repo contains the command name.
  for (const abs of proseFiles(root)) {
    edit(relative(root, abs), (text) => {
      let out = replaceAll(text, [
        [`npx ${old.packageName}`, `npx ${next.packageName}`],
        [`\`${old.packageName}\``, `\`${next.packageName}\``],
        [old.githubRepo, next.githubRepo],
        [`${old.envPrefix}_`, `${next.envPrefix}_`],
        [`"${old.envPrefix}"`, `"${next.envPrefix}"`],
        [`${old.cliName}-0.`, `${next.cliName}-0.`],
      ]);
      // The bare command name, only as a whole word (not inside other words or paths).
      if (old.cliName !== next.cliName) {
        const word = old.cliName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`(^|[\\s\`"'(/])${word}(?=$|[\\s\`"'),.:;/])`, "gm"), `$1${next.cliName}`);
      }
      return out;
    });
  }

  // 7. LICENSE holder, only when an author is given.
  if (author) {
    edit("LICENSE", (text) => text.replace(/^Copyright \(c\) (\d{4}).*$/m, `Copyright (c) $1 ${author}`));
  }

  return changes;
}

function parseOptions(argv: string[]): SetMetaOptions & { dryRun: boolean; help: boolean } {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    name: value("--name"),
    repo: value("--repo"),
    envPrefix: value("--env-prefix"),
    wordmark: value("--wordmark"),
    tagline: value("--tagline"),
    author: value("--author"),
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("-h") || argv.includes("--help"),
  };
}

/** Ask the npm registry directly: 404 means the name is free. */
async function npmNameStatus(name: string): Promise<string> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return color.green("free on npm");
    if (res.ok) return color.yellow("taken on npm — publishing will fail unless you own it");
    return color.dim(`could not check (HTTP ${res.status})`);
  } catch {
    return color.dim("could not check (offline?)");
  }
}

export async function runSetMeta(argv: string[], root = PACKAGE_ROOT): Promise<number> {
  const opts = parseOptions(argv);
  if (opts.help || (!opts.name && !opts.repo && !opts.envPrefix && !opts.wordmark && !opts.tagline && !opts.author)) {
    console.log(`
  Usage: npm run set-meta -- --name <npm-name> --repo <owner/repo> [options]

    --name <npm-name>     npm package name, e.g. stackskills or @acme/skills
    --repo <owner/repo>   public GitHub repo that will host the registry
    --env-prefix <NAME>   env var prefix (default: from the name, e.g. STACKSKILLS)
    --wordmark <text>     big banner text (default: the command name)
    --tagline <text>      line under the banner
    --author "<name>"     package.json author and LICENSE holder
    --dry-run             show what would change
`);
    return opts.help ? 0 : 1;
  }

  const old = readMeta(root);
  const next = nextMeta(old, opts);
  const problems = validateMeta(next);
  if (problems.length > 0) {
    for (const p of problems) console.error(color.red(`  ✘ ${p}`));
    return 1;
  }

  console.log(color.bold("\n  Project metadata\n"));
  for (const key of Object.keys(next) as (keyof MetaValues)[]) {
    const changed = old[key] !== next[key];
    console.log(`  ${key.padEnd(12)} ${changed ? `${color.dim(old[key])} → ${color.cyan(next[key])}` : color.dim(next[key])}`);
  }
  if (next.packageName !== old.packageName) console.log(`\n  ${next.packageName}: ${await npmNameStatus(next.packageName)}`);

  const changes = planMetaChange(root, old, next, opts.author);
  console.log(color.bold(`\n  ${changes.length} file(s) ${opts.dryRun ? "would change" : "changed"}:`));
  for (const c of changes) console.log(`    ${c.file}`);

  if (opts.dryRun) {
    console.log(color.dim("\n  --dry-run: nothing written.\n"));
    return 0;
  }
  for (const c of changes) writeFileSync(join(root, c.file), c.after);

  console.log(`
  ${color.green("✔ Done.")} Next:
    1. npm install && npm test && npm run validate:registry
    2. git remote set-url origin https://github.com/${next.githubRepo}.git   (or create the repo)
    3. Check LICENSE and the author field in package.json
    4. If you have already published under the old name, see docs/METADATA.md → "After publishing"
`);
  return 0;
}

if (isMain(import.meta.url)) {
  runSetMeta(process.argv.slice(2)).then((code) => (process.exitCode = code));
}

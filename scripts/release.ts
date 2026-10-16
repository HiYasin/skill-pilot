#!/usr/bin/env node
// Cut a release: checks → version bump → CHANGELOG → commit → tag → push.
// Pushing the tag triggers .github/workflows/publish.yml, which publishes to npm.
//
// Usage: npm run release -- patch|minor|major [--dry-run]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "../src/constants.ts";
import { color, isMain } from "./lib/shared.ts";

const PKG_PATH = join(PACKAGE_ROOT, "package.json");
const CHANGELOG_PATH = join(PACKAGE_ROOT, "CHANGELOG.md");
const BUMPS = ["patch", "minor", "major"] as const;
type Bump = (typeof BUMPS)[number];

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: PACKAGE_ROOT,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function npm(args: string[]): void {
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export function bumpVersion(version: string, bump: Bump): string {
  const [major, minor, patch] = version.split("-")[0].split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

interface Commit {
  hash: string;
  subject: string;
  body: string;
}

/** Group commits by conventional-commit type. */
export function changelogSection(version: string, commits: Commit[], repoUrl: string, date: string): string {
  const groups: Record<string, string[]> = { "Breaking changes": [], Features: [], Fixes: [], Other: [] };
  for (const c of commits) {
    if (/^chore\(release\)/.test(c.subject)) continue;
    const link = repoUrl ? `([${c.hash.slice(0, 7)}](${repoUrl}/commit/${c.hash}))` : `(${c.hash.slice(0, 7)})`;
    const line = `- ${c.subject.replace(/^\w+(\([^)]*\))?!?:\s*/, "")} ${link}`;
    if (/^\w+(\([^)]*\))?!:/.test(c.subject) || /BREAKING CHANGE/.test(c.body)) groups["Breaking changes"].push(line);
    else if (/^feat(\(|:)/.test(c.subject)) groups.Features.push(line);
    else if (/^fix(\(|:)/.test(c.subject)) groups.Fixes.push(line);
    else groups.Other.push(line);
  }
  let out = `## v${version} (${date})\n\n`;
  for (const [title, lines] of Object.entries(groups)) {
    if (lines.length > 0) out += `### ${title}\n\n${lines.join("\n")}\n\n`;
  }
  if (commits.length === 0) out += "- No changes recorded.\n\n";
  return out;
}

function commitsSince(tag: string | null): Commit[] {
  const range = tag ? [`${tag}..HEAD`] : [];
  const raw = git(["log", ...range, "--format=%H%x1f%s%x1f%b%x1e"]);
  return raw
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, subject, body] = r.split("\x1f");
      return { hash, subject, body: body ?? "" };
    });
}

function lastTag(): string | null {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  } catch {
    return null;
  }
}

function repoUrl(pkg: { repository?: { url?: string } }): string {
  return (pkg.repository?.url ?? "")
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
}

export async function release(argv: string[]): Promise<number> {
  const bump = argv.find((a): a is Bump => (BUMPS as readonly string[]).includes(a));
  const dryRun = argv.includes("--dry-run");
  if (!bump) {
    console.error(color.red("  Usage: npm run release -- patch|minor|major [--dry-run]"));
    return 1;
  }

  if (git(["status", "--porcelain"]) !== "") {
    console.error(color.red("  ✘ Working tree is not clean. Commit or stash first."));
    return 1;
  }
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    console.error(color.red(`  ✘ Releases are cut from main (you are on ${branch}).`));
    return 1;
  }

  console.log(color.bold("\n  Running checks\n"));
  npm(["run", "typecheck"]);
  npm(["test"]);
  npm(["run", "validate:registry"]);

  const pkgText = readFileSync(PKG_PATH, "utf-8");
  const pkg = JSON.parse(pkgText) as { version: string; repository?: { url?: string } };
  const next = bumpVersion(pkg.version, bump);
  const tag = `v${next}`;
  const date = new Date().toISOString().slice(0, 10);
  const section = changelogSection(next, commitsSince(lastTag()), repoUrl(pkg), date);

  console.log(color.bold(`\n  ${pkg.version} → ${next}\n`));
  console.log(section);
  if (dryRun) {
    console.log(color.dim("  --dry-run: nothing changed."));
    return 0;
  }

  const oldChangelog = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, "utf-8") : null;
  let tagged = false;
  let pushedMain = false;
  try {
    writeFileSync(PKG_PATH, pkgText.replace(`"version": "${pkg.version}"`, `"version": "${next}"`));
    const header = "# Changelog\n\n";
    const rest = oldChangelog ? oldChangelog.replace(/^# Changelog\s*/, "") : "";
    writeFileSync(CHANGELOG_PATH, header + section + rest);

    git(["add", "package.json", "CHANGELOG.md"]);
    git(["commit", "-m", `chore(release): ${tag}`]);
    git(["tag", "-a", tag, "-m", tag]);
    tagged = true;
    // Push the commit first, then the tag: the CLI downloads skills from the tag.
    git(["push", "origin", "main"]);
    pushedMain = true;
    git(["push", "origin", tag]);
  } catch (err) {
    console.error(color.red(`\n  ✘ Release failed: ${(err as Error).message}`));
    if (pushedMain) {
      console.error(color.yellow(`  The release commit is on origin/main but the tag is not. Retry with: git push origin ${tag}`));
      return 1;
    }
    console.error(color.yellow("  Rolling back local changes..."));
    try {
      if (tagged) git(["tag", "-d", tag]);
      if (git(["log", "-1", "--format=%s"]) === `chore(release): ${tag}`) git(["reset", "--hard", "HEAD~1"]);
      else {
        writeFileSync(PKG_PATH, pkgText);
        if (oldChangelog === null) git(["clean", "-f", "CHANGELOG.md"]);
        else writeFileSync(CHANGELOG_PATH, oldChangelog);
      }
    } catch (rollbackErr) {
      console.error(color.red(`  Rollback incomplete: ${(rollbackErr as Error).message}`));
    }
    return 1;
  }

  console.log(color.green(`\n  ✔ Pushed ${tag}. GitHub Actions will publish it to npm.\n`));
  return 0;
}

if (isMain(import.meta.url)) {
  release(process.argv.slice(2)).then((code) => (process.exitCode = code));
}

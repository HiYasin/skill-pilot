#!/usr/bin/env node
// Scaffold a new skill in skills-src/ with frontmatter ready to fill in.
//
// Usage:
//   npm run new-skill -- <name> [--any "nextjs, react"] [--all "nestjs, prisma"] [--description "..."]
//   npm run new-skill -- --list        print every technology id you can target
//
// See docs/ADDING-SKILLS.md.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { TECHNOLOGIES } from "../src/catalog/technologies.ts";
import { EVERY_PROJECT, WEB_FRONTEND, checkTargets, parseTargetList } from "../src/targets.ts";
import { invalidSkillName } from "./lib/frontmatter.ts";
import { SKILLS_SRC_DIR, color, isMain } from "./lib/shared.ts";

export interface ScaffoldOptions {
  any?: string;
  all?: string;
  description?: string;
  srcDir?: string;
  technologyIds?: string[];
}

function titleCase(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** The SKILL.md text for a new skill. Placeholders are marked TODO so sync refuses to ship them. */
export function skillTemplate(name: string, opts: ScaffoldOptions = {}): string {
  const any = parseTargetList(opts.any ?? "");
  const all = parseTargetList(opts.all ?? "");
  const description = opts.description?.trim() || "TODO: what this skill does. Use when <the situations an agent should load it in>.";

  const metadata: string[] = [];
  if (any.length > 0) metadata.push(`  stack-any: ${any.join(", ")}`);
  if (all.length > 0) metadata.push(`  stack-all: ${all.join(", ")}`);
  if (metadata.length === 0) {
    metadata.push(
      `  stack-any: ""     # TODO: technology ids, e.g. nextjs, react (npm run new-skill -- --list)`,
      `  # stack-all: ""   # or: offer only when ALL are detected, e.g. nestjs, prisma`,
    );
  }

  return `---
name: ${name}
description: ${description.includes(":") || description.includes("#") ? JSON.stringify(description) : description}
metadata:
${metadata.join("\n")}
---

# ${titleCase(name)}

<!-- Short, specific rules an agent can follow. Keep this file under ~150 lines and
     put long material in references/<topic>.md, linked from here. -->

## When to use
- TODO

## Rules
- TODO

## Examples
- TODO
`;
}

/** Create skills-src/<name>/SKILL.md. Returns the path, or throws with a readable message. */
export function scaffoldSkill(name: string, opts: ScaffoldOptions = {}): string {
  const srcDir = opts.srcDir ?? SKILLS_SRC_DIR;
  const nameProblem = invalidSkillName(name);
  if (nameProblem) throw new Error(`"${name}": ${nameProblem}`);

  const any = parseTargetList(opts.any ?? "");
  const all = parseTargetList(opts.all ?? "");
  if (any.length > 0 || all.length > 0) {
    const problems = checkTargets({ any, all }, opts.technologyIds ?? TECHNOLOGIES.map((t) => t.id));
    if (problems.length > 0) throw new Error(problems.join("\n"));
  }

  const dir = join(srcDir, name);
  if (existsSync(dir)) throw new Error(`skills-src/${name} already exists`);
  mkdirSync(join(dir, "references"), { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, skillTemplate(name, opts));
  return file;
}

function printTechnologyIds(): void {
  console.log(color.bold("\n  Technology ids for stack-any / stack-all\n"));
  const width = Math.max(...TECHNOLOGIES.map((t) => t.id.length)) + 2;
  for (const t of TECHNOLOGIES) console.log(`  ${t.id.padEnd(width)}${color.dim(t.name)}`);
  console.log(`  ${WEB_FRONTEND.padEnd(width)}${color.dim("every web frontend")}`);
  console.log(`  ${`"${EVERY_PROJECT}"`.padEnd(width)}${color.dim("every project (stack-any only)")}`);
  console.log(color.dim("\n  Missing one? Add a detection rule to src/catalog/technologies.ts.\n"));
}

function main(argv: string[]): number {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  if (argv.includes("--list")) {
    printTechnologyIds();
    return 0;
  }
  const name = argv.find((a, i) => !a.startsWith("-") && !["--any", "--all", "--description"].includes(argv[i - 1] ?? ""));
  if (!name || argv.includes("-h") || argv.includes("--help")) {
    console.log(`
  Usage: npm run new-skill -- <name> [--any "nextjs, react"] [--all "nestjs, prisma"] [--description "..."]
         npm run new-skill -- --list
`);
    return name ? 0 : 1;
  }

  try {
    const file = scaffoldSkill(name, { any: value("--any"), all: value("--all"), description: value("--description") });
    console.log(`
  ${color.green("✔")} Created ${file.replace(process.cwd() + "/", "")}

  Next:
    1. Write the skill and fill in every TODO (description and stack-any / stack-all).
    2. npm run sync:skills -- --only ${name}
    3. npm run validate:registry
    4. Try it: node bin.mjs --dry-run   (inside a project that uses the stack)
`);
    if (!value("--any") && !value("--all")) printTechnologyIds();
    return 0;
  } catch (err) {
    console.error(color.red(`  ✘ ${(err as Error).message.split("\n").join("\n  ✘ ")}`));
    return 1;
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

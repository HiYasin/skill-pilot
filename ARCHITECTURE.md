# Architecture

This is the complete technical map of **skill-pilot**: what it does, how every part works, where each piece of logic lives, the data formats, and the rules to keep when changing it. It is written so a person or a coding agent can read it once and make correct changes without reading every file first.

> **Keep this file current.** When you change behaviour, a file layout, a data format or an invariant described here, update the matching section in the same commit.

---

## Contents

1. [What the tool does](#1-what-the-tool-does)
2. [The two halves](#2-the-two-halves)
3. [Repository layout](#3-repository-layout)
4. [Glossary](#4-glossary)
5. [Runtime: what happens on `npx skill-pilot`](#5-runtime-what-happens-on-npx-skill-pilot)
6. [Data formats](#6-data-formats)
7. [Security model](#7-security-model)
8. [Maintainer pipeline (scripts/)](#8-maintainer-pipeline-scripts)
9. [Project metadata (src/meta.ts)](#9-project-metadata-srcmetats)
10. [Configuration and environment variables](#10-configuration-and-environment-variables)
11. [Build, packaging and distribution](#11-build-packaging-and-distribution)
12. [CI/CD workflows](#12-cicd-workflows)
13. [Tests](#13-tests)
14. [Invariants: rules to keep when changing code](#14-invariants-rules-to-keep-when-changing-code)
15. [Change recipes](#15-change-recipes)
16. [Known limitations and future work](#16-known-limitations-and-future-work)
17. [Related documents](#17-related-documents)

---

## 1. What the tool does

`skill-pilot` is a zero-dependency Node.js CLI. Run inside any project, it:

1. **Detects** the project's technologies (Next.js, NestJS, Prisma, Docker, … 59 in total) from manifests, config files and file extensions, including every package of a monorepo.
2. **Resolves** which AI agent skills apply. Each skill declares when it is offered (`stack-any` / `stack-all`), and the CLI matches those declarations against the detected stack.
3. **Lets the user pick** skills in an interactive terminal picker (or takes all with `-y`).
4. **Installs** each skill, a folder with a `SKILL.md` plus any other files:
   - into `.agents/skills/<name>`,
   - after checking every file against a SHA-256 manifest,
   - then links it into each detected coding agent's folder (`.claude/skills`, `.cline/skills`, …),
   - and records it in `skills-lock.json`.

Skills are never fetched from random repos at install time. They come from this project's own **registry**, which maintainers fill with a review-and-hash pipeline.

---

## 2. The two halves

The repo contains two programs that share code and data formats:

```
┌──────────────────────── MAINTAINER SIDE (scripts/, run in this repo) ───────────────────────┐
│                                                                                              │
│  skills-src/<name>/SKILL.md ─┐                                                               │
│   (your skills + stack-*)    │    npm run sync:skills                                        │
│                              ├──► copy files ─► LLM review ─► SHA-256 ─► record targets ──┐  │
│  skills-upstream.json ───────┘    (upstream: download repo tarball at a pinned commit)    │  │
│   (others' skills + stack-*)                                                              ▼  │
│                                                       registry/skills/<name>/   (git only)   │
│                                                       registry/index.json       (git + npm)  │
│                                                                                              │
│  npm run validate:registry   npm run new-skill   npm run set-meta   npm run release          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                │ git tag vX.Y.Z  +  npm publish (index.json only)
                                ▼
┌──────────────────────── RUNTIME SIDE (src/, runs on users' machines) ───────────────────────┐
│                                                                                              │
│  npx skill-pilot                                                                             │
│   bin.mjs ─► cli.ts ─► main.ts                                                               │
│     detect stack ─► load registry/index.json ─► match stack-any/stack-all ─► pick            │
│     ─► for each skill: verified copy from local registry │ cache │ download from git tag     │
│     ─► .agents/skills/<name> ─► symlink into agent folders ─► skills-lock.json               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **The runtime** only ever trusts `registry/index.json`. It ships inside the npm package.
- **The skill files** are not in the npm package. They are downloaded from the git tag whose name matches the CLI version (`v<version>`), and verified byte by byte.

---

## 3. Repository layout

```
bin.mjs                     npm "bin" entry: Node ≥ 22.6 guard → dist/cli.js, or src/cli.ts via type stripping in a checkout
package.json                name/bin/scripts; "files" = bin.mjs, dist/, registry/index.json
tsconfig.json               typecheck config (noEmit) for src/, scripts/, test/
tsconfig.build.json         emits src/ → dist/
ARCHITECTURE.md             this file
README.md                   user + maintainer quick start
CHANGELOG.md                written by scripts/release.ts
LICENSE                     MIT (holder set by set-meta --author)
.env.example                maintainer secrets for sync (ANTHROPIC_API_KEY, GITHUB_TOKEN, SKILLS_REVIEW_MODEL)
.npmrc                      save-exact=true

src/                        ── RUNTIME (shipped as dist/) ──
  meta.ts                   META: package name, command name, repo, env prefix, banner text/colours  ← single source of truth
  constants.ts              derived constants (CLI_NAME, GITHUB_REPO, ENV_PREFIX, URLs), env() helper, getVersion(), PACKAGE_ROOT
  cli.ts                    process entry: SIGINT handler, runs main(), sets exit code
  main.ts                   the run flow (help, detect, resolve, pick, install, report)
  args.ts                   argv parser
  colors.ts                 ANSI helpers, log()/write(), colour-depth detection, rgb()
  targets.ts                stack-any / stack-all: parsing, validation with suggestions, matching
  resolve.ts                detected stack + registry targets → ordered skill list; combos; techs with skills
  agents.ts                 agent auto-detection and -a handling
  catalog/
    types.ts                Technology, DetectRules, ContentRule, SkillTargets, Agent
    technologies.ts         detection rules for 59 technologies (NO skill lists)
    agents.ts               AGENTS list + CANONICAL_SKILLS_DIR (".agents/skills")
    frontend.ts             FRONTEND_PACKAGES, WEB_FRONTEND_EXTENSIONS (what counts as "web-frontend")
  detect/
    index.ts                detectInDir() rule engine, detectProject() root + workspaces
    manifests.ts            package.json / deno.json(c) / Gemfile readers
    workspaces.ts           pnpm / npm-yarn-bun / deno workspace resolution
    layouts.ts              Gradle and .NET candidate-file discovery
    fs-utils.ts             SKIP_DIRS, bounded BFS file search, JSONC parser
  install/
    manifest.ts             Registry/RegistryEntry types, loadRegistry(), unsafeRelPath()
    hash.ts                 sha256, sha256File, bundleHash
    files.ts                verifyDir, copyListedFiles, linkOrCopy (symlink → copy fallback)
    cache.ts                cache folder location, clearCache
    download.ts             base URLs, per-file fetch with fallback + hash check, atomic write
    installer.ts            installSkill() and installAll() (bounded concurrency)
    lockfile.ts             skills-lock.json read/write
    status.ts               localSkillState(): installed / outdated from lockfile + disk + hashes
  ui/
    banner.ts               animated gradient wordmark (static/compact fallbacks)
    font.ts                 7-px bitmap font rendered with half blocks
    picker.ts               multi-select (pure reducer + raw-mode terminal loop)
    progress.ts             live spinner rows / line output / verbose trace
    report.ts               detected grid, skill lines, review table, summary
    format.ts               labels, durations, wrapping
  legacy/
    claude-md.ts            removes an old marker section from CLAUDE.md

skills-src/<name>/          YOUR skills (SKILL.md frontmatter has metadata.stack-any / stack-all); "_name" = draft, ignored
skills-upstream.json        OTHER PEOPLE'S skills: { "owner/repo/skill": { "stack-any": "react" } }
registry/
  index.json                manifest: per skill files, sha256, bundleHash, review, targets, source, commit, licence
  skills/<name>/            synced, reviewed copies (served from git; never edit by hand)

scripts/                    ── MAINTAINER TOOLS (not shipped) ──
  sync-skills.ts            skills-src + skills-upstream.json → registry (review, hash, targets)
  validate-registry.ts      consistency + hash checks (CI and prepublishOnly)
  new-skill.ts              scaffold skills-src/<name>/SKILL.md; --list prints technology ids
  set-meta.ts               change name/repo/env prefix/author everywhere
  release.ts                version bump, CHANGELOG, tag, push
  clean.mjs                 deletes dist/ before build
  lib/shared.ts             declaredSkills() discovery + problems, listFiles, isMain, colour helpers
  lib/frontmatter.ts        minimal SKILL.md frontmatter parser, skill-name rules

test/                       node:test suites (no network), helpers.ts fixtures
docs/
  ADDING-SKILLS.md          how to add own/upstream skills and technologies
  METADATA.md               how to change name, repo, author, banner
.github/workflows/          ci.yml, compat.yml, publish.yml, sync.yml
```

---

## 4. Glossary

| Term | Meaning |
| --- | --- |
| **Skill** | A folder with a `SKILL.md` (YAML frontmatter + Markdown instructions for AI coding agents), optionally with `references/`, `scripts/`, `assets/`, etc. Follows the [Agent Skills spec](https://agentskills.io/specification). |
| **Skill name** | The folder name, e.g. `nextjs-app-router`. **Unique across the whole registry**; it becomes `.agents/skills/<name>` in users' projects. |
| **Address / skill path** | `owner/repo/skill-name`. Own skills: `<META.githubRepo>/<name>`. Upstream: the source repo, e.g. `vercel-labs/agent-skills/react-best-practices`. Shown in the UI as `owner › name`. |
| **Own skill** | Written in this repo under `skills-src/<name>/`. Its targets live in its frontmatter (`metadata.stack-any` / `stack-all`). |
| **Upstream skill** | Lives in someone else's GitHub repo and is listed in `skills-upstream.json` with its targets. Sync downloads it at a pinned commit. |
| **Targets** | When a skill is offered: `{ any: string[], all: string[] }`, written as `stack-any` / `stack-all`. See §5.6. |
| **Technology** | An entry in `src/catalog/technologies.ts`: `id`, display `name`, `detect` rules. Detection only; no skill lists. |
| **Special targets** | `web-frontend` (any project with frontend packages or web files) and `*` (every project). |
| **Combo** | A skill with `stack-all` of 2+ ids. Shown under "Detected combos" with a generated name such as "NestJS + Prisma". |
| **Registry** | `registry/`: the reviewed, hashed copies (`skills/`) plus the manifest (`index.json`). |
| **Manifest** | `registry/index.json`. The only registry file in the npm package; the runtime's source of truth. |
| **Bundle hash** | SHA-256 over sorted `"relpath:filehash\n"` lines of a skill. Identifies exact content; used as the cache key and in the lockfile. |
| **Canonical copy** | `.agents/skills/<name>` in the user's project. Agent folders link to it. |
| **Agent** | A coding tool with a skills folder: `claude-code` (`.claude`), `cline`, `junie`, `codebuddy`, `continue`, `kiro-cli`, plus `universal` (canonical copy only). |
| **Lockfile** | `skills-lock.json` in the user's project: what was installed, from where, with which bundle hash. |
| **Local registry** | `registry/skills/` next to the running CLI. It exists only in a git checkout (not in the npm package), so installs from a checkout need no network. |

---

## 5. Runtime: what happens on `npx skill-pilot`

### 5.1 Entry

1. **`bin.mjs`** (plain JS, so the version guard runs on any Node). It refuses Node < 22.6 with a message naming the package. If `dist/cli.js` exists it imports that; otherwise (a dev checkout) it spawns `node --experimental-strip-types src/cli.ts` with the same args.
2. **`src/cli.ts`** installs a SIGINT handler (restores the cursor, exits 130), calls `main()`, and sets `process.exitCode`.
3. **`src/main.ts` → `main(argv, cwd)`** returns an exit code. It never calls `process.exit` itself, so it can be tested directly.

### 5.2 Arguments (`src/args.ts`)

| Flag | Field | Effect |
| --- | --- | --- |
| `-y`, `--yes` | `yes` | Skip the picker, install every matched skill |
| `--dry-run` | `dryRun` | Print skills and agents, write nothing |
| `-a`, `--agent <ids…>` / `--agent=a,b` | `agents` | Only these agents (words until the next flag; comma lists allowed; de-duplicated) |
| `-v`, `--verbose` | `verbose` | Sequential install with per-step trace and full errors |
| `--clear-cache` | `clearCache` | Delete the download cache and exit |
| `--version` | `version` | Print the version |
| `-h`, `--help` | `help` | Help text (built from `META` and `AGENTS`) |
| anything else | `unknown` | Prints "Unknown option" + help, exit 1 |

### 5.3 Flow in `main()`

```
parseArgs ─► unknown? exit 1 │ help/version/clear-cache? exit 0
printBanner(version)                                     ui/banner.ts
detectProject(cwd)                → detected[], isFrontend, workspaces[]       detect/index.ts
loadRegistry()                    → Registry | null (missing → exit 1)          install/manifest.ts
localSkillState(cwd, registry)    → installed / outdated name sets              install/status.ts
collectSkills({detected, isFrontend, registry, installed, outdated})           resolve.ts
   nothing detected AND no skills → "No supported technologies", exit 0
printDetected(grid ✔/●, combos)                                                ui/report.ts
   no skills → "No skills for your stack yet", exit 0
chooseAgents(args.agents)         → agents[], unknown[] (warned)                agents.ts
--dry-run → printSkillList + agents, exit 0
pickSkills: -y → all │ no TTY → not-installed only │ TTY → multiSelect          ui/picker.ts
   cancelled → exit 130 │ none selected → exit 0
installAll(selected, agents, {concurrency: verbose ? 1 : 6})                   install/installer.ts
   progress: verbose → trace │ TTY tall enough → live spinners │ else one line per skill
cleanupClaudeMd(cwd)                                                           legacy/claude-md.ts
printSecurityTable (flagged/rejected review findings of installed skills)
printSummary → exit 0 if all ok, else 1
```

Exit codes: **0** success or nothing to do, **1** bad option, missing manifest or any failed install, **130** cancelled.

### 5.4 Detection (`src/detect/`)

`detectProject(projectDir)`:

1. Reads root `package.json` and `deno.json`/`deno.jsonc` (JSONC tolerated).
2. Runs `detectInDir(root)`.
3. Resolves workspaces (`workspaces.ts`), in priority order:
   - `pnpm-workspace.yaml` `packages:`,
   - else `package.json` `workspaces` (array or `{ packages }`),
   - else deno `workspace`.

   Patterns support `dir`, `dir/*` and `dir/**` (up to 3 levels). A folder counts only if it has `package.json` or `deno.json(c)`. The root itself is excluded.
4. Runs `detectInDir` on each workspace. Results are unioned and returned **in catalog order** (each technology once).
5. `isFrontend` is true if any folder has a frontend package (`FRONTEND_PACKAGES`), or web files: extensions in `WEB_FRONTEND_EXTENSIONS` or `*.blade.php`, searched to depth 3. The file scan is skipped for later workspaces once frontend is already known.

`detectInDir(dir, technologies)` tries each technology's rules **cheapest first, stopping at the first hit**:

| Order | Rule | Source |
| --- | --- | --- |
| 1 | `packages` | names from `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies` + deno import-map keys and `npm:`/`jsr:` specifiers |
| 2 | `packagePatterns` | regex over the same names |
| 3 | `configFiles` | file exists at path |
| 4 | `fileExtensions` | BFS to depth 4 |
| 5 | `gems` | `gem 'name'` lines in Gemfile |
| 6 | `configFileContent` | substring search in listed files, all Gradle files (`scanGradleLayout`) or .NET project files (`scanDotNetLayout`) |

Per-run caches avoid re-reading files and re-walking trees. All walks skip `SKIP_DIRS` (`node_modules`, `.git`, `dist`, `build`, `.next`, `vendor`, `target`, `.venv`, …) and dot-folders.

**Layout helpers:**
- **Gradle candidates:** root build/settings files, `gradle/libs.versions.toml`, each top-level subfolder's `build.gradle(.kts)`, and every module named in `settings.gradle(.kts)` `include(...)` (`:a:b` → `a/b`).
- **.NET candidates:** `global.json`, `NuGet.Config`, `Directory.Build.props`, `Directory.Packages.props`, plus `*.sln`, `*.slnx`, `*.csproj`, `*.fsproj` up to 2 folders deep.

### 5.5 Registry load (`src/install/manifest.ts`)

`loadRegistry()` reads `<package root>/registry/index.json` once per process (cached). `PACKAGE_ROOT` is the folder above `src/` or `dist/`, so the same code works in a checkout and in an installed package.

### 5.6 Matching skills: `stack-any` / `stack-all` (`src/targets.ts`, `src/resolve.ts`)

Each registry entry carries `targets: { any, all }`. `matchTargets(targets, { detected, isFrontend })` decides whether a skill applies:

- `has(id)` is true when:
  - `id` is `*`,
  - or `id` is `web-frontend` and `isFrontend`,
  - or `id` is a detected technology id.
- **`all`** non-empty: every id must be present.
- **`any`** non-empty: at least one id must be present.
- **Both** non-empty: both conditions must hold (AND).
- **Neither:** never offered (sync and validator refuse this anyway).

How a matched skill is labelled and ordered:

| Case | `sources` (the `← …` label and picker group) | `combo` | Sort rank |
| --- | --- | --- | --- |
| `stack-all` with 2+ ids | `["NestJS + Prisma"]` (names in catalog order) | same string | 1000 + lowest catalog index |
| `stack-any` hits (or single-id `stack-all`) | matched technology names in catalog order | — | catalog index of first hit |
| `web-frontend` | `["Web frontend"]` | — | 2000 |
| `*` | `["Every project"]` | — | 3000 |

`collectSkills` returns matches sorted by rank, then name. Skills whose review status is `rejected`, or that have no `targets`, are skipped.

Two helpers:
- `combosOf(skills)`: the unique combo names, for "Detected combos".
- `technologiesWithSkills(registry)`: ids referenced by any `stack-any`, or by a single-id `stack-all`. These get a ✔ in the detected grid; the rest are dimmed.

### 5.7 What is already installed (`src/install/status.ts`)

`localSkillState(projectDir, registry)` checks each name in `skills-lock.json`:

| Lock entry | `.agents/skills/<name>/SKILL.md` | Files vs registry hashes | Result |
| --- | --- | --- | --- |
| yes | missing | — | not installed (deleted by user) |
| yes | present | match | **installed** |
| yes | present | differ | **outdated** (`(update)` tag, preselected) |
| yes | present | name not in registry | installed (foreign skill, trusted as is) |
| no | — | — | not installed |

The lockfile alone is never trusted, because users delete folders without touching it.

### 5.8 Agents (`src/agents.ts`, `src/catalog/agents.ts`)

- **No `-a`:** `universal` plus every agent whose `~/<folder>/skills` exists.
- **With `-a`:** `universal` plus the named agents. Unknown names are reported and ignored.

`universal` has no folder; it stands for the canonical copy.

### 5.9 Picking (`src/ui/picker.ts`, `main.ts → pickSkills`)

- **`-y`:** prints the list and installs every matched skill. Installed ones short-circuit to "up to date".
- **No TTY** (CI, pipes): installs every skill that is not installed, i.e. new and outdated ones.
- **TTY:** `multiSelect` with
  - preselection `!installed`,
  - groups by `sources[0]`,
  - keys `↑/↓` or `k/j` move, `space` toggle, `a` all/none, `n` new & updates, `i` installed (shortcuts shown only when something is installed), `enter` confirm, `Ctrl-C` cancel.

`reducePicker` is a pure state reducer, unit-tested separately from the raw-mode terminal loop. The list scrolls when longer than the terminal height.

### 5.10 Installing one skill (`src/install/installer.ts → installSkill`)

```
entry = registry.skills[name]           missing → fail │ review "rejected" → fail
every entry.files path passes unsafeRelPath (no absolute, no "..", no .zip) → else fail
canonical = <project>/.agents/skills/<name>

if verifyDir(canonical, entry) ok        → source "up-to-date"
else
  remove canonical
  1. local registry  (<package>/registry/skills/<name>, if present and verifies) → copy listed files   "local-registry"
  2. cache           (<cache>/<bundleHash>/, if verifies)                       → copy listed files   "cache"
  3. download        (download.ts into cache, then copy)                                              "download"
  verifyDir(canonical) must pass         → else fail
for each agent with a folder:
  linkOrCopy(canonical, <project>/<agent.folder>/skills/<name>)
     relative symlink ("junction" on Windows); copy if symlinking fails
recordInLockfile(name, { source, sourceType: "registry", computedHash: bundleHash })
any link error → fail (lockfile already updated, files in place)
```

- Only files listed in the manifest are copied, so stray files never travel.
- **Downloads (`download.ts`):** all files of one skill are fetched in parallel. Each file tries the base URLs in order and accepts the first response whose SHA-256 matches. Requests time out after 20 s, and a GitHub token is sent only to `*.githubusercontent.com`. Files are written to `<dest>.tmp-<pid>-<time>`, the whole folder is verified, then renamed into place, so a partial download never looks complete.
- **Base URLs, in order:**
  1. `<ENV_PREFIX>_REGISTRY_BASE_URL` (if set, it is the only base)
  2. `https://raw.githubusercontent.com/<repo>/v<version>/registry/skills`
  3. `https://cdn.jsdelivr.net/gh/<repo>@v<version>/registry/skills`
  4. `https://raw.githubusercontent.com/<repo>/main/registry/skills`
- **`installAll`** runs N workers over the list (6 by default, 1 with `--verbose`) and returns results in input order, with `onStart`/`onDone` hooks driving the progress UI.

### 5.11 Output (`src/ui/`)

- **Colours (`colors.ts`):**
  - Off with `NO_COLOR`, `TERM=dumb`, or no TTY (unless `FORCE_COLOR`).
  - 24-bit colour when `COLORTERM=truecolor|24bit` or a known terminal (Windows Terminal, VS Code, iTerm, WezTerm, Ghostty, kitty); otherwise nearest xterm-256.
  - **All runtime output goes through `log()` / `write()`.**
- **Banner (`banner.ts` + `font.ts`):**
  - `META.wordmark` is drawn in a 7-px bitmap font, two pixel rows per line using `▀ ▄ █`, so it is 4 lines tall.
  - Colour is a gradient across `META.gradient`, with a diagonal light sweep: 32 frames × 16 ms.
  - Static (no animation) when not a TTY, `CI` is set, colour is off, or `<ENV_PREFIX>_NO_ANIMATION` is set.
  - One-line compact banner when the terminal is narrower than the wordmark + 5.
- **Reports (`report.ts`):** a 3-column detected grid, a combos list, skill lines with `(installed)`, `(update)` or `(review ⚠)` tags, a review-findings table and the summary.

### 5.12 Legacy cleanup

`cleanupClaudeMd` removes a `<!-- <cliName>:start -->…<!-- <cliName>:end -->` section from `CLAUDE.md` if present, and deletes the file if nothing else remains. Only those exact markers are touched.

---

## 6. Data formats

### 6.1 `SKILL.md` frontmatter (own skills)

```yaml
---
name: nestjs-prisma-integration          # = folder name; lowercase, digits, single hyphens, ≤ 64
description: Integrate Prisma with NestJS … Use when …   # ≤ 1024 chars, no "TODO"
license: MIT                             # optional; default MIT for own skills
metadata:                                # Agent Skills spec: string → string map
  stack-all: nestjs, prisma              # and/or stack-any: a, b ; special: web-frontend, "*"
---
```

- Parsed by `scripts/lib/frontmatter.ts`, which handles scalars, quotes, `#` comments, `>`/`|` block scalars, a one-level `metadata` map, CRLF and BOM.
- Values are comma-separated strings; arrays are also accepted by `parseTargetList`.
- **The keys are deliberately unprefixed** (`stack-*`, not `skill-pilot-*`), so renaming the tool never breaks existing skills.

### 6.2 `skills-upstream.json`

```json
{
  "$comment": "keys starting with $ or _ are ignored",
  "vercel-labs/agent-skills/react-best-practices": { "stack-any": "react" },
  "supabase/agent-skills/supabase-postgres-best-practices": { "stack-all": ["nextjs", "supabase"] }
}
```

- The key must be exactly `owner/repo/skill-folder`.
- The value may only contain `stack-any` / `stack-all`.
- Entries pointing at this project's own repo are refused, because those belong in `skills-src/`.

### 6.3 `registry/index.json` (manifest)

```jsonc
{
  "version": 1,
  "generatedAt": "2026-10-15T…Z",
  "skills": {                                   // keys sorted
    "nestjs-prisma-integration": {
      "source": "hiyasin/skill-pilot",          // owner/repo
      "skillPath": "hiyasin/skill-pilot/nestjs-prisma-integration",
      "commitSha": "local",                     // upstream: the pinned commit SHA
      "license": "MIT",                         // SPDX id or null
      "files": ["SKILL.md"],                    // relative, forward slashes, sorted
      "sha256": { "SKILL.md": "<hex>" },
      "bundleHash": "<hex>",                    // see src/install/hash.ts bundleHash()
      "review": { "status": "approved|flagged|rejected", "flags": [], "summary": "…",
                  "model": "…|none", "promptVersion": "1.0.0", "reviewedAt": "…" },
      "targets": { "any": [], "all": ["nestjs", "prisma"] }   // optional field; absent = never offered
    }
  }
}
```

Type: `Registry` / `RegistryEntry` in `src/install/manifest.ts`. **New fields must be optional**, because a CLI version reads whatever manifest it was published with.

### 6.4 `skills-lock.json` (in users' projects)

```json
{ "version": 1, "skills": { "<name>": { "source": "owner/repo", "sourceType": "registry", "computedHash": "<bundleHash>" } } }
```

Keys are sorted on every write. Entries written by other tools are preserved.

### 6.5 Files written in a user's project

```
<project>/
  .agents/skills/<name>/...           canonical verified copy
  .claude/skills/<name> → ../../.agents/skills/<name>   (one per detected agent; copy if symlink fails)
  skills-lock.json
```

### 6.6 Cache

Located at `<ENV_PREFIX>_CACHE_DIR`, otherwise:
- `$XDG_CACHE_HOME` or `~/.cache`, then `/<cliName>/skills-registry/<bundleHash>/`;
- on Windows, `%LOCALAPPDATA%\<cliName>\skills-registry\<bundleHash>\`.

The cache is keyed by content hash, so it never serves stale files. Clear it with `--clear-cache`.

---

## 7. Security model

| Boundary | Protection | Where |
| --- | --- | --- |
| Upstream repo content | Pinned to one commit; only allowed text extensions (≤ 512 KB each) are kept; LLM review for prompt injection, secrets, destructive commands, off-topic content; flagged skills need `--force`, rejected ones are never written; human review of the sync PR | `scripts/sync-skills.ts`, `.github/workflows/sync.yml` |
| Registry integrity | SHA-256 per file + bundle hash in the manifest; validator re-hashes everything in CI and before publish | `scripts/validate-registry.ts` |
| Download transport | Every byte is hash-checked against the manifest shipped inside the npm package, so a compromised mirror or CDN cannot change installed content; atomic temp-dir write | `src/install/download.ts` |
| Path safety | Manifest paths with `..`, absolute paths or `.zip` are refused before anything is written | `unsafeRelPath` in `src/install/manifest.ts` |
| Installed copy | Re-verified on every run; tampered or edited copies are shown as `(update)` and replaced on install | `status.ts`, `installer.ts` |
| Tokens | `GITHUB_TOKEN` is sent only to `*.githubusercontent.com` | `download.ts` |
| Supply chain of the CLI itself | Zero runtime dependencies; exact-pinned dev dependencies; `npm ci --ignore-scripts` in CI; npm trusted publishing with provenance | `package.json`, workflows |

The npm package's `registry/index.json` is the **root of trust**. Everything else is verified against it.

---

## 8. Maintainer pipeline (`scripts/`)

All scripts run with `node --experimental-strip-types` through `npm run …`. `scripts/lib/shared.ts → isMain()` lets each script be imported by tests without running.

### 8.1 Skill discovery: `declaredSkills()` (`scripts/lib/shared.ts`)

Returns `{ skills: Map<name, DeclaredSkill>, problems: SkillProblem[] }`, built from two sources.

**From `skills-src/`:** every folder not starting with `_` or `.`. For each one it checks that:
- `SKILL.md` exists and the frontmatter parses;
- `name` is valid and equals the folder name;
- `description` is present, ≤ 1024 characters and has no `TODO`;
- the body has no `- TODO` lines left by `new-skill`;
- `checkTargets` passes: there is at least one target, every id is a known technology or special target (unknown ids get a suggestion), and `*` is not used in `stack-all`.

**From `skills-upstream.json`:** valid JSON object; key shape, value shape, allowed keys and the own-repo check (§6.2); targets checked the same way.

A name already taken is a problem. Own skills are processed first, so they win a clash.

`DeclaredSkill` = `{ name, path, repo, origin: "own" | "upstream", targets, dir?, license? }`. Every problem carries `where` (the file and entry to fix) and `message`.

### 8.2 `npm run sync:skills` (`scripts/sync-skills.ts`)

Flags: `--only <name>`, `--dry-run`, `--force` (accept flagged and re-review unchanged), `--no-review` (local testing only), `--retry-failed`, `-v`.

**Steps:**
1. Run `declaredSkills()`.
   - With `--only`: that skill's problems abort the run (exit 1).
   - Full run: problems are printed and counted as failed. Valid skills continue.
2. **Own skills:** source = `skills-src/<name>`; `commitSha: "local"`; licence = frontmatter `license` or `MIT`.
3. **Upstream skills**, grouped by repo, one download per repo:
   - GitHub API → default branch → head commit SHA;
   - `codeload` tarball of that SHA → `tar -xzf --strip-components=1`;
   - `findSkillDir`: shallowest folder named `<name>` containing `SKILL.md` (BFS, depth 8), else a root `SKILL.md` whose `name:` matches;
   - licence from the repo's SPDX id; if the skill has no LICENSE file, the repo's root LICENSE is copied into it.
4. `selectFiles`: keep non-dot files with allowed extensions and ≤ 512 KB. Others are skipped (listed with `-v`).
5. Hash the files and compute the bundle hash. Compare with the existing manifest entry:
   - same hash + path + targets → `= unchanged`;
   - same content, different targets → targets updated in place, **no new review**;
   - otherwise → review.
6. **Review:** Anthropic Messages API.
   - Model: `SKILLS_REVIEW_MODEL`, default `claude-sonnet-5-5`; prompt version `1.0.0`; about 150k characters of file text.
   - The model must reply with JSON `{status, flags, summary}`. Invalid JSON counts as `flagged`.
   - `--no-review` records `approved` with `model: "none"`.
7. Write `registry/skills/<name>/` (replacing old content) and the manifest entry, including `targets`.
8. **Full sync only:** remove manifest entries and folders whose skill no longer exists. Skills that merely have problems this run are **never** removed.
9. Write `scripts/sync-report.json` (gitignored; used by `--retry-failed`). Exit 1 if anything failed or was rejected.

### 8.3 `npm run validate:registry` (`scripts/validate-registry.ts`)

**Errors** (exit 1):
- any `declaredSkills` problem;
- a declared skill missing from the manifest;
- `skillPath` mismatch;
- targets in the manifest ≠ targets in the source ("changed since the last sync");
- review `rejected`;
- folder missing, or `SKILL.md` not listed;
- unsafe path, missing file, file hash mismatch, or bundle hash mismatch;
- a manifest entry with no or invalid targets.

**Warnings:**
- files on disk not in the manifest;
- manifest entries no longer declared;
- registry folders not in the manifest.

Runs in CI, in `prepublishOnly`, in `npm run release`, and inside the test suite.

### 8.4 `npm run new-skill -- <name> [--any …] [--all …] [--description …]` / `--list`

Creates `skills-src/<name>/SKILL.md` and `references/`, validating the name and any given ids. Without targets or a description it writes `TODO` placeholders, which sync refuses until they are filled. `--list` prints every technology id plus the special targets.

### 8.5 `npm run set-meta` (§9) and `npm run release`

`release -- patch|minor|major [--dry-run]` does the following:
1. Requires a clean tree on `main`.
2. Runs typecheck, tests and the validator.
3. Bumps `package.json`.
4. Prepends a CHANGELOG section grouped from conventional commits since the last `v*` tag (breaking / features / fixes / other).
5. Commits `chore(release): vX.Y.Z` and creates an annotated tag.
6. Pushes `main`, **then** the tag. The tag triggers `publish.yml`.

On failure before `main` is pushed, local changes are rolled back. If `main` was pushed but the tag wasn't, it prints the command to push the tag.

---

## 9. Project metadata (`src/meta.ts`)

```ts
export const META = {
  packageName: "skill-pilot",            // npm name; may be scoped (@owner/name)
  cliName: "skill-pilot",                // bin name, cache folder, CLAUDE.md markers, User-Agent
  wordmark: "skill-pilot",               // banner text (A–Z 0–9 space - . _)
  tagline: "One command. The right AI skills for your stack.",
  githubRepo: "hiyasin/skill-pilot",     // registry host + own skills' owner/repo
  envPrefix: "SKILL_PILOT",              // <prefix>_CACHE_DIR etc.
  gradient: ["#22d3ee", "#818cf8", "#c084fc"],
} as const;
```

- `src/constants.ts` derives `PACKAGE_NAME`, `CLI_NAME`, `GITHUB_REPO`, `ENV_PREFIX`, `ISSUES_URL`, `HOMEPAGE_URL`, `envName()` and `env()`. **No other runtime file hard-codes the name, repo or prefix.**
- Files that can't import TypeScript are updated by `npm run set-meta -- --name … --repo … [--env-prefix …] [--wordmark …] [--tagline …] [--author …] [--dry-run]`:
  - `src/meta.ts`;
  - `package.json` (name, bin, homepage, repository, bugs, author);
  - `package-lock.json` (own name and bin);
  - `registry/index.json` (`source`/`skillPath` of own skills; hashes untouched);
  - workflow env names;
  - README, this file, CHANGELOG and docs (except `docs/METADATA.md`);
  - `LICENSE` holder (with `--author`).
- The author lives in `package.json` (`author`) and `LICENSE` only.
- See `docs/METADATA.md`.

---

## 10. Configuration and environment variables

**Runtime** (prefix = `META.envPrefix`, currently `SKILL_PILOT`):

| Variable | Effect |
| --- | --- |
| `SKILL_PILOT_REGISTRY_BASE_URL` | Only base URL for skill downloads (mirrors, local testing, CI at a commit) |
| `SKILL_PILOT_CACHE_DIR` | Cache location |
| `SKILL_PILOT_IGNORE_LOCAL_REGISTRY` | Ignore `registry/skills` beside the CLI and download instead (to test the download path from a checkout) |
| `SKILL_PILOT_NO_ANIMATION` | Static banner |
| `GITHUB_TOKEN` / `GH_TOKEN` | Raise GitHub raw rate limits (sent only to githubusercontent.com) |
| `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, `COLORTERM`, `CI` | Colour and animation behaviour |

**Maintainer** (`.env`, loaded by sync):

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | Review in `sync:skills` (required unless `--no-review`) |
| `SKILLS_REVIEW_MODEL` | Review model (default `claude-sonnet-5-5`) |
| `GITHUB_TOKEN` | GitHub API/tarball limits when syncing upstream skills |

---

## 11. Build, packaging and distribution

- **Language:** TypeScript, ESM, Node ≥ 22.6, run directly with `--experimental-strip-types` in development.
- **Type-stripping constraints:** `tsconfig.json` sets `erasableSyntaxOnly`, so **no `enum`, `namespace`, parameter properties or other non-erasable syntax**. Relative imports **use the `.ts` extension** (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` rewrites them to `.js` in `dist/`). `verbatimModuleSyntax` requires `import type` for type-only imports.
- **Build:** `npm run build` → `scripts/clean.mjs` + `tsc -p tsconfig.build.json`, which emits `src/**` to `dist/**`. `bin.mjs` loads `dist/cli.js`.
- **npm package contents** (`files`): `bin.mjs`, `dist/`, `registry/index.json`, about 36 kB. **`registry/skills/` is never published**; CI fails if it would be.
- **Skill files are served from git:** the CLI at version X downloads from tag `vX` (raw GitHub, then jsDelivr, then `main` as a last resort). The repo must be public, and **the tag must exist before users run that version**. `release.ts` pushes the tag; `publish.yml` publishes from it.
- **Dependencies:** zero at runtime; only `typescript` and `@types/node` for development, exact-pinned.

---

## 12. CI/CD workflows

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | push to main, PRs | `npm ci --ignore-scripts`, typecheck, tests, validate registry, build, `npm pack --dry-run` (fails if `registry/skills/` would ship) |
| `compat.yml` | after CI succeeds on main; manual | ubuntu/macos/windows × Node 22/24: tests, build, then a real install into a fake Next.js + Prisma project, downloading from `raw.githubusercontent.com/<repo>/<commit>/registry/skills` with `IGNORE_LOCAL_REGISTRY`, checks `.agents`, `.claude` and `skills-lock.json` |
| `publish.yml` | tag `v*` | npm 11, tag must equal `package.json` version, typecheck/test/validate/build, `npm publish --access public` via **trusted publishing (OIDC, provenance)**, GitHub release from the CHANGELOG section |
| `sync.yml` | Mondays 03:17 UTC; manual | `sync:skills` with `ANTHROPIC_API_KEY`, validate, open a PR `sync/skills-<date>` with the registry diff and the sync report for human review |

---

## 13. Tests

`npm test` uses Node's built-in `node:test` and `node:assert/strict`, running TypeScript directly: 92 tests. **There are no network calls.** Downloads use an injected `fetchImpl`, and every filesystem test uses temporary folders.

| File | Covers |
| --- | --- |
| `test/helpers.ts` | `tmpDir`, `writeFile`, `writeJson`, `writePackageJson`, `buildRegistry` (fixture registry + manifest, optional `targets`) |
| `args.test.ts` | flag parsing |
| `detect.test.ts` | every rule type, deno/JSONC, Gradle/.NET layouts, workspaces, frontend detection |
| `targets.test.ts` | target parsing, validation, suggestions |
| `resolve.test.ts` | matching (`any`/`all`/both, `web-frontend`, `*`), ordering, combos, installed/outdated flags, rejected skills |
| `frontmatter.test.ts` | frontmatter parser, skill-name rules |
| `declared.test.ts` | `declaredSkills` for skills-src and upstream (all problem kinds), `new-skill` scaffold |
| `installer.test.ts` | sources (local/cache/download), base-URL fallback, hash rejection, unsafe paths, rejected skills, copy mode, lockfile, concurrency, agent detection |
| `status.test.ts` | installed / outdated / deleted / foreign detection |
| `ui.test.ts` | picker reducer and key splitting, formatting, CLAUDE.md cleanup |
| `meta.test.ts` | font, gradient, `set-meta` planning (including a double rename) |
| `registry.test.ts` | technology id rules, **the shipped registry passes the validator**, bundle hash, release helpers |
| `cli.test.ts` | spawns `bin.mjs` with a fake HOME, cache and no animation: help, unknown option, empty folder, dry run, install + re-run, deleted and edited skills, unknown agents |

Because `registry.test.ts` runs the validator on the real registry, **changing a skill without running `sync:skills` fails the tests.**

---

## 14. Invariants: rules to keep when changing code

1. **`registry/` is generated.** Never edit `registry/skills/**` or `registry/index.json` by hand. Change `skills-src/` or `skills-upstream.json`, then run `npm run sync:skills`.
2. **Skill names are unique** across own and upstream skills, and own skill names follow the Agent Skills naming rules and equal their folder name.
3. **Technologies hold detection rules only.** Which skills a technology gets is declared by the skills (`stack-*`). Don't add skill lists back to `technologies.ts`.
4. **Technology ids are stable.** Renaming an id breaks every `stack-*` that uses it; the validator will list them. Ids are lowercase with hyphens and must not be `web-frontend` or `*`.
5. **The manifest is backward-compatible.** Add fields as optional; never change the meaning of an existing field. A published CLI reads the manifest it shipped with, but downloads files from its own git tag.
6. **Everything installed is verified.** Any new install source must go through `verifyDir` against the manifest before files reach `.agents/skills`.
7. **No runtime dependencies.** Use Node built-ins only in `src/`.
8. **Runtime output only via `log()` / `write()`** from `src/colors.ts`. Never `console.*` in `src/`; scripts may use `console`.
9. **Brand-neutral code.** Never hard-code the package name, command, repo or env prefix outside `src/meta.ts`. Use `constants.ts` (`CLI_NAME`, `GITHUB_REPO`, `envName()`, `env()`).
10. **Erasable TypeScript only,** with `.ts` import extensions and `import type` (§11).
11. **`main()` returns exit codes** and doesn't call `process.exit`, so tests can run it.
12. **Tests never hit the network** and never write outside temp folders.
13. **Release order:** commit, push `main`, push the tag, then publish. Skill files must exist at `v<version>` before that version is on npm.
14. **A sync with problems never deletes published skills.** Keep the `brokenNames` guard in `sync-skills.ts`.
15. **Update this file** when any of the above, a data format or the flow changes.

---

## 15. Change recipes

| Change | Steps |
| --- | --- |
| **Add your own skill** | `npm run new-skill -- <name> --any <ids>` → write it → `npm run sync:skills -- --only <name>` → `npm run validate:registry` → commit `skills-src/<name>`, `registry/`. See `docs/ADDING-SKILLS.md`. |
| **Add an upstream skill** | Add `"owner/repo/skill": { "stack-any": "…" }` to `skills-upstream.json` → `sync:skills -- --only <skill>` → read `git diff registry/` → commit. |
| **Change when a skill is offered** | Edit its `stack-*` (frontmatter or upstream JSON) → `sync:skills -- --only <name>` (updates targets without a re-review). |
| **Add a technology** | Add `{ id, name, detect }` to `src/catalog/technologies.ts` (rules in §5.4) → add a fixture test in `test/detect.test.ts`. |
| **Add a detection rule type** | Extend `DetectRules` in `catalog/types.ts`, implement it in `detectInDir` (keep cheapest-first order and caching), add tests, document it in §5.4 and `docs/ADDING-SKILLS.md`. |
| **Add an agent** | One entry in `AGENTS` (`src/catalog/agents.ts`): `{ id, name, folder }`. Detection (`~/<folder>/skills`) and linking work automatically. Update the README agent list. |
| **Add a CLI flag** | `src/args.ts` (`CliArgs` + `BOOLEAN_FLAGS` or custom parsing) → handle it in `main.ts` → help text in `helpText()` → `test/args.test.ts` + `test/cli.test.ts` → README and §5.2. |
| **Add a runtime env var** | Read it with `env("NAME")` (prefix added automatically) → help text → README table → §10. |
| **Add a manifest field** | Optional field on `RegistryEntry` → write it in `sync-skills.ts` → check it in `validate-registry.ts` → re-sync → §6.3. |
| **Add a special target** (like `web-frontend`) | Constant + `SPECIAL_TARGETS` in `src/targets.ts`, handle it in `matchTargets` (`has`, label, rank) → tests in `resolve.test.ts` / `targets.test.ts` → `new-skill --list` → docs. |
| **Change name/repo/author** | `npm run set-meta -- --name … --repo … --author …` → `npm install && npm test`. See `docs/METADATA.md`. |
| **Change banner text/colours** | `META.wordmark` / `META.gradient` in `src/meta.ts`. New glyphs go in `GLYPHS` in `src/ui/font.ts` (7 rows, equal width; tested). |
| **Release** | `npm run release -- patch|minor|major` (requires a clean `main`). |

---

## 16. Known limitations and future work

- **File allow-list in sync.** `selectFiles` keeps an explicit list of text extensions (≤ 512 KB). Upstream skills that ship other types (e.g. `.rbi`, `.vue`, `.astro`, `.erb`, `.ps1`, images) silently lose those files; the skipped list is shown only with `-v`. Planned: detect text by content, allow common assets (images, fonts, PDF) up to ~2 MB, always print skipped files, and flag skills whose `SKILL.md` references a skipped file.
- **Executable bits are not preserved.** Scripts in `scripts/` of a skill install as non-executable. Planned: optional `executable: string[]` in the manifest, applied after install on macOS/Linux.
- **Per-skill download fan-out.** All files of one skill are fetched at once; very large skills (1000+ files) should be capped (e.g. 8 at a time).
- **Upstream sync tracks the default branch head** at sync time (pinned by SHA once synced). There is no per-skill ref or version pinning in `skills-upstream.json` yet.
- **No `list` / `remove` / `update` subcommands**, and no `--json` output yet. The lockfile + `status.ts` already provide what they need.
- **Windows without symlink rights** gets copies in agent folders instead of links. Re-running the CLI refreshes them.
- **The bundled registry was synced with `--no-review`.** Run `npm run sync:skills -- --force` with `ANTHROPIC_API_KEY` before the first public release.

---

## 17. Related documents

- `README.md`: usage, development quick start, releasing to npm.
- `docs/ADDING-SKILLS.md`: adding own and upstream skills, `stack-*`, new technologies, troubleshooting.
- `docs/METADATA.md`: renaming the tool, repo, author, banner.
- `CHANGELOG.md`: release history.

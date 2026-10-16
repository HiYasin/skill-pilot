# Adding skills

How to add your own skills and other people's, how to say when each one is offered, how to keep them updated, and how to teach the CLI a new technology.

You never edit a catalog file to add a skill. Each skill declares when it applies:

- **Your skills:** with `stack-any` / `stack-all` in their own `SKILL.md`.
- **Upstream skills** (other people's): with one line in `skills-upstream.json`.

---

## 1. How it fits together

```
skills-src/<name>/SKILL.md ──┐   your skills: metadata.stack-any / stack-all in the frontmatter
skills-upstream.json ────────┘   other people's skills: "owner/repo/skill": { "stack-any": "react" }
            │
            ▼  npm run sync:skills   (copy → AI review → hash → record targets)
registry/skills/<name>/          the audited copy users download
registry/index.json              files + SHA-256 + review + stack-any / stack-all per skill
            │
            ▼  npx skill-pilot
detects the stack → offers every skill whose stack-any / stack-all matches
            → installs into <project>/.agents/skills/<name> + agent folders
```

- **A skill** is a folder with a `SKILL.md` plus any other files and folders it needs (`references/`, `scripts/`, `assets/`, …).
- **Every skill has an address**, `owner/repo/skill-name`:
  - Your skills use this repo as the owner, e.g. `hiyasin/skill-pilot/nestjs-architecture`.
  - Upstream skills use their own repo, e.g. `vercel-labs/agent-skills/react-best-practices`.
- **The last part, `skill-name`, must be unique** across all your skills and upstream skills. It becomes the folder name in users' projects.
- **Users only ever get the copy in `registry/`**, after it has been reviewed and hashed. That's why every new or changed skill goes through `npm run sync:skills`.

---

## 2. Saying when a skill is offered: `stack-any` / `stack-all`

| You want | Write |
| --- | --- |
| Offer it when any of these technologies is detected | `stack-any: nextjs, react` |
| Offer it only when all of them are used together (shown under "Detected combos") | `stack-all: nestjs, prisma` |
| Every web frontend (React, Vue, Svelte… or plain `.html` / `.css` / `.blade.php` files) | `stack-any: web-frontend` |
| Every project | `stack-any: "*"` |

- **Both:** if a skill has both keys, both must hold. For example, `stack-all: nextjs` plus `stack-any: prisma, drizzle` means "Next.js with Prisma or Drizzle".
- **The values** are technology ids from `src/catalog/technologies.ts`. See them all with:
  ```bash
  npm run new-skill -- --list
  ```
- **Mistakes are caught.** A typo stops the sync with a suggestion, e.g. `unknown technology "postgres" (did you mean "postgresql"?)`.
- **Unknown technologies:** if the technology isn't in the list, add a detection rule for it first (section 5).

---

## 3. Adding your own skill

### Step 1: create it

```bash
npm run new-skill -- redis-caching --any redis --description "Cache data in Redis with clear keys, TTLs and invalidation. Use when adding caching, sessions or rate limits with Redis."
```

This creates `skills-src/redis-caching/SKILL.md` and an empty `references/` folder. Without `--any` / `--all` / `--description` it leaves `TODO` placeholders and prints the technology ids. You can also create the folder by hand.

The finished frontmatter looks like this:

```markdown
---
name: redis-caching
description: Cache data in Redis with clear keys, TTLs and invalidation. Use when adding caching, sessions or rate limits with Redis.
metadata:
  stack-any: redis
---

# Redis caching
...
```

**Rules** (from the [Agent Skills spec](https://agentskills.io/specification), checked by sync):
- `name`: lowercase letters, digits and single hyphens, at most 64 characters, the same as the folder name.
- `description`: what the skill does and when to use it, at most 1024 characters. Agents read it to decide whether to load the skill, so name concrete triggers (frameworks, files, tasks).
- `metadata.stack-any` / `stack-all`: at least one, as above. Values are plain strings, which keeps the file valid for every agent.
- `license` (optional): defaults to MIT for your own skills.

### Step 2: write the skill

Replace every `- TODO` in the body. Sync refuses a skill that still has them, or a `TODO` in its description.

- Keep `SKILL.md` short and specific: rules an agent can follow, with small examples. Aim for under about 150 lines.
- Put long material in `references/<topic>.md` and link it from `SKILL.md`. Any extra files and folders you add are shipped and hashed along with it.
- **Drafts:** a folder whose name starts with `_` (e.g. `skills-src/_redis-draft/`) is ignored completely. Keep work in progress there.

### Step 3: sync it

```bash
cp .env.example .env            # first time only: add ANTHROPIC_API_KEY
npm run sync:skills -- --only redis-caching
```

You'll see one of these:

| Output | Meaning | What to do |
| --- | --- | --- |
| `✔ redis-caching  stack-any: redis` | Approved, written to `registry/`, targets recorded | Continue |
| `Fix this first: ✘ skills-src/redis-caching/SKILL.md: …` | Frontmatter problem (name, targets, TODOs) | Fix the line it names and run again |
| `⚠ redis-caching flagged` | The review wants a human check | Read the summary; fix the skill, or re-run with `--force` if you're sure |
| `✘ redis-caching rejected` | Prompt injection, secrets or a destructive command | Fix the content; rejected skills are never written |

For a quick local try without an API key, `--no-review` skips the review. Don't release a registry synced that way.

### Step 4: check and try it

```bash
npm run validate:registry
npm test
cd ~/projects/an-app-that-uses-redis
node ~/path/to/skill-pilot/bin.mjs --dry-run      # redis-caching is listed under Redis
```

### Step 5: commit and release

Commit `skills-src/redis-caching/`, `registry/skills/redis-caching/` and `registry/index.json` together, then run `npm run release -- minor`.

### Changing a skill later

- **Content:** edit the files in `skills-src/<name>/`, then run `npm run sync:skills -- --only <name>`. Skills whose content hasn't changed are skipped (`= unchanged`).
- **Only `stack-any` / `stack-all`:** sync updates the targets without a new review.
- **Forgot to sync:** the validator (run in CI and before publish) fails with the exact command to run.

---

## 4. Adding someone else's skill (upstream)

"Upstream" means the original lives in someone else's GitHub repo. You don't copy or edit their files. You list the skill, and sync fetches, reviews and pins it.

### Step 1: find the skill folder

Browse the repo on GitHub and find the folder that contains its `SKILL.md`. For example, if `github.com/vercel-labs/agent-skills` has `skills/react-best-practices/SKILL.md`:

| Part | Value |
| --- | --- |
| owner/repo | `vercel-labs/agent-skills` |
| skill folder | `react-best-practices` (the folder holding SKILL.md) |
| address | `vercel-labs/agent-skills/react-best-practices` |

Sync searches the whole repo for a folder with that exact name containing a `SKILL.md`, so the path inside the repo doesn't matter. If the repo is itself a single skill with `SKILL.md` at its root, use the `name:` from its frontmatter.

### Step 2: check the licence

You redistribute these files, so the licence must allow it:
- **Fine with attribution:** MIT, Apache-2.0, BSD, CC-BY.
- **Avoid:** "all rights reserved", no licence at all, and non-commercial licences (e.g. CC BY-NC) if the tool is used commercially.

Sync records the repo's licence in `registry/index.json`. If the skill folder has no LICENSE file of its own, sync copies the repo's root LICENSE into it, so attribution travels with the skill.

### Step 3: add one line to `skills-upstream.json`

```json
{
  "$comment": "…",
  "vercel-labs/agent-skills/react-best-practices": { "stack-any": "react" },
  "supabase/agent-skills/supabase-postgres-best-practices": { "stack-all": "nextjs, supabase" }
}
```

- Values use the same `stack-any` / `stack-all` words as your own skills. A list (`["nextjs", "supabase"]`) works too.
- Keys starting with `$` or `_` are comments and are ignored.
- A key pointing at your own repo is refused, because those skills belong in `skills-src/`.

### Step 4: sync it

```bash
# Recommended: avoids GitHub API rate limits (a token with no scopes is enough for public repos)
echo "GITHUB_TOKEN=ghp_yourtoken" >> .env

npm run sync:skills -- --only react-best-practices
```

Sync does the following:
1. Looks up the repo's default branch and latest commit.
2. Downloads that exact commit.
3. Finds the skill folder and keeps the allowed files.
4. Runs the review.
5. Writes everything to `registry/skills/<name>/` with SHA-256 hashes, the commit SHA, the licence and the targets.

Skills from the same repo share one download.

### Step 5: read what you're shipping

```bash
git diff --stat registry/
git diff registry/skills/react-best-practices/
```

Read the SKILL.md yourself, even when the review approved it. You are vouching for it to your users.

### Step 6: validate, test, commit, release

Same as steps 4–5 in section 3. Commit `skills-upstream.json` together with the `registry/` changes.

### Keeping upstream skills up to date

- **Weekly:** `.github/workflows/sync.yml` runs every Monday (and on demand from the Actions tab). It re-syncs every skill and opens a pull request if anything changed. Review it like any code change before merging.
- **Manually:** run `npm run sync:skills`, or `npm run sync:skills -- --only <name>` for one skill.
- **What sync tracks:** it always takes the upstream default branch's latest commit at the time you sync, and records the SHA so you can see exactly what you shipped.
- **Freezing a version:** to keep a version you trust, copy the skill into `skills-src/` (keep its LICENSE, add `metadata.stack-*`), and remove its line from `skills-upstream.json`.

### Name collisions

Two repos can both have a skill called `react`, but only one skill per name can ship. Your own skill wins, and sync reports the clash. To ship both, copy the second one into `skills-src/<new-name>/`, set `name: <new-name>`, keep its LICENSE, and add `metadata.stack-*`.

---

## 5. Detecting a new technology

`stack-any` / `stack-all` can only use technologies the CLI knows how to recognise. To add one, add an entry to `src/catalog/technologies.ts`. Detection rules are tried cheapest first, and the first match wins:

| Rule | Matches when… | Example |
| --- | --- | --- |
| `packages` | a dependency (any field of package.json) or Deno import has this exact name | `packages: ["bullmq"]` |
| `packagePatterns` | any dependency name matches a regex | `packagePatterns: [/^@clerk\//]` |
| `configFiles` | a file exists at this path in the project | `configFiles: ["nest-cli.json", "prisma/schema.prisma"]` |
| `fileExtensions` | any file with this extension within 4 folders (skips node_modules, dist, …) | `fileExtensions: [".tf"]` |
| `gems` | a `gem 'name'` line in the Gemfile | `gems: ["rails"]` |
| `configFileContent` | one of these files contains one of these strings | `{ files: ["requirements.txt", "pyproject.toml"], patterns: ["fastapi"] }` |
| …with `scanGradleLayout: true` | any Gradle build file (root, subfolders, modules in settings.gradle) contains a string | `{ scanGradleLayout: true, patterns: ["com.android.application"] }` |
| …with `scanDotNetLayout: true` | any `.sln`/`.csproj`/`.fsproj` (2 folders deep) contains a string | `{ scanDotNetLayout: true, patterns: ["Microsoft.NET.Sdk.Web"] }` |

Example:

```ts
{
  id: "bullmq",                 // what stack-any / stack-all refer to: lowercase, hyphens, stable
  name: "BullMQ",               // shown to users
  detect: { packages: ["bullmq"] },
},
```

This file holds detection rules only, never skill lists. A technology no skill targets yet is still detected and shown dimmed. Monorepos need nothing extra, since each workspace package is scanned with the same rules.

Add a test in `test/detect.test.ts`, then run `npm test`:

```ts
it("detects BullMQ", (t) => {
  const dir = tmpDir(t);
  writePackageJson(dir, { bullmq: "5" });
  ok(ids(dir).includes("bullmq"));
});
```

---

## 6. Removing a skill

- **Your own:** delete `skills-src/<name>/`.
- **Upstream:** delete its line from `skills-upstream.json`.

Then run a full `npm run sync:skills`. A full sync removes skills that no longer exist from `registry/` and `index.json`. A sync with `--only` never removes anything, and neither does a sync where the skill has a frontmatter mistake. A typo never deletes a published skill.

---

## 7. Troubleshooting

| Message | Cause | Fix |
| --- | --- | --- |
| `name "x" must match the folder name "y"` | `name:` in SKILL.md differs from the folder | Rename one of them so they match |
| `unknown technology "postgres" (did you mean "postgresql"?)` | Typo in `stack-any` / `stack-all` | Use the suggested id, or check `npm run new-skill -- --list` |
| `… (add it to src/catalog/technologies.ts first)` | The CLI can't detect that technology yet | Add a detection rule (section 5) |
| `no "stack-any" or "stack-all"` | The skill doesn't say when it's offered | Add `metadata:` with `stack-any` or `stack-all` |
| `the body still has "- TODO" placeholders` / `description still contains the TODO placeholder` | Scaffold not finished | Write the content |
| `SKILL.md must start with a --- frontmatter block` | Missing or broken frontmatter | Start the file with `---`, the fields, then `---` |
| `stack-any / stack-all changed since the last sync` | Targets edited but not synced | Run the command shown |
| `in skills-src/… but missing from the manifest` | New skill never synced | `npm run sync:skills -- --only <name>` |
| `no folder named X with a SKILL.md in owner/repo` | Wrong folder name for an upstream skill | Check the folder on GitHub; the last part of the address must match it exactly |
| `GitHub /repos/... → 401/403` | GitHub API rate limit or no network | Add `GITHUB_TOKEN` to `.env` |
| `ANTHROPIC_API_KEY is not set` | Review needs an API key | Add it to `.env`, or use `--no-review` for local testing only |
| `hash mismatch for …` | A file in `registry/skills` was edited by hand | Never edit `registry/` directly; edit `skills-src/` and sync |
| Skill doesn't show in `--dry-run` | Technology not detected, or targets don't match | Run `--dry-run` in the project root; check "Detected technologies" and the skill's `stack-*` |

---

## 8. Checklist

- [ ] `name` matches the folder; `description` says what it does and when to use it
- [ ] `metadata.stack-any` and/or `stack-all` set (own skills), or a line in `skills-upstream.json` (upstream)
- [ ] No `TODO` left in the description or body
- [ ] Licence allows redistribution (upstream skills)
- [ ] `npm run sync:skills -- --only <name>` approved it
- [ ] I read the synced files in `registry/skills/<name>/`
- [ ] `npm run validate:registry` and `npm test` pass
- [ ] `--dry-run` in a real project lists the skill
- [ ] Committed `skills-src/<name>/` or `skills-upstream.json`, plus `registry/skills/<name>/` and `registry/index.json`

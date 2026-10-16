# Project metadata guide

How to replace the placeholder name (`skill-pilot`), GitHub repo (`hiyasin/skill-pilot`), author and look of the CLI with your own.

All project metadata lives in **`src/meta.ts`**. The rest of the code reads from it. A few files outside `src/` can't import TypeScript (package.json, the lockfile, the registry manifest, workflows, docs), and `npm run set-meta` updates those for you.

---

## 1. What each field does

| Field in `src/meta.ts` | Default | Where it shows up |
| --- | --- | --- |
| `packageName` | `skill-pilot` | npm package name and the command in help text (`npx <packageName>`). Can be scoped, e.g. `@hiyasin/skills`. |
| `cliName` | `skill-pilot` | Command name (`bin` in package.json), cache folder `~/.cache/<cliName>/`, CLAUDE.md markers, User-Agent. Never scoped. |
| `wordmark` | `skill-pilot` | The big letters in the intro banner. |
| `tagline` | `One command. The right AI skills for your stack.` | Line under the banner. |
| `githubRepo` | `hiyasin/skill-pilot` | Where skill files are downloaded from (`raw.githubusercontent.com/<githubRepo>/v<version>/registry/skills/...`), issue and homepage links, and the owner part of your own skills' addresses (`<githubRepo>/<skill-name>`). |
| `envPrefix` | `SKILL_PILOT` | Environment variables: `<envPrefix>_CACHE_DIR`, `_REGISTRY_BASE_URL`, `_IGNORE_LOCAL_REGISTRY`, `_NO_ANIMATION`. |
| `gradient` | `#22d3ee → #818cf8 → #c084fc` | Banner colours, left to right. |

The author (`Yasin` by default) is not in `src/meta.ts`. It lives in `package.json` (`author`) and `LICENSE`, and `--author` updates both.

---

## 2. Before you start

1. **Pick a name and check it's free on npm.**
   ```bash
   npm view <name>          # "404 Not Found" means it's free
   ```
   If the plain name is taken, use a scoped name under your npm user or org, e.g. `@hiyasin/skills`. Users then run `npx @hiyasin/skills`. Scoped packages need `--access public` on publish, which `publish.yml` already passes.

2. **Create the GitHub repo and make it public.** The CLI downloads skill files from it anonymously, so a private repo will break installs for everyone else.

3. **Decide your env prefix.** By default it's the command name in capitals with `-` turned into `_` (`stack-skills` → `STACK_SKILLS`).

---

## 3. Option A: one command (recommended)

Preview first:

```bash
npm run set-meta -- --name stackskills --repo hiyasin/stackskills --dry-run
```

Then apply:

```bash
npm run set-meta -- --name stackskills --repo hiyasin/stackskills --author "Yasin"
npm install
npm test
npm run validate:registry
```

You can change one field at a time. For example, to move the repo only:

```bash
npm run set-meta -- --repo your-org/skill-pilot
```

All options:

| Flag | Meaning |
| --- | --- |
| `--name <npm-name>` | New package name. Also sets `cliName` (the name without any `@scope/`) and, unless given, the env prefix. |
| `--repo <owner/repo>` | New GitHub repo. |
| `--env-prefix <NAME>` | Override the derived env prefix. |
| `--wordmark <text>` | Banner text, if it should differ from the command name (e.g. `--wordmark "STACK"`). |
| `--tagline "<text>"` | New line under the banner. |
| `--author "<name>"` | Sets `author` in package.json and the LICENSE copyright holder. |
| `--dry-run` | Show what would change and write nothing. |

It also tells you whether the new name is free on npm.

**What it changes:**

- `src/meta.ts`: all metadata fields.
- `package.json`: `name`, `bin`, `homepage`, `repository`, `bugs`, and `author` if you pass `--author`.
- `package-lock.json`: the package's own name and bin.
- `registry/index.json`: `source` and `skillPath` of your first-party skills. File hashes don't change, so no re-review is needed.
- `.github/workflows/*.yml`: env variable names.
- `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/*.md` (except this file): name, repo and env variable mentions.
- `LICENSE`: the copyright holder, only with `--author`.

**What it doesn't touch:**

- Your git remote. Run `git remote set-url origin https://github.com/<owner>/<repo>.git`.
- The gradient colours. Edit those by hand (section 5).
- Projects where someone already ran the old CLI. Their `.agents/skills` folders keep working, and their `skills-lock.json` shows the old source until they re-install.

---

## 4. Option B: by hand

If you prefer to edit files yourself, change exactly these:

| # | File | Change |
| --- | --- | --- |
| 1 | `src/meta.ts` | `packageName`, `cliName`, `wordmark`, `tagline`, `githubRepo`, `envPrefix`, `gradient` |
| 2 | `package.json` | `"name"` → packageName; `"bin": { "<cliName>": "bin.mjs" }`; `"homepage"`, `"repository.url"`, `"bugs.url"` → your repo; `"author"` |
| 3 | `package-lock.json` | Easiest: delete it and run `npm install` |
| 4 | `registry/index.json` | Don't edit it. Run `npm run sync:skills` (needs `ANTHROPIC_API_KEY`, or add `--no-review` for local testing only). It rewrites the first-party entries with the new repo. |
| 5 | `.github/workflows/compat.yml` | Rename `SKILL_PILOT_*` env vars to your prefix |
| 6 | `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/` | Replace name, repo and env var mentions |
| 7 | `LICENSE` | Copyright holder |

Then run `npm install && npm test && npm run validate:registry`.

> Find anything you missed with: `grep -rn "skill-pilot\|hiyasin\|SKILL_PILOT" --exclude-dir=node_modules --exclude-dir=registry .`

---

## 5. The intro banner

The banner is drawn by `src/ui/banner.ts` using the pixel font in `src/ui/font.ts`. It reads only from `src/meta.ts`.

**Change the text:** set `wordmark`. Supported characters: A–Z (lowercase is drawn as uppercase), 0–9, space, `-`, `.`, `_`. Each letter takes about 6 terminal columns. If the terminal is narrower than the wordmark plus 5 columns, the CLI automatically shows a one-line banner instead. Keep it under about 12 characters so it fits an 80-column terminal.

**Change the colours:** set `gradient` to two or more hex colours, left to right:

```ts
gradient: ["#f97316", "#ec4899"],            // orange → pink
gradient: ["#10b981", "#06b6d4", "#3b82f6"], // green → cyan → blue
gradient: ["#e5e7eb", "#9ca3af"],            // monochrome
```

Terminals with 24-bit colour (Windows Terminal, VS Code, iTerm2, WezTerm, Ghostty, kitty, or anything setting `COLORTERM=truecolor`) get exact colours. Others get the nearest 256-colour match.

**Animation:** a diagonal light sweep that takes about half a second. It is skipped automatically when output isn't an interactive terminal, when `CI` is set, when `NO_COLOR` is set, or when `<envPrefix>_NO_ANIMATION=1`. To change the speed, edit `frames` (number of steps) and `sleep(16)` (milliseconds per step) in `printBanner`.

**Add a glyph:** add a 7-row entry of `#` and `.` to `GLYPHS` in `src/ui/font.ts`. All rows of one glyph must be the same width. `npm test` checks this.

---

## 6. The owner label in skill lists

Skill lists show `owner › skill-name`, for example `hiyasin › nextjs-app-router` or `vercel-labs › react-best-practices`. The owner is the first part of the skill's address. Your own skills are addressed as `<githubRepo>/<skill-name>`, so after changing `githubRepo` they show your new owner automatically.

To hide the owner for your own skills only, edit `skillLabel` in `src/ui/format.ts`:

```ts
import { GITHUB_REPO } from "../constants.ts";

export function skillLabel(path: string, styled = false): string {
  const { repo, name } = parseSkillPath(path);
  if (repo === GITHUB_REPO) return styled ? bold(cyan(name)) : name;   // first-party: name only
  const owner = repo.split("/")[0];
  return styled ? `${dim(owner)} ${gray("›")} ${bold(cyan(name))}` : `${owner} › ${name}`;
}
```

---

## 7. Check your work

```bash
npm install
npm test                      # includes font, banner and set-meta tests
npm run validate:registry
node bin.mjs --help           # new name and env var names
cd ~/some/project && node ~/path/to/repo/bin.mjs --dry-run   # banner + detection
```

---

## 8. After publishing

If you already published under the old name:

- **Point old users to the new name:** `npm deprecate <old-name> "Renamed to <new-name>: npx <new-name>"`.
- **Keep old versions working:** they download skills from the old repo's tags. Leave the old repo up, or rename it on GitHub rather than deleting it. Treat GitHub's redirects as a convenience, not a guarantee.
- **Trusted publishing is per package:** set it up again on npmjs.com for the new package name (README → "Releasing to npm").

# skill-pilot

**One command. The right AI agent skills for your stack.**

```bash
npx @hiyasin/skill-pilot
```

`skill-pilot` scans your project, detects the technologies you use, and installs matching agent skills (`SKILL.md` folders) for Claude Code, Cline, Junie, CodeBuddy, Continue, Kiro and any agent that reads `.agents/skills`. Every file is checked against a SHA-256 manifest before it is written.

## How it works

1. **Detect** — reads `package.json` (all dependency fields), `deno.json`, Gemfile, Python/PHP/Java/Dart manifests, Gradle and .NET project files, config files and file extensions. Monorepos (pnpm, npm/yarn/bun workspaces, Deno) are scanned package by package.
2. **Resolve** — every skill says when it applies (`stack-any: nextjs`, `stack-all: nestjs, prisma`, `stack-any: web-frontend`). Matching skills are listed; ones already on disk are marked installed, edited ones as updates.
3. **Pick** — an interactive picker (or `-y` for everything).
4. **Install** — each skill is copied to `.agents/skills/<name>` from the local registry, the cache, or downloaded from the git tag matching the CLI version; every byte is hash-checked. Then it is symlinked (or copied on Windows without symlink rights) into each agent folder, e.g. `.claude/skills/<name>`, and recorded in `skills-lock.json`.

## Usage

```
npx skill-pilot                      Detect, pick and install
npx skill-pilot -y                   Install everything without asking
npx skill-pilot --dry-run            Show what would be installed
npx skill-pilot -a claude-code cline Install for these agents only
npx skill-pilot --clear-cache        Delete downloaded skills
npx skill-pilot -v                   Verbose: one at a time with every step
```

Agents are auto-detected when `~/<agent folder>/skills` exists: `.claude`, `.cline`, `.junie`, `.codebuddy`, `.continue`, `.kiro`. `universal` (`.agents/skills`) is always included.

| Variable | Effect |
| --- | --- |
| `SKILL_PILOT_REGISTRY_BASE_URL` | Download skill files from this base URL instead of GitHub |
| `SKILL_PILOT_CACHE_DIR` | Cache folder (default `~/.cache/skill-pilot/skills-registry`) |
| `SKILL_PILOT_IGNORE_LOCAL_REGISTRY` | Ignore `registry/skills` next to the CLI and download instead |
| `SKILL_PILOT_NO_ANIMATION` | Show the banner without the animation |
| `GITHUB_TOKEN` / `GH_TOKEN` | Sent only to `raw.githubusercontent.com` to raise rate limits |

Requires Node.js 22.6 or newer.

---

## Development

```bash
npm install
npm test                 # node:test, no network
npm run typecheck
npm run validate:registry
npm run build            # compiles src/ to dist/
```

### Try it on a real project

```bash
# From any project folder, run the CLI straight from your checkout:
node /path/to/skill-pilot/bin.mjs --dry-run
node /path/to/skill-pilot/bin.mjs

# Or install the command globally from your checkout:
npm run build && npm link
cd ~/projects/some-app && skill-pilot

# Or test the exact package npm will publish:
npm run build && npm pack
cd ~/projects/some-app && npx /path/to/skill-pilot/skill-pilot-0.1.0.tgz
```

A checkout has `registry/skills/` on disk, so installs copy locally and need no network. To exercise the download path, serve the registry and point the CLI at it:

```bash
npx http-server registry -p 8080     # or: python3 -m http.server 8080 -d registry
SKILL_PILOT_IGNORE_LOCAL_REGISTRY=1 \
SKILL_PILOT_REGISTRY_BASE_URL=http://localhost:8080/skills \
node /path/to/skill-pilot/bin.mjs -y
```

### Project layout

```
bin.mjs                 Node version guard → dist/cli.js (or src/cli.ts in a checkout)
src/
  meta.ts               name, repo, env prefix, banner text and colours  ← change them here
  cli.ts, main.ts       entry point and the run flow
  args.ts               flag parsing
  catalog/              technologies.ts (detection rules), agents, frontend files
  detect/               package/deno/gem/gradle/.NET/content/workspace scanners
  targets.ts            stack-any / stack-all matching
  resolve.ts            detected stack + registry targets → skill list
  agents.ts             agent detection and -a handling
  install/              manifest, hashing, download, cache, links, lockfile
  ui/                   banner + pixel font, picker, progress rows, reports
  legacy/claude-md.ts   removes an old marker section from CLAUDE.md
skills-src/<name>/      your skills; SKILL.md frontmatter says when each is offered
skills-upstream.json    other people's skills + when to offer them
registry/
  index.json            manifest: files, SHA-256, review, targets      (shipped in npm)
  skills/<name>/        synced skill files                              (served from git)
scripts/                sync-skills, new-skill, validate-registry, release, set-meta
ARCHITECTURE.md         complete technical map of the tool
docs/                   METADATA.md, ADDING-SKILLS.md
test/                   node:test suites
```

## Guides

- **[Architecture](ARCHITECTURE.md)**: how the whole tool works (runtime flow, registry, data formats, security model, scripts, CI, invariants, change recipes). Read this before changing code.
- **[Project metadata](docs/METADATA.md)**: change the name, GitHub repo, author, env prefix, banner text and colours. One command: `npm run set-meta -- --name <npm-name> --repo <owner/repo>`.
- **[Adding skills](docs/ADDING-SKILLS.md)**: add your own skills (`npm run new-skill -- <name>`) or other people's (`skills-upstream.json`), say when they're offered with `stack-any` / `stack-all`, keep them updated, and detect new technologies. No catalog editing needed.

`sync:skills` flags: `--dry-run`, `--no-review` (local testing only), `--force` (accept skills the review flagged), `--only <name>`, `--retry-failed`, `-v`. It needs `ANTHROPIC_API_KEY` in `.env` (see `.env.example`) unless you pass `--no-review`.

> The registry in this repo was generated with `--no-review` for first-party skills. Run `npm run sync:skills -- --force` with an API key before your first release so every entry carries a real review.

## Releasing to npm

The CLI downloads skill files from `https://raw.githubusercontent.com/<GITHUB_REPO>/v<version>/registry/skills/...`, so **the GitHub repo must be public and the version tag must exist before users run that version.** `npm run release` handles the order for you.

### One-time setup

1. **Name and repo.** Run `npm run set-meta -- --name <npm-name> --repo <owner/repo>` (see [docs/METADATA.md](docs/METADATA.md)). It also tells you whether the name is free on npm.
2. **Push to GitHub** as a public repo (`main` branch).
3. **First publish from your machine.** npm only offers trusted-publisher settings on a package that already exists.
   ```bash
   npm login
   git tag v0.1.0 && git push origin main v0.1.0
   npm publish --access public      # runs validate + build first
   ```
4. **Turn on trusted publishing.** On npmjs.com → your package → Settings → Trusted publishing → GitHub Actions: owner, repository, workflow file `publish.yml`. After that, no npm token is needed and every release gets a provenance badge.
5. **Secrets.** Add `ANTHROPIC_API_KEY` to the repo's Actions secrets for the weekly sync, and enable *Settings → Actions → General → Allow GitHub Actions to create pull requests*.

### Every release

```bash
npm run release -- patch      # or minor / major; add --dry-run to preview
```

This runs typecheck, tests and the registry validator, bumps the version, writes the CHANGELOG from conventional commits (`feat:`, `fix:`, `feat!:`), commits, tags `vX.Y.Z` and pushes. The tag triggers `.github/workflows/publish.yml`, which re-runs the checks, publishes to npm and creates a GitHub release.

### Workflows

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | push, PR | typecheck, tests, registry validation, build, package contents check |
| `compat.yml` | after CI on main | tests + a real download install on Linux, macOS, Windows × Node 22, 24 |
| `publish.yml` | `v*` tag | checks, `npm publish` via OIDC, GitHub release |
| `sync.yml` | weekly, manual | sync + review skills, open a PR with registry changes |

## License

MIT © Yasin. Each skill in `registry/skills` keeps its own licence, recorded in `registry/index.json`.

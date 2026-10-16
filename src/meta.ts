/**
 * ─── PROJECT METADATA ───────────────────────────────────────────────────
 * Everything that names or styles this tool lives in this one object.
 * Change it with `npm run set-meta -- --name <npm-name> --repo <owner/repo>`
 * (which also updates package.json, the registry and the workflows), or
 * edit it by hand following docs/METADATA.md.
 * ────────────────────────────────────────────────────────────────────────
 */
export const META = {
  /** npm package name, used in `npx <packageName>`. May be scoped: "@acme/skills". */
  packageName: "skill-pilot",

  /** Command name (package.json "bin"), cache folder and marker name. No scope, no slash. */
  cliName: "skill-pilot",

  /** Text drawn in big letters by the intro banner (A–Z, 0–9, space, - . _). */
  wordmark: "skill-pilot",

  /** One line under the banner. */
  tagline: "One command. The right AI skills for your stack.",

  /** Public GitHub repo that hosts the registry: skills are downloaded from its tags. */
  githubRepo: "hiyasin/skill-pilot",

  /** Prefix for environment variables, e.g. <envPrefix>_CACHE_DIR. */
  envPrefix: "SKILL_PILOT",

  /** Banner gradient, left to right, as hex colours (2 or more stops). */
  gradient: ["#22d3ee", "#818cf8", "#c084fc"],
} as const;

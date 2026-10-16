/** Substring search inside one or more files. */
export interface ContentRule {
  /** Paths relative to the scanned folder. Ignored when a layout scan is set. */
  files?: string[];
  /** Any one of these substrings is enough. */
  patterns: string[];
  /** Search every Gradle build file (root, subfolders, settings.gradle modules, version catalog). */
  scanGradleLayout?: boolean;
  /** Search .sln / .csproj / .fsproj files up to two folders deep plus root .NET config files. */
  scanDotNetLayout?: boolean;
}

export interface DetectRules {
  /** Exact npm package names or Deno import names. */
  packages?: string[];
  /** Regular expressions tested against every package name. */
  packagePatterns?: RegExp[];
  /** Files whose mere presence identifies the technology. */
  configFiles?: string[];
  /** Any file with one of these extensions, searched up to 4 folders deep. */
  fileExtensions?: string[];
  /** Gem names from a Gemfile. */
  gems?: string[];
  /** File-content checks. */
  configFileContent?: ContentRule | ContentRule[];
}

/**
 * A technology the CLI can recognise. Which skills it gets is NOT set here:
 * each skill declares its own `stack-any` / `stack-all` (see src/targets.ts).
 */
export interface Technology {
  /** Used in `stack-any` / `stack-all`. Lowercase, stable. */
  id: string;
  /** Shown to users. */
  name: string;
  detect: DetectRules;
}

/**
 * When a skill is offered, read from `metadata.stack-any` / `metadata.stack-all`
 * in its SKILL.md (own skills) or from skills-upstream.json (upstream skills).
 */
export interface SkillTargets {
  /** Offered when ANY of these technology ids is detected. */
  any: string[];
  /** Offered only when ALL of these are detected. */
  all: string[];
}

export interface Agent {
  /** Value users pass to `-a`. */
  id: string;
  name: string;
  /** Folder under the project (and under $HOME, for detection). `null` = canonical copy only. */
  folder: string | null;
}

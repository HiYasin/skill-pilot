export interface CliArgs {
  yes: boolean;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
  clearCache: boolean;
  agents: string[];
  unknown: string[];
}

const BOOLEAN_FLAGS: Record<string, keyof Omit<CliArgs, "agents" | "unknown">> = {
  "-y": "yes",
  "--yes": "yes",
  "--dry-run": "dryRun",
  "-v": "verbose",
  "--verbose": "verbose",
  "-h": "help",
  "--help": "help",
  "--version": "version",
  "--clear-cache": "clearCache",
};

/**
 * `-a` / `--agent` takes every following word until the next flag, so both
 * `-a cursor claude-code` and `--agent=claude-code,cline` work.
 */
export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    yes: false,
    dryRun: false,
    verbose: false,
    help: false,
    version: false,
    clearCache: false,
    agents: [],
    unknown: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--agent=")) {
      result.agents.push(...splitAgents(arg.slice("--agent=".length)));
      continue;
    }

    if (arg === "-a" || arg === "--agent") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.agents.push(...splitAgents(argv[++i]));
      }
      continue;
    }

    const key = BOOLEAN_FLAGS[arg];
    if (key) {
      result[key] = true;
      continue;
    }

    result.unknown.push(arg);
  }

  result.agents = [...new Set(result.agents)];
  return result;
}

function splitAgents(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

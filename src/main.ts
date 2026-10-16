import { resolve } from "node:path";

import { chooseAgents } from "./agents.ts";
import { parseArgs } from "./args.ts";
import { AGENTS } from "./catalog/agents.ts";
import { bold, cyan, dim, green, log, red, write, yellow } from "./colors.ts";
import { CLI_NAME, HOMEPAGE_URL, PACKAGE_NAME, envName, getVersion } from "./constants.ts";
import { detectProject } from "./detect/index.ts";
import { clearCache } from "./install/cache.ts";
import { installAll, type InstallResult } from "./install/installer.ts";
import { localSkillState } from "./install/status.ts";
import { loadRegistry, type Registry } from "./install/manifest.ts";
import { cleanupClaudeMd } from "./legacy/claude-md.ts";
import { collectSkills, combosOf, technologiesWithSkills, type SkillEntry } from "./resolve.ts";
import { printBanner } from "./ui/banner.ts";
import { multiSelect } from "./ui/picker.ts";
import { lineProgress, liveProgress, verboseProgress, type Progress } from "./ui/progress.ts";
import {
  countSummary,
  labelWidth,
  printDetected,
  printSecurityTable,
  printSkillList,
  printSummary,
  skillLine,
  sourceHint,
} from "./ui/report.ts";

function helpText(): string {
  const agentIds = AGENTS.map((a) => a.id).join(", ");
  const examples: [string, string][] = [
    ["", "Detect, pick and install"],
    ["-y", "Install everything without asking"],
    ["--dry-run", "Show what would be installed"],
    ["-a claude-code cline", "Install for these agents only"],
    ["--clear-cache", "Delete downloaded skills"],
  ];
  const commands = examples.map(([args]) => `npx ${PACKAGE_NAME}${args ? " " + args : ""}`);
  const width = Math.max(...commands.map((c) => c.length)) + 2;
  const usage = commands.map((cmd, i) => `    ${cmd.padEnd(width)}${dim(examples[i][1])}`).join("\n");
  return `
  ${bold(CLI_NAME)} — detect your stack and install the right AI agent skills

  ${bold("Usage")}
${usage}

  ${bold("Options")}
    -y, --yes          Skip the picker
    --dry-run          Print skills and agents, write nothing
    -a, --agent <ids>  Only these agents (${agentIds})
    -v, --verbose      Install one at a time and print every step
    --clear-cache      Delete the download cache and exit
    --version          Print the version
    -h, --help         Show this help

  ${bold("Environment")}
    ${envName("REGISTRY_BASE_URL").padEnd(32)}Download skill files from another base URL
    ${envName("CACHE_DIR").padEnd(32)}Cache folder location
    ${envName("NO_ANIMATION").padEnd(32)}Skip the animated banner
    ${"GITHUB_TOKEN / GH_TOKEN".padEnd(32)}Raise GitHub download rate limits

  ${dim(HOMEPAGE_URL)}
`;
}

async function pickSkills(skills: SkillEntry[], registry: Registry | null, yes: boolean): Promise<SkillEntry[] | null> {
  if (yes) {
    printSkillList(skills, registry);
    return skills;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const fresh = skills.filter((s) => !s.installed);
    printSkillList(fresh, registry);
    log(dim("   No interactive terminal: installing new and changed skills. Pass -y to reinstall everything."));
    log();
    return fresh;
  }

  const installed = skills.filter((s) => s.installed).length;
  log(cyan("   ◆ ") + bold("Select skills to install ") + dim(`(${countSummary(skills).replace(/^(\d+)/, "$1 found")})`));
  log();

  const width = labelWidth(skills, registry);
  const picked = await multiSelect(skills, {
    label: (s) => skillLine(s, registry, width),
    hint: (s) => (s.sources.length > 1 ? sourceHint(s) : ""),
    group: (s) => s.sources[0],
    initial: skills.map((s) => !s.installed),
    shortcuts:
      installed > 0
        ? [
            { key: "n", label: "new & updates", select: (items) => items.map((s) => !s.installed) },
            { key: "i", label: "installed", select: (items) => items.map((s) => s.installed) },
          ]
        : [],
  });
  if (picked) log(dim(`   ${picked.length} selected`));
  return picked;
}

function chooseProgress(skills: SkillEntry[], verbose: boolean): Progress & { trace?: (s: string, m: string) => void } {
  if (verbose) return verboseProgress();
  const rows = process.stdout.rows || 0;
  if (process.stdout.isTTY && skills.length + 6 < rows) return liveProgress(skills);
  return lineProgress();
}

export async function main(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): Promise<number> {
  const args = parseArgs(argv);
  const version = getVersion();

  if (args.unknown.length > 0) {
    log(red(`\n   Unknown option${args.unknown.length > 1 ? "s" : ""}: ${args.unknown.join(" ")}`));
    log(helpText());
    return 1;
  }
  if (args.help) {
    log(helpText());
    return 0;
  }
  if (args.version) {
    log(version);
    return 0;
  }
  if (args.clearCache) {
    const { dir, removed } = clearCache();
    log(removed ? green(`   ✔ Cleared cache: ${dir}`) : dim(`   No cache found at ${dir}`));
    return 0;
  }

  await printBanner(version);
  const projectDir = resolve(cwd);

  const tty = Boolean(process.stdout.isTTY);
  if (tty) write(dim("   Scanning project...\r"));
  const { detected, isFrontend, workspaces } = detectProject(projectDir);
  if (tty) write("\x1b[K");

  const registry = loadRegistry();
  if (!registry) {
    log(red("   ✘ The skill registry manifest is missing. Reinstall the package and try again."));
    return 1;
  }

  // Which skills apply comes from each skill's stack-any / stack-all in the registry.
  // Installed = in skills-lock.json AND the files are still on disk (see install/status.ts).
  const local = localSkillState(projectDir, registry);
  const skills = collectSkills({
    detected,
    isFrontend,
    registry,
    installedNames: local.installed,
    outdatedNames: local.outdated,
  });

  // "*" skills match every folder, so only stop early when nothing at all applies.
  if (detected.length === 0 && !isFrontend && skills.length === 0) {
    log(yellow("   ⚠ No supported technologies detected."));
    log(dim("   Run this from your project's root folder."));
    log();
    return 0;
  }
  printDetected({
    detected,
    withSkills: technologiesWithSkills(registry),
    combos: combosOf(skills),
    isFrontend,
    workspaces: workspaces.length,
  });
  if (skills.length === 0) {
    log(yellow("   No skills for your stack yet."));
    log(dim(`   Check ${HOMEPAGE_URL} for new ones.`));
    log();
    return 0;
  }

  const { agents, unknown } = chooseAgents(args.agents);
  if (unknown.length > 0) {
    log(yellow(`   ⚠ Unknown agent${unknown.length > 1 ? "s" : ""} ignored: ${unknown.join(", ")}`));
    log(dim(`     Known agents: ${AGENTS.map((a) => a.id).join(", ")}`));
    log();
  }
  const agentList = agents.map((a) => a.id).join(", ");

  if (args.dryRun) {
    printSkillList(skills, registry);
    log(dim(`   Agents: ${agentList}`));
    log(dim("   --dry-run: nothing was installed."));
    log();
    return 0;
  }

  const selected = await pickSkills(skills, registry, args.yes);
  if (selected === null) {
    log(dim("\n   Cancelled."));
    return 130;
  }
  if (selected.length === 0) {
    log(dim("   Nothing selected."));
    log();
    return 0;
  }

  log();
  log(cyan("   ◆ ") + bold("Installing skills..."));
  log(dim(`   Agents: ${agentList}`));
  log();

  const progress = chooseProgress(selected, args.verbose);
  const started = Date.now();
  let results: InstallResult[];
  try {
    results = await installAll(
      selected,
      agents,
      { projectDir, registry, concurrency: args.verbose ? 1 : 6, trace: progress.trace },
      { onStart: (s) => progress.start(s), onDone: (s, r) => progress.done(s, r) },
    );
  } finally {
    progress.stop();
  }
  const elapsed = Date.now() - started;

  const cleanup = cleanupClaudeMd(projectDir);
  if (cleanup.cleaned) {
    log();
    log(dim(cleanup.deleted ? "   Removed the old skills section from CLAUDE.md (file was empty, deleted)." : "   Removed the old skills section from CLAUDE.md."));
  }

  log();
  printSecurityTable(results.filter((r) => r.ok).map((r) => r.name), registry);
  printSummary(results, elapsed, args.verbose);
  return results.every((r) => r.ok) ? 0 : 1;
}

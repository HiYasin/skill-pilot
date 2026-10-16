import { bold, cyan, dim, green, log, magenta, padVisible, red, yellow } from "../colors.ts";
import type { Technology } from "../catalog/types.ts";
import { ISSUES_URL } from "../constants.ts";
import type { InstallResult } from "../install/installer.ts";
import type { Registry } from "../install/manifest.ts";
import type { SkillEntry } from "../resolve.ts";
import { formatTime, plural, skillLabel, wrapText } from "./format.ts";

const SECURITY_TAG = " (review ⚠)";
const INSTALLED_TAG = " (installed)";
const UPDATE_TAG = " (update)";

export interface DetectedSummary {
  detected: Technology[];
  /** Technology ids that have at least one skill of their own. */
  withSkills: Set<string>;
  /** Combo names that matched ("NestJS + Prisma"). */
  combos: string[];
  isFrontend: boolean;
  workspaces: number;
}

export function printDetected({ detected, withSkills, combos, isFrontend, workspaces }: DetectedSummary): void {
  if (detected.length > 0) {
    const where = workspaces > 0 ? dim(` (root + ${plural(workspaces, "workspace")})`) : "";
    log(cyan("   ◆ ") + bold("Detected technologies") + where);
    log();
    // Technologies with skills first, the rest dimmed.
    const has = (t: Technology): boolean => withSkills.has(t.id);
    const ordered = [...detected.filter(has), ...detected.filter((t) => !has(t))];
    const width = Math.max(...ordered.map((t) => t.name.length)) + 3;
    const cell = (t: Technology): string =>
      has(t) ? `${green("✔")} ${t.name.padEnd(width)}` : `${dim("●")} ${dim(t.name.padEnd(width))}`;
    for (let i = 0; i < ordered.length; i += 3) {
      log("     " + ordered.slice(i, i + 3).map(cell).join(""));
    }
    log();
  }

  if (combos.length > 0) {
    log(magenta("   ◆ ") + bold("Detected combos"));
    log();
    for (const combo of combos) log(magenta("     ⚡ ") + combo);
    log();
  }

  if (isFrontend && detected.length === 0) {
    log(cyan("   ◆ ") + bold("Web frontend detected ") + dim("(from project files)"));
    log();
  }
}

function statusTag(skill: SkillEntry): { plain: string; styled: string } {
  if (skill.installed) return { plain: INSTALLED_TAG, styled: dim(INSTALLED_TAG) };
  if (skill.outdated) return { plain: UPDATE_TAG, styled: cyan(UPDATE_TAG) };
  return { plain: "", styled: "" };
}

/** Skill line used by the picker, the `-y` list and `--dry-run`. */
export function skillLine(skill: SkillEntry, registry: Registry | null, labelWidth: number): string {
  const flagged = registry?.skills[skill.name]?.review.status === "flagged";
  const tag = statusTag(skill);
  const plain = skillLabel(skill.path) + tag.plain + (flagged ? SECURITY_TAG : "");
  const styled = skillLabel(skill.path, true) + tag.styled + (flagged ? yellow(SECURITY_TAG) : "");
  return styled + " ".repeat(Math.max(0, labelWidth - plain.length));
}

export function labelWidth(skills: SkillEntry[], registry: Registry | null): number {
  return Math.max(
    0,
    ...skills.map(
      (s) =>
        skillLabel(s.path).length +
        statusTag(s).plain.length +
        (registry?.skills[s.name]?.review.status === "flagged" ? SECURITY_TAG.length : 0),
    ),
  );
}

/** "(12, 3 already installed, 1 to update)" style counts. */
export function countSummary(skills: SkillEntry[]): string {
  const installed = skills.filter((s) => s.installed).length;
  const outdated = skills.filter((s) => s.outdated).length;
  const parts = [`${skills.length}`];
  if (installed > 0) parts.push(`${installed} already installed`);
  if (outdated > 0) parts.push(`${outdated} to update`);
  return parts.join(", ");
}

export function sourceHint(skill: SkillEntry): string {
  return skill.sources.length > 0 ? `← ${skill.sources.join(", ")}` : "";
}

export function printSkillList(skills: SkillEntry[], registry: Registry | null): void {
  log(cyan("   ◆ ") + bold("Skills to install ") + dim(`(${countSummary(skills)})`));
  log();
  const width = labelWidth(skills, registry);
  skills.forEach((skill, i) => {
    log(dim(`   ${String(i + 1).padStart(2)}.`) + ` ${skillLine(skill, registry, width)}  ${dim(sourceHint(skill))}`);
  });
  log();
}

/** Table of skills whose registry review left findings, shown after install. */
export function printSecurityTable(names: string[], registry: Registry | null): void {
  const rows = names
    .map((name) => ({ name, review: registry?.skills[name]?.review }))
    .filter((r) => r.review && r.review.status !== "approved" && r.review.flags.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length === 0) return;

  const nameWidth = Math.min(32, Math.max(5, ...rows.map((r) => r.name.length)));
  const findingsWidth = Math.max(36, (process.stdout.columns || 100) - nameWidth - 12);

  log(cyan("   ◆ ") + bold("Review findings"));
  log();
  log(dim(`   ${"Skill".padEnd(nameWidth)}  Findings`));
  for (const { name, review } of rows) {
    const text = [review!.summary, review!.flags.join("; ")].filter(Boolean).join(" ");
    const lines = wrapText(text, findingsWidth);
    log(`   ${padVisible(yellow(name.slice(0, nameWidth)), nameWidth)}  ${lines[0]}`);
    for (const line of lines.slice(1)) log(`   ${" ".repeat(nameWidth)}  ${line}`);
  }
  log();
}

export function printSummary(results: InstallResult[], elapsedMs: number, verbose: boolean): void {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  log();
  if (failed.length === 0) {
    log(green(bold(`   ✔ Done! ${plural(ok, "skill")} installed in ${formatTime(elapsedMs)}.`)));
    log();
    return;
  }

  log(yellow(`   Done: ${green(`${ok} installed`)}, ${red(`${failed.length} failed`)} in ${formatTime(elapsedMs)}.`));
  log();
  log(bold(red("   Errors:")));
  for (const result of failed) {
    log(red(`     ✘ ${result.name}`));
    log(dim(`       ${result.error ?? "unknown error"}`));
    if (verbose) for (const line of result.details.slice(-20)) log(dim(`         ${line}`));
  }
  log();
  if (!verbose) log(dim("   Run again with --verbose for the full trace."));
  log(dim(`   Looks like a bug? Open an issue: ${ISSUES_URL}`));
  log();
}

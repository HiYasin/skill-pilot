import { cyan, gray, dim, bold } from "../colors.ts";
import { parseSkillPath } from "../resolve.ts";

export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** "owner/repo/skill" → "owner › skill" (plain) or the coloured version. */
export function skillLabel(path: string, styled = false): string {
  const { repo, name } = parseSkillPath(path);
  const owner = repo.split("/")[0];
  if (!owner) return styled ? cyan(name) : name;
  return styled ? `${dim(owner)} ${gray("›")} ${bold(cyan(name))}` : `${owner} › ${name}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Break text into lines no wider than `width`, splitting long words. */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (word.length > width) {
      if (line) lines.push(line);
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      line = "";
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

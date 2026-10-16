// Reads the YAML frontmatter at the top of a SKILL.md. Supports what the
// Agent Skills spec uses: top-level `key: value` scalars, folded/literal
// block scalars (`>` / `|`), comments, and the one-level `metadata:` map.
// Anything fancier (lists, anchors, nested maps) is ignored rather than guessed.

export interface Frontmatter {
  /** Top-level string fields: name, description, license, compatibility, ... */
  fields: Record<string, string>;
  /** `metadata:` map, string keys to string values. */
  metadata: Record<string, string>;
}

export class FrontmatterError extends Error {}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

/** Drop a trailing ` # comment` that is outside quotes. */
function stripComment(raw: string): string {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i).trimEnd();
    }
  }
  return raw;
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** Collect an indented block scalar starting at `start`; returns the text and the next line index. */
function blockScalar(lines: string[], start: number, style: string, parentIndent: number): [string, number] {
  const body: string[] = [];
  let i = start;
  while (i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > parentIndent)) {
    body.push(lines[i]);
    i++;
  }
  while (body.length > 0 && body.at(-1)!.trim() === "") body.pop();
  const minIndent = Math.min(...body.filter((l) => l.trim()).map(indentOf));
  const stripped = body.map((l) => l.slice(Number.isFinite(minIndent) ? minIndent : 0));
  const text = style.startsWith("|")
    ? stripped.join("\n")
    : stripped.join("\n").replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/\n\n/g, "\n");
  return [text.trim(), i];
}

/** Parse the frontmatter of a SKILL.md. Throws FrontmatterError when there is none. */
export function parseFrontmatter(markdown: string): Frontmatter {
  const text = markdown.replace(/^﻿/, "");
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) throw new FrontmatterError("SKILL.md must start with a --- frontmatter block");

  const lines = match[1].split(/\r?\n/);
  const result: Frontmatter = { fields: {}, metadata: {} };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#") || indentOf(line) > 0) {
      i++;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(line);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    const rest = stripComment(kv[2]).trim();

    if (key === "metadata" && rest === "") {
      i++;
      while (i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > 0)) {
        const child = lines[i];
        const ckv = /^\s+([A-Za-z0-9_.-]+)\s*:(.*)$/.exec(child);
        if (ckv && !child.trimStart().startsWith("#")) {
          const crest = stripComment(ckv[2]).trim();
          if (crest === ">" || crest === "|" || /^[>|][-+]?$/.test(crest)) {
            const [value, next] = blockScalar(lines, i + 1, crest, indentOf(child));
            result.metadata[ckv[1]] = value;
            i = next;
            continue;
          }
          result.metadata[ckv[1]] = unquote(crest);
        }
        i++;
      }
      continue;
    }

    if (/^[>|][-+]?$/.test(rest)) {
      const [value, next] = blockScalar(lines, i + 1, rest, 0);
      result.fields[key] = value;
      i = next;
      continue;
    }

    result.fields[key] = unquote(rest);
    i++;
  }
  return result;
}

/** Name rules from the Agent Skills spec. Returns a problem description, or null when valid. */
export function invalidSkillName(name: string): string | null {
  if (!name) return "name is missing";
  if (name.length > 64) return "name is longer than 64 characters";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return "name may only use lowercase letters, digits and single hyphens, and cannot start or end with a hyphen";
  }
  return null;
}

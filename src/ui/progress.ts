import {
  CLEAR_LINE,
  HIDE_CURSOR,
  SHOW_CURSOR,
  SPINNER_FRAMES,
  cursorUp,
  cyan,
  dim,
  green,
  log,
  red,
  write,
} from "../colors.ts";
import type { InstallResult, InstallSource } from "../install/installer.ts";
import type { SkillEntry } from "../resolve.ts";
import { skillLabel } from "./format.ts";

type RowState = "waiting" | "running" | "ok" | "failed";

const SOURCE_NOTE: Record<InstallSource, string> = {
  "up-to-date": "up to date",
  "local-registry": "local",
  cache: "cached",
  download: "downloaded",
};

export interface Progress {
  start(skill: SkillEntry): void;
  done(skill: SkillEntry, result: InstallResult): void;
  stop(): void;
}

function rowText(skill: SkillEntry, state: RowState, frame: number, result?: InstallResult): string {
  const label = skillLabel(skill.path, true);
  switch (state) {
    case "waiting":
      return `   ${dim("○")} ${label}`;
    case "running":
      return `   ${cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} ${label}`;
    case "ok":
      return `   ${green("✔")} ${label}  ${dim(result?.source ? SOURCE_NOTE[result.source] : "")}`;
    case "failed":
      return `   ${red("✘")} ${label}`;
  }
}

/**
 * Live rows with a spinner each, redrawn in place. Used only on a TTY tall
 * enough to hold every row; otherwise `lineProgress` prints one line per result.
 */
export function liveProgress(skills: SkillEntry[]): Progress {
  const states = new Map<string, RowState>(skills.map((s) => [s.name, "waiting"]));
  const results = new Map<string, InstallResult>();
  let frame = 0;
  let drawn = 0;

  const draw = (): void => {
    let out = cursorUp(drawn);
    for (const skill of skills) {
      out += `\r${CLEAR_LINE}${rowText(skill, states.get(skill.name)!, frame, results.get(skill.name))}\n`;
    }
    write(out);
    drawn = skills.length;
  };

  write(HIDE_CURSOR);
  draw();
  const timer = setInterval(() => {
    frame++;
    draw();
  }, 80);

  return {
    start(skill) {
      states.set(skill.name, "running");
    },
    done(skill, result) {
      states.set(skill.name, result.ok ? "ok" : "failed");
      results.set(skill.name, result);
    },
    stop() {
      clearInterval(timer);
      draw();
      write(SHOW_CURSOR);
    },
  };
}

/** Plain output for CI logs and short terminals: one line per finished skill. */
export function lineProgress(): Progress {
  return {
    start() {},
    done(skill, result) {
      log(rowText(skill, result.ok ? "ok" : "failed", 0, result));
    },
    stop() {},
  };
}

/** `--verbose`: a header per skill followed by its trace lines as they happen. */
export function verboseProgress(): Progress & { trace: (skill: string, message: string) => void } {
  return {
    start(skill) {
      log(`   ${cyan("→")} ${skillLabel(skill.path, true)}`);
    },
    trace(_skill, message) {
      log(dim(`       ${message}`));
    },
    done(skill, result) {
      log(rowText(skill, result.ok ? "ok" : "failed", 0, result));
    },
    stop() {},
  };
}

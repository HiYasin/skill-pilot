// All terminal output goes through `log` and `write` so tests can capture it
// and colour can be switched off in one place.

const enabled =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR));

export const colorEnabled = enabled;

/** 24-bit colour where the terminal says it supports it, otherwise the 256-colour palette. */
export function colorDepth(): 24 | 8 {
  const env = process.env;
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return 24;
  if (env.WT_SESSION || env.TERM_PROGRAM === "vscode" || env.TERM_PROGRAM === "iTerm.app") return 24;
  if (env.TERM_PROGRAM === "WezTerm" || env.TERM_PROGRAM === "ghostty" || env.TERM === "xterm-kitty") return 24;
  return 8;
}

export type Rgb = [number, number, number];

/** Nearest xterm-256 colour-cube index for an RGB colour. */
export function rgbTo256([r, g, b]: Rgb): number {
  const level = (v: number): number => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)));
  const [lr, lg, lb] = [level(r), level(g), level(b)];
  if (lr === lg && lg === lb) {
    const grey = Math.round(((r + g + b) / 3 - 8) / 10);
    if (grey >= 0 && grey <= 23) return 232 + grey;
  }
  return 16 + 36 * lr + 6 * lg + lb;
}

/** Colour text with an RGB value (no-op when colours are off). */
export function rgb(color: Rgb, text: string, depth: 24 | 8 = colorDepth()): string {
  if (!enabled) return text;
  const code = depth === 24 ? `38;2;${color[0]};${color[1]};${color[2]}` : `38;5;${rgbTo256(color)}`;
  return `\x1b[${code}m${text}\x1b[39m`;
}

const wrap =
  (open: string, close: string) =>
  (text: string): string =>
    enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text;

export const bold = wrap("1", "22");
export const dim = wrap("2", "22");
export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const magenta = wrap("35", "39");
export const cyan = wrap("36", "39");
export const white = wrap("97", "39");
export const gray = wrap("90", "39");

export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";
export const CLEAR_LINE = "\x1b[2K";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function cursorUp(lines: number): string {
  return lines > 0 ? `\x1b[${lines}A` : "";
}

export function write(text: string): void {
  process.stdout.write(text);
}

export function log(text = ""): void {
  process.stdout.write(text + "\n");
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

export function padVisible(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLength(text)));
}

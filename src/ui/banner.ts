import { META } from "../meta.ts";
import {
  HIDE_CURSOR,
  SHOW_CURSOR,
  bold,
  colorDepth,
  colorEnabled,
  cursorUp,
  dim,
  log,
  magenta,
  cyan,
  rgb,
  write,
  type Rgb,
} from "../colors.ts";
import { env } from "../constants.ts";
import { renderWordmark } from "./font.ts";

const INDENT = "   ";
const DARK: Rgb = [58, 60, 78];
const WHITE: Rgb = [255, 255, 255];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)) as Rgb;
}

/** Colour at position t (0–1) along the banner gradient. */
export function gradientAt(stops: Rgb[], t: number): Rgb {
  if (stops.length === 1) return stops[0];
  const scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[i], stops[i + 1], scaled - i);
}

/**
 * One frame of the light sweep. A diagonal front moves left to right: cells
 * behind it settle into the gradient, cells at the edge flash towards white,
 * cells ahead stay dim.
 */
export function renderFrame(lines: string[], stops: Rgb[], front: number, depth: 24 | 8): string[] {
  const width = Math.max(...lines.map((l) => l.length));
  const FADE = 6;
  return lines.map((line, row) =>
    [...line]
      .map((ch, col) => {
        if (ch === " ") return ch;
        const target = gradientAt(stops, width > 1 ? col / (width - 1) : 0);
        const distance = front - (col + row * 3);
        const settled = mix(DARK, target, distance / FADE);
        const glow = Math.max(0, 1 - Math.abs(distance - 1.5) / 2.5);
        return rgb(mix(settled, WHITE, glow * 0.75), ch, depth);
      })
      .join(""),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactBanner(version: string): void {
  log();
  log(`${INDENT}${bold(cyan("▲"))} ${bold(META.cliName)} ${dim(`v${version}`)}`);
  log(`${INDENT}${magenta(META.tagline)}`);
  log();
}

function subtitle(version: string, stops: Rgb[], depth: 24 | 8): string {
  const ver = colorEnabled ? rgb(stops[stops.length - 1], `v${version}`, depth) : `v${version}`;
  return `${INDENT}${dim(META.tagline)}  ${dim("·")}  ${ver}`;
}

export interface BannerOptions {
  /** Force the animation off (tests, CI, NO_ANIMATION). */
  animate?: boolean;
  columns?: number;
}

/**
 * Big gradient wordmark with a short light-sweep animation (about half a
 * second). Falls back to a static wordmark when output is not interactive,
 * and to a one-line banner when the terminal is too narrow.
 */
export async function printBanner(version: string, opts: BannerOptions = {}): Promise<void> {
  const lines = renderWordmark(META.wordmark);
  const width = Math.max(...lines.map((l) => l.length));
  const columns = opts.columns ?? (process.stdout.columns || 80);

  if (columns < width + INDENT.length + 2) {
    compactBanner(version);
    return;
  }

  const stops = META.gradient.map(hexToRgb);
  const depth = colorDepth();
  const animate =
    opts.animate ??
    (colorEnabled && Boolean(process.stdout.isTTY) && !process.env.CI && !env("NO_ANIMATION"));

  log();
  if (!animate) {
    const finished = colorEnabled ? renderFrame(lines, stops, Number.MAX_SAFE_INTEGER, depth) : lines;
    for (const line of finished) log(INDENT + line);
  } else {
    const travel = width + lines.length * 3 + 10;
    const frames = 32;
    write(HIDE_CURSOR);
    try {
      for (let f = 0; f <= frames; f++) {
        const front = (f / frames) * travel;
        const frame = f === frames ? renderFrame(lines, stops, Number.MAX_SAFE_INTEGER, depth) : renderFrame(lines, stops, front, depth);
        write((f > 0 ? cursorUp(lines.length) : "") + frame.map((l) => `\r${INDENT}${l}\x1b[K`).join("\n") + "\n");
        if (f < frames) await sleep(16);
      }
    } finally {
      write(SHOW_CURSOR);
    }
  }
  log();
  log(subtitle(version, stops, depth));
  log();
}

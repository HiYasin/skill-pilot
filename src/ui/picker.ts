import {
  CLEAR_LINE,
  HIDE_CURSOR,
  SHOW_CURSOR,
  bold,
  cursorUp,
  cyan,
  dim,
  green,
  white,
  write,
  yellow,
} from "../colors.ts";

export interface Shortcut<T> {
  key: string;
  label: string;
  /** Returns the new selection for every item. */
  select: (items: T[]) => boolean[];
}

export interface PickerOptions<T> {
  label: (item: T) => string;
  hint?: (item: T) => string;
  group?: (item: T) => string;
  initial: boolean[];
  shortcuts?: Shortcut<T>[];
}

export interface PickerState {
  cursor: number;
  selected: boolean[];
  offset: number;
  done: boolean;
  cancelled: boolean;
}

type Row = { kind: "group"; text: string } | { kind: "item"; index: number };

/** Items interleaved with group headings (headings only when there are 2+ groups). */
export function buildRows<T>(items: T[], group?: (item: T) => string): Row[] {
  const groups = group ? new Set(items.map(group)) : new Set<string>();
  const rows: Row[] = [];
  let last: string | undefined;
  items.forEach((item, index) => {
    if (group && groups.size > 1) {
      const g = group(item);
      if (g !== last) {
        rows.push({ kind: "group", text: g });
        last = g;
      }
    }
    rows.push({ kind: "item", index });
  });
  return rows;
}

/** Pure key handler, kept separate from the terminal so it can be unit tested. */
export function reducePicker<T>(
  state: PickerState,
  key: string,
  items: T[],
  shortcuts: Shortcut<T>[] = [],
): PickerState {
  const s = { ...state, selected: [...state.selected] };
  const last = items.length - 1;

  if (key === "\x03") return { ...s, done: true, cancelled: true };
  if (key === "\r" || key === "\n") return { ...s, done: true };
  if (key === "\x1b[A" || key === "k") s.cursor = s.cursor <= 0 ? last : s.cursor - 1;
  else if (key === "\x1b[B" || key === "j") s.cursor = s.cursor >= last ? 0 : s.cursor + 1;
  else if (key === " ") s.selected[s.cursor] = !s.selected[s.cursor];
  else if (key === "a") {
    const all = s.selected.every(Boolean);
    s.selected = s.selected.map(() => !all);
  } else {
    const shortcut = shortcuts.find((sc) => sc.key === key);
    if (shortcut) s.selected = shortcut.select(items);
  }
  return s;
}

/** Split a raw stdin chunk into keys, keeping escape sequences together. */
export function splitKeys(chunk: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < chunk.length; ) {
    if (chunk[i] === "\x1b" && chunk[i + 1] === "[" && i + 2 < chunk.length) {
      keys.push(chunk.slice(i, i + 3));
      i += 3;
    } else {
      keys.push(chunk[i]);
      i += 1;
    }
  }
  return keys;
}

/** Lines for the current state, scrolled so the cursor stays inside `height` rows. */
export function renderPicker<T>(
  state: PickerState,
  items: T[],
  opts: PickerOptions<T>,
  rows: Row[],
  height: number,
): { lines: string[]; offset: number } {
  const cursorRow = rows.findIndex((r) => r.kind === "item" && r.index === state.cursor);
  let offset = state.offset;
  if (cursorRow < offset) offset = Math.max(0, cursorRow - 1);
  if (cursorRow >= offset + height) offset = cursorRow - height + 1;
  offset = Math.min(offset, Math.max(0, rows.length - height));

  const lines: string[] = [];
  for (const row of rows.slice(offset, offset + height)) {
    if (row.kind === "group") {
      lines.push(`   ${bold(yellow(row.text))}`);
      continue;
    }
    const item = items[row.index];
    const active = row.index === state.cursor;
    const box = state.selected[row.index] ? green("◼") : dim("◻");
    const pointer = active ? cyan("❯") : " ";
    const hint = opts.hint?.(item);
    lines.push(`   ${pointer} ${box} ${opts.label(item)}${hint ? "  " + dim(hint) : ""}`);
  }

  const count = state.selected.filter(Boolean).length;
  const scroll = rows.length > height ? dim(`  (${offset + 1}-${Math.min(rows.length, offset + height)} of ${rows.length})`) : "";
  const keys = [
    `${white(bold("↑↓"))} move`,
    `${white(bold("space"))} toggle`,
    `${white(bold("a"))} all`,
    ...(opts.shortcuts ?? []).map((sc) => `${white(bold(sc.key))} ${sc.label}`),
    `${white(bold("enter"))} install ${count}`,
  ];
  lines.push("");
  lines.push(`   ${dim(keys.join(dim("  ·  ")))}${scroll}`);
  return { lines, offset };
}

/**
 * Interactive multi-select. Without a TTY (CI, pipes) it returns the initial
 * selection untouched.
 */
export function multiSelect<T>(items: T[], opts: PickerOptions<T>): Promise<T[] | null> {
  const initialPick = items.filter((_, i) => opts.initial[i]);
  if (!process.stdin.isTTY || !process.stdout.isTTY || items.length === 0) {
    return Promise.resolve(initialPick);
  }

  const rows = buildRows(items, opts.group);
  const height = Math.max(5, Math.min(rows.length, (process.stdout.rows || 24) - 8));
  let state: PickerState = { cursor: 0, selected: [...opts.initial], offset: 0, done: false, cancelled: false };
  let drawn = 0;

  const draw = (): void => {
    const { lines, offset } = renderPicker(state, items, opts, rows, height);
    state.offset = offset;
    let out = cursorUp(drawn);
    for (const line of lines) out += `\r${CLEAR_LINE}${line}\n`;
    write(out);
    drawn = lines.length;
  };

  return new Promise((resolvePromise) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    write(HIDE_CURSOR);
    draw();

    const finish = (): void => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      // Collapse the list so the install output starts right below the header.
      let out = cursorUp(drawn);
      for (let i = 0; i < drawn; i++) out += `\r${CLEAR_LINE}\n`;
      out += cursorUp(drawn);
      write(out + SHOW_CURSOR);
      resolvePromise(state.cancelled ? null : items.filter((_, i) => state.selected[i]));
    };

    const onData = (chunk: string): void => {
      for (const key of splitKeys(chunk)) {
        state = reducePicker(state, key, items, opts.shortcuts);
        if (state.done) return finish();
      }
      draw();
    };

    stdin.on("data", onData);
  });
}

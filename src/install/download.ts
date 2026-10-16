import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { CLI_NAME, GITHUB_REPO, env, getVersion } from "../constants.ts";
import { removePath, verifyDir } from "./files.ts";
import { sha256 } from "./hash.ts";
import type { RegistryEntry } from "./manifest.ts";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 20_000;

/**
 * Where skill files are downloaded from, in order. Every byte is checked
 * against the manifest, so a mirror can never change what gets installed.
 */
export function registryBaseUrls(version: string = getVersion()): string[] {
  const override = env("REGISTRY_BASE_URL");
  if (override) return [override.replace(/\/+$/, "")];
  return [
    `https://raw.githubusercontent.com/${GITHUB_REPO}/v${version}/registry/skills`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@v${version}/registry/skills`,
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/registry/skills`,
  ];
}

function headersFor(url: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": `${CLI_NAME}/${getVersion()}` };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  // The token only ever goes to GitHub's raw file host.
  if (token && /(^|\.)githubusercontent\.com$/i.test(new URL(url).hostname)) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function fileUrl(base: string, skillName: string, rel: string): string {
  return [base, encodeURIComponent(skillName), ...rel.split("/").map(encodeURIComponent)].join("/");
}

/** Fetch one file from the first base URL that returns the expected bytes. */
async function fetchVerified(
  skillName: string,
  rel: string,
  expected: string,
  bases: string[],
  fetchImpl: FetchLike,
  trace: (msg: string) => void,
): Promise<Buffer> {
  const problems: string[] = [];
  for (const base of bases) {
    const url = fileUrl(base, skillName, rel);
    try {
      const res = await fetchImpl(url, { headers: headersFor(url), signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        problems.push(`${res.status} from ${new URL(url).host}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (sha256(buf) !== expected) {
        problems.push(`hash mismatch from ${new URL(url).host}`);
        continue;
      }
      trace(`fetched ${rel} from ${new URL(url).host}`);
      return buf;
    } catch (err) {
      problems.push(`${(err as Error).message} (${new URL(url).host})`);
    }
  }
  throw new Error(`could not download ${rel}: ${problems.join("; ")}`);
}

/**
 * Download every file of a skill into `destDir`, writing to a temporary
 * sibling first and renaming at the end so a half-finished download never
 * looks complete.
 */
export async function downloadSkill(
  skillName: string,
  entry: RegistryEntry,
  destDir: string,
  opts: { fetchImpl?: FetchLike; bases?: string[]; trace?: (msg: string) => void } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
  const bases = opts.bases ?? registryBaseUrls();
  const trace = opts.trace ?? (() => {});
  const tmp = `${destDir}.tmp-${process.pid}-${Date.now()}`;

  try {
    const buffers = await Promise.all(
      entry.files.map(async (rel) => ({
        rel,
        buf: await fetchVerified(skillName, rel, entry.sha256[rel], bases, fetchImpl, trace),
      })),
    );
    for (const { rel, buf } of buffers) {
      const target = join(tmp, ...rel.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buf);
    }
    const check = verifyDir(tmp, entry);
    if (!check.ok) throw new Error(`downloaded files failed verification: ${check.reason}`);
    removePath(destDir);
    mkdirSync(dirname(destDir), { recursive: true });
    renameSync(tmp, destDir);
  } finally {
    removePath(tmp);
  }
}

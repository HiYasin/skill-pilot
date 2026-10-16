import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

/**
 * One hash for a whole skill: SHA-256 over sorted "relative/path:filehash"
 * lines. Identical content always gives the same bundle hash, so it doubles as
 * the cache key.
 */
export function bundleHash(fileHashes: Record<string, string>): string {
  const lines = Object.entries(fileHashes)
    .map(([rel, hash]) => `${rel.split("\\").join("/")}:${hash}\n`)
    .sort()
    .join("");
  return sha256(lines);
}

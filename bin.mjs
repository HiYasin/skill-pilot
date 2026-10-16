#!/usr/bin/env node
// Entry point published to npm. Keep this file plain JavaScript so the
// version check below runs on any Node release, even very old ones.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIN = [22, 6];
const [major, minor] = process.versions.node.split(".").map(Number);
const here = dirname(fileURLToPath(import.meta.url));

if (major < MIN[0] || (major === MIN[0] && minor < MIN[1])) {
  let name = "This tool";
  try {
    name = JSON.parse(readFileSync(join(here, "package.json"), "utf-8")).name || name;
  } catch {}
  console.error(
    `\n  ${name} needs Node.js >= ${MIN.join(".")}.0 (you have ${process.version}).` +
      `\n  Upgrade from https://nodejs.org and run it again.\n`,
  );
  process.exit(1);
}

const built = join(here, "dist", "cli.js");

if (existsSync(built)) {
  await import(pathToFileURL(built).href);
} else {
  // Development checkout without a build: run the TypeScript sources directly.
  const { spawn } = await import("node:child_process");
  const child = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      join(here, "src", "cli.ts"),
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

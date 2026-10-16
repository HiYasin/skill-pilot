import { ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, type TestContext } from "node:test";

import { stripAnsi } from "../src/colors.ts";
import { envName } from "../src/constants.ts";
import { tmpDir, writeFile, writePackageJson } from "./helpers.ts";

const BIN = fileURLToPath(new URL("../bin.mjs", import.meta.url));

function run(t: TestContext, cwd: string, args: string[], home?: string): { code: number; out: string } {
  const fakeHome = home ?? tmpDir(t, "sp-home-");
  const res = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      [envName("CACHE_DIR")]: join(fakeHome, "cache"),
      [envName("NO_ANIMATION")]: "1",
      NO_COLOR: "1",
    },
    timeout: 60_000,
  });
  return { code: res.status ?? -1, out: stripAnsi((res.stdout ?? "") + (res.stderr ?? "")) };
}

describe("cli", () => {
  it("prints help and version", (t) => {
    const dir = tmpDir(t);
    const help = run(t, dir, ["--help"]);
    strictEqual(help.code, 0);
    ok(help.out.includes("--dry-run"));
    ok(/^\d+\.\d+\.\d+/.test(run(t, dir, ["--version"]).out.trim()));
  });

  it("rejects unknown options", (t) => {
    const res = run(t, tmpDir(t), ["--bogus"]);
    strictEqual(res.code, 1);
    ok(res.out.includes("Unknown option"));
  });

  it("exits cleanly when nothing is detected", (t) => {
    const res = run(t, tmpDir(t), []);
    strictEqual(res.code, 0);
    ok(res.out.includes("No supported technologies"));
  });

  it("lists skills with --dry-run and writes nothing", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { next: "15", react: "19", "@prisma/client": "6" });
    const res = run(t, dir, ["--dry-run"]);
    strictEqual(res.code, 0, res.out);
    ok(res.out.includes("Next.js"));
    ok(res.out.includes("Next.js + Prisma"));
    ok(res.out.includes("nextjs-app-router"));
    ok(res.out.includes("frontend-design"));
    ok(res.out.includes("Agents: universal"));
    strictEqual(existsSync(join(dir, ".agents")), false);
  });

  it("installs with -y for detected agents and marks them installed on the next run", (t) => {
    const dir = tmpDir(t);
    const home = tmpDir(t, "sp-home-");
    writeFile(home, ".claude/skills/.keep", "");
    writePackageJson(dir, { express: "5" }, { devDependencies: { typescript: "5" } });

    const first = run(t, dir, ["-y"], home);
    strictEqual(first.code, 0, first.out);
    ok(first.out.includes("Done!"));
    ok(existsSync(join(dir, ".agents/skills/express-api-design/SKILL.md")));
    ok(existsSync(join(dir, ".claude/skills/express-api-design/SKILL.md")));
    const lock = JSON.parse(readFileSync(join(dir, "skills-lock.json"), "utf-8"));
    ok(lock.skills["typescript-strict-patterns"]);

    const second = run(t, dir, ["--dry-run"], home);
    ok(second.out.includes("(installed)"));
  });

  it("does not report deleted skills as installed, and offers edited ones as updates", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { express: "5" }, { devDependencies: { typescript: "5" } });
    strictEqual(run(t, dir, ["-y"]).code, 0);

    // The user deletes the skills folder but skills-lock.json stays behind.
    rmSync(join(dir, ".agents"), { recursive: true });
    const afterDelete = run(t, dir, ["--dry-run"]);
    ok(!afterDelete.out.includes("(installed)"), afterDelete.out);
    ok(afterDelete.out.includes("Skills to install (2)"));

    // Reinstall without -y (no TTY in tests): deleted skills count as new and come back.
    const reinstall = run(t, dir, []);
    strictEqual(reinstall.code, 0, reinstall.out);
    ok(existsSync(join(dir, ".agents/skills/express-api-design/SKILL.md")));

    // Editing an installed skill marks it as an update.
    writeFile(dir, ".agents/skills/express-api-design/SKILL.md", "my local edit");
    const afterEdit = run(t, dir, ["--dry-run"]);
    ok(afterEdit.out.includes("express-api-design (update)"), afterEdit.out);
    ok(afterEdit.out.includes("1 already installed, 1 to update"));
  });

  it("warns about unknown agents passed with -a", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { express: "5" });
    const res = run(t, dir, ["--dry-run", "-a", "cursor", "cline"]);
    ok(res.out.includes("Unknown agent ignored: cursor"));
    ok(res.out.includes("Agents: universal, cline"));
  });
});

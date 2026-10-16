import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { parseArgs } from "../src/args.ts";

describe("parseArgs", () => {
  it("reads boolean flags in short and long form", () => {
    const a = parseArgs(["-y", "--dry-run", "-v", "--clear-cache"]);
    strictEqual(a.yes, true);
    strictEqual(a.dryRun, true);
    strictEqual(a.verbose, true);
    strictEqual(a.clearCache, true);
    strictEqual(a.help, false);
    deepStrictEqual(a.unknown, []);
  });

  it("collects agent ids until the next flag", () => {
    const a = parseArgs(["-a", "claude-code", "cline", "-y"]);
    deepStrictEqual(a.agents, ["claude-code", "cline"]);
    strictEqual(a.yes, true);
  });

  it("accepts --agent=a,b and removes duplicates", () => {
    deepStrictEqual(parseArgs(["--agent=cline,kiro-cli", "--agent", "cline"]).agents, ["cline", "kiro-cli"]);
  });

  it("reports unknown options", () => {
    deepStrictEqual(parseArgs(["--nope", "-h"]).unknown, ["--nope"]);
  });
});

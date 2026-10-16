import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { checkTargets, emptyTargets, parseTargetList, suggestId } from "../src/targets.ts";

const ids = ["nextjs", "react", "postgresql", "prisma", "nestjs"];

describe("parseTargetList", () => {
  it("accepts comma strings and arrays, trims and removes duplicates", () => {
    deepStrictEqual(parseTargetList(" nextjs, react ,nextjs,"), ["nextjs", "react"]);
    deepStrictEqual(parseTargetList(["a", " b "]), ["a", "b"]);
    deepStrictEqual(parseTargetList(undefined), []);
    deepStrictEqual(parseTargetList(""), []);
  });
});

describe("checkTargets", () => {
  it("accepts known ids and the special targets", () => {
    deepStrictEqual(checkTargets({ any: ["react", "web-frontend", "*"], all: [] }, ids), []);
    deepStrictEqual(checkTargets({ any: [], all: ["nestjs", "prisma"] }, ids), []);
  });

  it("reports missing targets", () => {
    ok(emptyTargets({ any: [], all: [] }));
    ok(checkTargets({ any: [], all: [] }, ids)[0].includes('no "stack-any" or "stack-all"'));
  });

  it("suggests the closest id for typos", () => {
    const [problem] = checkTargets({ any: ["postgres"], all: [] }, ids);
    ok(problem.includes('unknown technology "postgres"'));
    ok(problem.includes('did you mean "postgresql"'));
    strictEqual(suggestId("nextj", ids), "nextjs");
    strictEqual(suggestId("kubernetes", ids), null);
  });

  it("points to technologies.ts when nothing is close", () => {
    ok(checkTargets({ any: ["bullmq"], all: [] }, ids)[0].includes("src/catalog/technologies.ts"));
  });

  it('rejects "*" in stack-all', () => {
    ok(checkTargets({ any: [], all: ["*"] }, ids).some((p) => p.includes("only makes sense in stack-any")));
  });
});

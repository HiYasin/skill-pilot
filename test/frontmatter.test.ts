import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";

import { FrontmatterError, invalidSkillName, parseFrontmatter } from "../scripts/lib/frontmatter.ts";

describe("parseFrontmatter", () => {
  it("reads scalars, quotes, comments and the metadata map", () => {
    const fm = parseFrontmatter(`---
name: redis-caching   # the folder name
description: "Cache data: safely, with Redis."
license: 'MIT'
metadata:
  stack-any: redis, nodejs
  stack-all: ""      # none
  author: yasin
---
# Body
`);
    deepStrictEqual(fm.fields, { name: "redis-caching", description: "Cache data: safely, with Redis.", license: "MIT" });
    deepStrictEqual(fm.metadata, { "stack-any": "redis, nodejs", "stack-all": "", author: "yasin" });
  });

  it("joins folded descriptions and keeps literal ones", () => {
    const fm = parseFrontmatter(`---
name: x
description: >
  First line
  continues here.
notes: |
  line one
  line two
metadata:
  stack-any: react
---
`);
    strictEqual(fm.fields.description, "First line continues here.");
    strictEqual(fm.fields.notes, "line one\nline two");
    strictEqual(fm.metadata["stack-any"], "react");
  });

  it("handles Windows line endings and a byte-order mark", () => {
    const fm = parseFrontmatter("﻿---\r\nname: x\r\nmetadata:\r\n  stack-any: react\r\n---\r\nbody");
    strictEqual(fm.fields.name, "x");
    strictEqual(fm.metadata["stack-any"], "react");
  });

  it("throws when there is no frontmatter", () => {
    throws(() => parseFrontmatter("# Just markdown"), FrontmatterError);
  });
});

describe("invalidSkillName", () => {
  it("follows the Agent Skills naming rules", () => {
    strictEqual(invalidSkillName("redis-caching"), null);
    strictEqual(invalidSkillName("v2-api"), null);
    for (const bad of ["Redis", "-redis", "redis-", "redis--cache", "redis_cache", "", "a".repeat(65)]) {
      strictEqual(typeof invalidSkillName(bad), "string", bad);
    }
  });
});

import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { detectProject } from "../src/detect/index.ts";
import { parseGradleIncludes } from "../src/detect/layouts.ts";
import { denoImportNames } from "../src/detect/manifests.ts";
import { parseJsonc } from "../src/detect/fs-utils.ts";
import { parsePnpmWorkspace } from "../src/detect/workspaces.ts";
import { tmpDir, writeFile, writeJson, writePackageJson } from "./helpers.ts";

const ids = (dir: string): string[] => detectProject(dir).detected.map((t) => t.id);

describe("detection: npm and deno", () => {
  it("detects technologies from every dependency field", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { next: "15.0.0", react: "19.0.0" }, { devDependencies: { typescript: "5.8.0", vitest: "3.0.0" } });
    const found = ids(dir);
    for (const id of ["react", "nextjs", "typescript", "vitest"]) ok(found.includes(id), id);
  });

  it("matches package-name patterns", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { "@clerk/nextjs": "6.0.0" });
    ok(ids(dir).includes("clerk"));
  });

  it("reads deno.jsonc import maps with npm: and jsr: specifiers", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "deno.jsonc", `{
      // comment
      "imports": { "hono": "jsr:@hono/hono@4", "react": "npm:react@19", },
    }`);
    const found = ids(dir);
    ok(found.includes("deno"));
    ok(found.includes("hono"));
    ok(found.includes("react"));
  });

  it("parses deno import names", () => {
    deepStrictEqual(
      denoImportNames({ imports: { "@std/path": "jsr:@std/path@^1", x: "npm:zod@3" } }).sort(),
      ["@std/path", "x", "zod"],
    );
  });

  it("strips comments and trailing commas from JSONC", () => {
    deepStrictEqual(parseJsonc('{ "a": "http://x", /* c */ "b": [1,], }'), { a: "http://x", b: [1] });
  });
});

describe("detection: files and content", () => {
  it("detects config files", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "Dockerfile", "FROM node:22");
    writeFile(dir, "nest-cli.json", "{}");
    const found = ids(dir);
    ok(found.includes("docker"));
    ok(found.includes("nestjs"));
  });

  it("finds file extensions a few folders deep but not in node_modules", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "infra/env/prod/main.tf", "");
    ok(ids(dir).includes("terraform"));

    const other = tmpDir(t);
    writeFile(other, "node_modules/pkg/main.tf", "");
    writeFile(other, "package.json", "{}");
    ok(!ids(other).includes("terraform"));
  });

  it("reads gems from a Gemfile", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "Gemfile", "source 'https://rubygems.org'\ngem 'rails', '~> 8.0'\n");
    const found = ids(dir);
    ok(found.includes("rails"));
    ok(found.includes("ruby"));
  });

  it("matches patterns inside Python and PHP manifests", (t) => {
    const py = tmpDir(t);
    writeFile(py, "requirements.txt", "fastapi==0.115\nuvicorn\n");
    ok(ids(py).includes("fastapi"));
    ok(ids(py).includes("python"));

    const php = tmpDir(t);
    writeJson(php, "composer.json", { require: { "laravel/framework": "^12.0" } });
    ok(ids(php).includes("laravel"));
  });

  it("detects PostgreSQL from a Prisma schema provider", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "prisma/schema.prisma", 'datasource db {\n  provider = "postgresql"\n}\n');
    const found = ids(dir);
    ok(found.includes("prisma"));
    ok(found.includes("postgresql"));
  });
});

describe("detection: Gradle and .NET layouts", () => {
  it("parses settings.gradle includes", () => {
    deepStrictEqual(parseGradleIncludes('include(":app", ":feature:login")\ninclude \':core\''), ["app", "feature/login", "core"]);
  });

  it("follows settings.gradle modules to find Android", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "settings.gradle.kts", 'include(":mobile:app")');
    writeFile(dir, "mobile/app/build.gradle.kts", 'plugins { id("com.android.application") }');
    ok(ids(dir).includes("android"));
  });

  it("reads .csproj files two folders down", (t) => {
    const dir = tmpDir(t);
    writeFile(dir, "src/Api/Api.csproj", '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>');
    const found = ids(dir);
    ok(found.includes("dotnet"));
    ok(found.includes("aspnet-core"));
  });
});

describe("detection: monorepos, frontend and combos", () => {
  it("parses pnpm-workspace.yaml", () => {
    deepStrictEqual(parsePnpmWorkspace("packages:\n  - 'apps/*'\n  - packages/*\n  - '!**/test/**'\nother: 1\n"), ["apps/*", "packages/*"]);
  });

  it("scans pnpm workspaces and de-duplicates", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, { typescript: "5" });
    writeFile(dir, "pnpm-workspace.yaml", "packages:\n  - apps/*\n");
    writePackageJson(`${dir}/apps/web`, { next: "15", react: "19", typescript: "5" });
    writePackageJson(`${dir}/apps/api`, { "@nestjs/core": "11", "@prisma/client": "6" });
    const result = detectProject(dir);
    const found = result.detected.map((t) => t.id);
    for (const id of ["typescript", "nextjs", "react", "nestjs", "prisma"]) ok(found.includes(id), id);
    strictEqual(found.filter((id) => id === "typescript").length, 1);
    strictEqual(result.workspaces.length, 2);
    ok(result.isFrontend);
  });

  it("supports package.json workspaces in object form", (t) => {
    const dir = tmpDir(t);
    writePackageJson(dir, {}, { workspaces: { packages: ["packages/*"] } });
    writePackageJson(`${dir}/packages/ui`, { vue: "3" });
    ok(ids(dir).includes("vue"));
  });

  it("marks a frontend from Blade templates without frontend packages", (t) => {
    const dir = tmpDir(t);
    writeJson(dir, "composer.json", { require: {} });
    writeFile(dir, "resources/views/welcome.blade.php", "<html></html>");
    strictEqual(detectProject(dir).isFrontend, true);
  });

  it("reports nothing for an empty folder", (t) => {
    const result = detectProject(tmpDir(t));
    strictEqual(result.detected.length, 0);
    strictEqual(result.isFrontend, false);
  });
});

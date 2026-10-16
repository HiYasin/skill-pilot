import { join } from "node:path";

import { listDir, readText, shouldDescend } from "./fs-utils.ts";

const GRADLE_ROOT_FILES = [
  "build.gradle.kts",
  "build.gradle",
  "settings.gradle.kts",
  "settings.gradle",
  "gradle/libs.versions.toml",
];
const GRADLE_BUILD_FILES = ["build.gradle.kts", "build.gradle"];

const DOTNET_ROOT_FILES = [
  "global.json",
  "NuGet.Config",
  "Directory.Build.props",
  "Directory.Packages.props",
];
const DOTNET_PROJECT_EXTENSIONS = [".sln", ".slnx", ".csproj", ".fsproj"];

/**
 * Module paths from `include(":app", ":feature:login")` or `include ':app'`.
 * ":feature:login" becomes "feature/login".
 */
export function parseGradleIncludes(settings: string): string[] {
  const modules: string[] = [];
  const includeRe = /include\s*\(?([^)\n]*)/g;
  let include: RegExpExecArray | null;
  while ((include = includeRe.exec(settings)) !== null) {
    const quoted = /['"]([^'"]+)['"]/g;
    let q: RegExpExecArray | null;
    while ((q = quoted.exec(include[1])) !== null) {
      modules.push(q[1].replace(/^:/, "").replace(/:/g, "/"));
    }
  }
  return modules;
}

/** Every Gradle file worth reading: root files, each top-level subfolder, and each declared module. */
export function gradleCandidates(projectDir: string): string[] {
  const files = new Set<string>(GRADLE_ROOT_FILES.map((f) => join(projectDir, f)));

  for (const entry of listDir(projectDir)) {
    if (!shouldDescend(entry)) continue;
    for (const f of GRADLE_BUILD_FILES) files.add(join(projectDir, entry.name, f));
  }

  for (const settingsName of ["settings.gradle.kts", "settings.gradle"]) {
    const settings = readText(join(projectDir, settingsName));
    if (settings === null) continue;
    for (const module of parseGradleIncludes(settings)) {
      for (const f of GRADLE_BUILD_FILES) files.add(join(projectDir, module, f));
    }
    break;
  }

  return [...files];
}

/** Root .NET config files plus every solution/project file up to two folders down. */
export function dotNetCandidates(projectDir: string): string[] {
  const files = new Set<string>(DOTNET_ROOT_FILES.map((f) => join(projectDir, f)));

  const walk = (dir: string, depth: number): void => {
    for (const entry of listDir(dir)) {
      const lower = entry.name.toLowerCase();
      if (entry.isFile() && DOTNET_PROJECT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        files.add(join(dir, entry.name));
      } else if (depth < 2 && shouldDescend(entry)) {
        walk(join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(projectDir, 0);

  return [...files];
}

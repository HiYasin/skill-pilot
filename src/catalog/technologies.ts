import type { Technology } from "./types.ts";

/**
 * How the CLI recognises each technology. Order matters only for display.
 *
 * This file holds detection rules only. Which skills a technology gets is
 * declared by the skills themselves:
 *   - your skills:     `metadata.stack-any` / `stack-all` in skills-src/<name>/SKILL.md
 *   - upstream skills: skills-upstream.json
 * The `id` here is what those `stack-*` values refer to.
 *
 * A technology no skill targets yet is still detected and shown (dimmed),
 * so users see their stack is recognised.
 */
export const TECHNOLOGIES: Technology[] = [
  // ── Frameworks & UI ────────────────────────────────────────
  {
    id: "react",
    name: "React",
    detect: { packages: ["react", "react-dom"] },
  },
  {
    id: "nextjs",
    name: "Next.js",
    detect: {
      packages: ["next"],
      configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"],
    },
  },
  {
    id: "vue",
    name: "Vue",
    detect: { packages: ["vue"] },
  },
  {
    id: "nuxt",
    name: "Nuxt",
    detect: { packages: ["nuxt"], configFiles: ["nuxt.config.ts", "nuxt.config.js"] },
  },
  {
    id: "svelte",
    name: "Svelte",
    detect: { packages: ["svelte", "@sveltejs/kit"], configFiles: ["svelte.config.js"] },
  },
  {
    id: "angular",
    name: "Angular",
    detect: { packages: ["@angular/core"], configFiles: ["angular.json"] },
  },
  {
    id: "astro",
    name: "Astro",
    detect: {
      packages: ["astro"],
      configFiles: ["astro.config.mjs", "astro.config.ts", "astro.config.js"],
    },
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    detect: {
      packages: ["tailwindcss", "@tailwindcss/vite", "@tailwindcss/postcss"],
      configFiles: ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"],
    },
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    detect: { configFiles: ["components.json"] },
  },
  {
    id: "tanstack-query",
    name: "TanStack Query",
    detect: { packages: ["@tanstack/react-query", "@tanstack/vue-query"] },
  },
  {
    id: "react-hook-form",
    name: "React Hook Form",
    detect: { packages: ["react-hook-form"] },
  },
  {
    id: "zod",
    name: "Zod",
    detect: { packages: ["zod"] },
  },

  // ── Mobile & desktop ───────────────────────────────────────
  {
    id: "react-native",
    name: "React Native",
    detect: { packages: ["react-native"] },
  },
  {
    id: "expo",
    name: "Expo",
    detect: { packages: ["expo"] },
  },
  {
    id: "electron",
    name: "Electron",
    detect: { packages: ["electron"] },
  },
  {
    id: "tauri",
    name: "Tauri",
    detect: { packages: ["@tauri-apps/api", "@tauri-apps/cli"], configFiles: ["src-tauri/tauri.conf.json"] },
  },
  {
    id: "flutter",
    name: "Flutter",
    detect: { configFileContent: { files: ["pubspec.yaml"], patterns: ["flutter:"] } },
  },
  {
    id: "swift",
    name: "Swift",
    detect: { configFiles: ["Package.swift"], fileExtensions: [".swift"] },
  },
  {
    id: "android",
    name: "Android",
    detect: {
      configFileContent: {
        scanGradleLayout: true,
        patterns: ["com.android.application", "com.android.library", "android {"],
      },
    },
  },
  {
    id: "kotlin-multiplatform",
    name: "Kotlin Multiplatform",
    detect: {
      configFileContent: {
        scanGradleLayout: true,
        patterns: ['kotlin("multiplatform")', "org.jetbrains.kotlin.multiplatform", "kotlinMultiplatform"],
      },
    },
  },

  // ── Languages & runtimes ───────────────────────────────────
  {
    id: "typescript",
    name: "TypeScript",
    detect: { packages: ["typescript"], configFiles: ["tsconfig.json"] },
  },
  {
    id: "nodejs",
    name: "Node.js",
    detect: {
      packages: ["@types/node"],
      configFiles: [".nvmrc", ".node-version"],
    },
  },
  {
    id: "bun",
    name: "Bun",
    detect: { packages: ["@types/bun", "bun-types"], configFiles: ["bun.lock", "bun.lockb", "bunfig.toml"] },
  },
  {
    id: "deno",
    name: "Deno",
    detect: { configFiles: ["deno.json", "deno.jsonc"] },
  },
  {
    id: "python",
    name: "Python",
    detect: { configFiles: ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "Pipfile"] },
  },
  {
    id: "django",
    name: "Django",
    detect: {
      configFiles: ["manage.py"],
      configFileContent: {
        files: ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"],
        patterns: ["django", "Django"],
      },
    },
  },
  {
    id: "fastapi",
    name: "FastAPI",
    detect: {
      configFileContent: {
        files: ["requirements.txt", "pyproject.toml", "Pipfile"],
        patterns: ["fastapi"],
      },
    },
  },
  {
    id: "flask",
    name: "Flask",
    detect: {
      configFileContent: {
        files: ["requirements.txt", "pyproject.toml", "Pipfile"],
        patterns: ["flask", "Flask"],
      },
    },
  },
  {
    id: "go",
    name: "Go",
    detect: { configFiles: ["go.mod"] },
  },
  {
    id: "rust",
    name: "Rust",
    detect: { configFiles: ["Cargo.toml"] },
  },
  {
    id: "ruby",
    name: "Ruby",
    detect: { configFiles: ["Gemfile", ".ruby-version"] },
  },
  {
    id: "rails",
    name: "Ruby on Rails",
    detect: { gems: ["rails"] },
  },
  {
    id: "php",
    name: "PHP",
    detect: { configFiles: ["composer.json"] },
  },
  {
    id: "laravel",
    name: "Laravel",
    detect: {
      configFiles: ["artisan"],
      configFileContent: { files: ["composer.json"], patterns: ["laravel/framework"] },
    },
  },
  {
    id: "spring-boot",
    name: "Spring Boot",
    detect: {
      configFileContent: [
        { files: ["pom.xml"], patterns: ["spring-boot"] },
        { scanGradleLayout: true, patterns: ["org.springframework.boot", "spring-boot"] },
      ],
    },
  },
  {
    id: "dotnet",
    name: ".NET",
    detect: {
      configFiles: ["global.json"],
      configFileContent: { scanDotNetLayout: true, patterns: ["Microsoft.NET.Sdk", "<Project"] },
    },
  },
  {
    id: "aspnet-core",
    name: "ASP.NET Core",
    detect: {
      configFileContent: {
        scanDotNetLayout: true,
        patterns: ["Microsoft.NET.Sdk.Web", "Microsoft.AspNetCore"],
      },
    },
  },

  // ── Backend & APIs ─────────────────────────────────────────
  {
    id: "express",
    name: "Express",
    detect: { packages: ["express"] },
  },
  {
    id: "nestjs",
    name: "NestJS",
    detect: { packages: ["@nestjs/core"], configFiles: ["nest-cli.json"] },
  },
  {
    id: "fastify",
    name: "Fastify",
    detect: { packages: ["fastify"] },
  },
  {
    id: "hono",
    name: "Hono",
    detect: { packages: ["hono"] },
  },

  // ── Data & storage ─────────────────────────────────────────
  {
    id: "prisma",
    name: "Prisma",
    detect: {
      packages: ["prisma", "@prisma/client"],
      configFiles: ["prisma/schema.prisma", "schema.prisma"],
    },
  },
  {
    id: "drizzle",
    name: "Drizzle ORM",
    detect: { packages: ["drizzle-orm"], configFiles: ["drizzle.config.ts", "drizzle.config.js"] },
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    detect: {
      packages: ["pg", "postgres", "@neondatabase/serverless", "@vercel/postgres"],
      configFileContent: [
        { files: ["prisma/schema.prisma", "schema.prisma"], patterns: ['provider = "postgresql"'] },
        {
          files: ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
          patterns: ["image: postgres", "image: \"postgres", "image: 'postgres"],
        },
      ],
    },
  },
  {
    id: "mongodb",
    name: "MongoDB",
    detect: { packages: ["mongodb", "mongoose", "@nestjs/mongoose"] },
  },
  {
    id: "redis",
    name: "Redis",
    detect: { packages: ["redis", "ioredis", "@upstash/redis"] },
  },
  {
    id: "supabase",
    name: "Supabase",
    detect: { packages: ["@supabase/supabase-js", "@supabase/ssr"], configFiles: ["supabase/config.toml"] },
  },

  // ── Auth & billing ─────────────────────────────────────────
  {
    id: "clerk",
    name: "Clerk",
    detect: { packagePatterns: [/^@clerk\//] },
  },
  {
    id: "better-auth",
    name: "Better Auth",
    detect: { packages: ["better-auth"] },
  },
  {
    id: "stripe",
    name: "Stripe",
    detect: { packages: ["stripe", "@stripe/stripe-js", "@stripe/react-stripe-js"] },
  },

  // ── Testing ────────────────────────────────────────────────
  {
    id: "vitest",
    name: "Vitest",
    detect: { packages: ["vitest"], configFiles: ["vitest.config.ts", "vitest.config.js", "vitest.config.mts"] },
  },
  {
    id: "jest",
    name: "Jest",
    detect: { packages: ["jest"], configFiles: ["jest.config.js", "jest.config.ts"] },
  },
  {
    id: "playwright",
    name: "Playwright",
    detect: { packages: ["@playwright/test"], configFiles: ["playwright.config.ts", "playwright.config.js"] },
  },

  // ── Cloud, infrastructure & tooling ────────────────────────
  {
    id: "docker",
    name: "Docker",
    detect: {
      configFiles: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
    },
  },
  {
    id: "vercel",
    name: "Vercel",
    detect: { packages: ["vercel", "@vercel/analytics"], configFiles: ["vercel.json"] },
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers",
    detect: { packages: ["wrangler"], configFiles: ["wrangler.toml", "wrangler.json", "wrangler.jsonc"] },
  },
  {
    id: "terraform",
    name: "Terraform",
    detect: { fileExtensions: [".tf"] },
  },
  {
    id: "vite",
    name: "Vite",
    detect: { packages: ["vite"], configFiles: ["vite.config.ts", "vite.config.js", "vite.config.mjs"] },
  },
  {
    id: "turborepo",
    name: "Turborepo",
    detect: { packages: ["turbo"], configFiles: ["turbo.json"] },
  },
];

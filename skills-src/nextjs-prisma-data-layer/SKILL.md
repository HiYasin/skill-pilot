---
name: nextjs-prisma-data-layer
description: Use Prisma safely inside a Next.js App Router project. Use when writing data access, Server Actions or route handlers that query the database with Prisma in Next.js.
metadata:
  stack-all: nextjs, prisma
---

# Next.js + Prisma data layer

## One client
- Create the client once in `lib/db.ts` and cache it on `globalThis` in development so hot reload does not open new connections:
  ```ts
  import { PrismaClient } from "@prisma/client";
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  export const db = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
  ```
- Add `import "server-only"` to data modules so they can never be bundled into client components.

## Data access layer
- Put queries in `lib/data/*.ts` functions (`getProjectsForUser(userId)`) that check authorisation and return plain DTOs.
- Call these functions from Server Components, Server Actions and route handlers; never query Prisma directly in client code.
- Wrap per-request reads with React `cache()` to dedupe calls within one render.

## Mutations
- Server Actions: validate input with Zod, check the session, run the Prisma write, then `revalidatePath`/`revalidateTag`.
- Map `P2002` (unique) and `P2025` (not found) to user-facing errors instead of throwing to the error boundary.

## Runtime and connections
- Prisma needs the Node.js runtime unless you use a driver adapter; do not mark Prisma routes as `runtime = "edge"`.
- On serverless hosts use a pooled connection string (PgBouncer, Prisma Accelerate or the provider's pooler) and a direct URL for migrations.
- Run `prisma generate` in the build (`postinstall` or build script) so the client matches the schema.

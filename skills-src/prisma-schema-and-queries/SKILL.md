---
name: prisma-schema-and-queries
description: Model data and write efficient queries with Prisma ORM. Use when editing schema.prisma, creating migrations, or writing Prisma Client queries and transactions.
metadata:
  stack-any: prisma
---

# Prisma schema and queries

## Schema
- Model names singular PascalCase (`User`), fields camelCase; map to snake_case tables with `@@map` / `@map` if the database convention needs it.
- Every model gets `id`, `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- Add `@@index` for every foreign key and every column used in `where` or `orderBy` on large tables.
- Use enums for small closed sets; use a table for sets that change at runtime.
- Prefer `onDelete: Cascade` or `Restrict` explicitly on relations; never leave it to chance.

## Migrations
- Development: `prisma migrate dev --name <change>`. Production and CI: `prisma migrate deploy`. Never `db push` against production.
- Review generated SQL before committing; split destructive changes (drop/rename) into expand → migrate data → contract steps.
- Commit the `migrations/` folder.

## Client usage
- Create one `PrismaClient` per process. In dev servers with hot reload, cache it on `globalThis`.
- Select only the fields you need (`select`) and never return password hashes or tokens.
- Avoid N+1: load relations with `include` / nested `select`, or batch with `findMany({ where: { id: { in } } })`.
- Paginate with cursors (`cursor`, `take`, `skip: 1`) for large or live lists.
- Use `upsert` for idempotent writes and unique constraints to enforce invariants.

## Transactions
- `prisma.$transaction([...])` for independent writes that must succeed together.
- Interactive `$transaction(async (tx) => { ... })` when later steps depend on earlier reads; keep it short and do no network calls inside.

## Errors
- Handle `Prisma.PrismaClientKnownRequestError` codes: `P2002` unique violation → 409, `P2025` record not found → 404.

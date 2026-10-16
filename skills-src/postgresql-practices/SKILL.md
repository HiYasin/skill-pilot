---
name: postgresql-practices
description: Design PostgreSQL schemas, indexes and queries that stay fast and safe. Use when writing SQL, migrations, indexes or tuning PostgreSQL queries.
metadata:
  stack-any: postgresql
---

# PostgreSQL practices

## Schema
- Primary keys: `bigint generated always as identity` or `uuid` (prefer UUIDv7 for index locality).
- Use `timestamptz` for every timestamp, `text` instead of `varchar(n)` unless a limit is a business rule, `numeric` for money.
- Enforce rules in the database: `NOT NULL`, `CHECK`, `UNIQUE`, foreign keys.

## Indexes
- Index every foreign key column and the columns your hot queries filter and sort on, in that order (equality columns first, then range/sort).
- Use partial indexes for common filters (`WHERE deleted_at IS NULL`) and expression indexes for `lower(email)`.
- Create indexes on large live tables with `CREATE INDEX CONCURRENTLY` (outside a transaction).
- Remove unused indexes; check `pg_stat_user_indexes`.

## Queries
- Read plans with `EXPLAIN (ANALYZE, BUFFERS)` before and after a change.
- Always parameterise; never interpolate user input into SQL.
- Keyset pagination (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 50`) instead of large `OFFSET`.
- Select only needed columns; avoid `SELECT *` in application code.

## Migrations
- Adding a column with a constant default is cheap; backfilling large tables should run in batches.
- Add `NOT NULL` safely: add a `CHECK (col IS NOT NULL) NOT VALID`, validate it, then set `NOT NULL`.
- Set `lock_timeout` in migrations so they fail fast instead of blocking traffic.

## Operations
- Use a connection pool (PgBouncer, or the provider's pooler for serverless) and keep pool size small.
- Keep transactions short; never wait on network calls inside one.
- Monitor slow queries with `pg_stat_statements`.

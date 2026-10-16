---
name: nestjs-prisma-integration
description: Integrate Prisma with NestJS using a PrismaService, transactions and error mapping. Use when adding database access to NestJS modules with Prisma.
metadata:
  stack-all: nestjs, prisma
---

# NestJS + Prisma integration

## PrismaService
- Wrap the client in an injectable service and connect on module init:
  ```ts
  @Injectable()
  export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() { await this.$connect(); }
    async onModuleDestroy() { await this.$disconnect(); }
  }
  ```
- Provide it from a global `PrismaModule` (`@Global()`), exported once.

## Repositories and services
- Feature services inject `PrismaService`; for larger domains add a repository class per aggregate so services stay testable.
- Return DTOs from services; strip secrets with `select` or `omit`.

## Transactions
- Pass the transaction client down instead of using the global client inside a transaction:
  ```ts
  await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.stock.update({ where: { id }, data: { qty: { decrement: 1 } } });
  });
  ```
- For transactions spanning several services, consider a CLS-based helper (e.g. `@nestjs-cls/transactional`).

## Errors
- Add an exception filter for `Prisma.PrismaClientKnownRequestError`: `P2002` → `ConflictException`, `P2025` → `NotFoundException`, `P2003` → `BadRequestException`.

## Testing
- Unit tests: mock `PrismaService` methods.
- E2E tests: run against a real test database, reset it between suites with migrations (`prisma migrate reset --force`) or truncation.

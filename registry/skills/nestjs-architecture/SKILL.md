---
name: nestjs-architecture
description: Structure NestJS backends with modules, providers, DTO validation and guards. Use when adding NestJS modules, controllers, services, auth or configuration.
metadata:
  stack-any: nestjs
---

# NestJS architecture

## Modules
- One feature module per domain (`users`, `orders`), each with its controller, service, DTOs and tests.
- Export only the providers other modules need. Avoid circular imports; if `forwardRef` seems necessary, extract a shared module instead.
- Keep `AppModule` thin: global config, database, and feature module imports.

## Controllers and services
- Controllers handle HTTP only: parse input, call one service method, map the result. No business logic, no database calls.
- Services own business rules and are framework-agnostic enough to unit test without HTTP.
- Return DTOs or plain objects, never raw ORM entities with secrets (password hashes, tokens).

## Validation
- Register a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Define request bodies as DTO classes with `class-validator` decorators; reuse them with `PartialType` / `PickType` from `@nestjs/mapped-types` or `@nestjs/swagger`.
- Use `ParseIntPipe`, `ParseUUIDPipe` on route params.

## Configuration
- Load config with `@nestjs/config`, validate it at boot (Joi or Zod), and inject typed config instead of reading `process.env` across the code.

## Errors
- Throw Nest's HTTP exceptions (`NotFoundException`, `ConflictException`) from services or map domain errors in an exception filter.
- Add one global exception filter that logs unexpected errors and hides stack traces from clients.

## Auth
- Use guards for authentication and role checks; attach the user to the request in the strategy, read it with a custom `@CurrentUser()` decorator.
- Default-deny: make auth global and mark public routes with a `@Public()` decorator.

## Testing
- Unit test services with mocked providers via `Test.createTestingModule`.
- E2E test controllers with `supertest` against an app built from the real module and a test database.

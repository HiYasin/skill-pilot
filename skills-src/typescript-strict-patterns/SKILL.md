---
name: typescript-strict-patterns
description: Write type-safe TypeScript under strict mode. Use when adding or reviewing TypeScript types, generics, narrowing, or tsconfig settings.
metadata:
  stack-any: typescript
---

# TypeScript strict patterns

## Compiler baseline
- Keep `"strict": true`. Also enable `noUncheckedIndexedAccess`, `noImplicitOverride` and `exactOptionalPropertyTypes` in new projects.
- Never silence errors with `// @ts-ignore`. If unavoidable, use `// @ts-expect-error <reason>` so it fails once the error is gone.

## Types
- Prefer `type` aliases for unions and mapped types, `interface` for object shapes that others extend.
- Model states as discriminated unions instead of optional flags:
  ```ts
  type Load<T> =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok"; data: T }
    | { status: "error"; error: Error };
  ```
- Finish every `switch` over a union with an exhaustiveness check: `const _never: never = value;`.
- Use `unknown`, never `any`, for untrusted input (JSON, request bodies, `catch (err)`), then narrow with a type guard or a schema (Zod, Valibot).
- Use `satisfies` to check a literal against a type without widening it: `const routes = { home: "/" } satisfies Record<string, string>;`.
- Prefer `as const` objects over `enum`. Enums emit runtime code and do not work with type-stripping runtimes.

## Functions and generics
- Annotate exported function return types; let local inference work.
- Constrain generics (`<T extends object>`) and give them meaningful names when there is more than one (`TInput`, `TOutput`).
- Use overloads only when the return type truly depends on the argument shape; otherwise a union parameter is clearer.

## Safety habits
- Treat `!` (non-null assertion) as a code smell; narrow instead.
- Brand IDs that must not be mixed: `type UserId = string & { readonly __brand: "UserId" }`.
- Mark data that should not change as `readonly` / `ReadonlyArray<T>`.
- Keep runtime validation at the boundary (HTTP, env vars, storage) and plain types inside.

---
name: vitest-testing
description: Write fast, reliable tests with Vitest. Use when adding or fixing unit and component tests, mocks, or Vitest configuration.
metadata:
  stack-any: vitest
---

# Testing with Vitest

## Structure
- Co-locate tests as `*.test.ts` next to the code, or mirror `src/` under `test/`; pick one per project.
- One behaviour per test; name tests as sentences (`it("rejects an expired token")`).
- Arrange-Act-Assert with a blank line between sections.

## What to test
- Test behaviour through public APIs, not private helpers or implementation details.
- Cover edge cases: empty input, boundaries, errors, and concurrency where it applies.
- For UI, use Testing Library queries by role and label (`getByRole("button", { name: "Save" })`), plus `user-event` for interactions.

## Mocks
- Mock at the boundary (network, clock, filesystem), not your own modules. Prefer MSW for HTTP.
- `vi.useFakeTimers()` for time; restore with `vi.useRealTimers()` in `afterEach`.
- Reset state between tests: `vi.restoreAllMocks()` in `afterEach`, or `restoreMocks: true` in config.
- Type mocks with `vi.mocked(fn)`.

## Async
- Always `await` async assertions (`await expect(promise).rejects.toThrow()`).
- Avoid arbitrary sleeps; wait for conditions (`vi.waitFor`, Testing Library `findBy*`).

## Configuration
- Set `environment: "jsdom"` or `"happy-dom"` only for DOM tests; use `environmentMatchGlobs` or projects to keep Node tests fast.
- Run `vitest run --coverage` in CI; treat coverage as a guide, not a goal.
- Keep tests deterministic: no real network, fixed seeds, stable dates.

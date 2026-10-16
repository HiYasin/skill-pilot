---
name: react-component-patterns
description: Build maintainable React components with modern hooks. Use when creating, refactoring or reviewing React components, state and effects.
metadata:
  stack-any: react
---

# React component patterns

## Components
- One component per file for anything reused; co-locate small private helpers.
- Name props types `<Component>Props`. Destructure props in the signature.
- Prefer composition (`children`, render slots) over boolean props that toggle layout.
- Keep components pure: same props → same output. No side effects during render.

## State
- Keep state minimal; derive everything else during render instead of syncing it with effects.
- Lift state only as high as the nearest common parent. Reach for context when prop drilling crosses 3+ levels, and split contexts by update frequency.
- Use `useReducer` when the next state depends on several fields or on the previous action.
- Server data belongs in a data library (TanStack Query, SWR, framework loaders), not `useState` + `useEffect`.

## Effects
- An effect is for synchronising with something outside React (subscriptions, timers, DOM APIs). If it only transforms props or state, delete it.
- Always return a cleanup for subscriptions and timers.
- List every reactive value in the dependency array; fix the code instead of disabling the lint rule.
- Fetching in effects needs an abort or "ignore" flag to avoid race conditions.

## Performance
- Measure before memoising. Add `memo`, `useMemo` and `useCallback` when a profiler shows wasted renders or a child relies on reference equality.
- Give list items stable keys from the data, never the array index for lists that reorder.
- Split heavy routes and widgets with `lazy` + `Suspense`.

## Accessibility
- Use semantic elements (`button`, `a`, `label`) before ARIA.
- Every input has a label; every icon-only button has an `aria-label`.

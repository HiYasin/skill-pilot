---
name: nextjs-app-router
description: Build Next.js apps with the App Router, Server Components and Server Actions. Use when adding routes, data fetching, caching, metadata or mutations in a Next.js project.
metadata:
  stack-any: nextjs
---

# Next.js App Router

## Server vs client
- Components in `app/` are Server Components by default. Add `"use client"` only to the smallest interactive leaf (forms, menus, charts), not to whole pages.
- Never import server-only code (DB clients, secrets) into client components. Guard such modules with `import "server-only"`.
- Pass serialisable props from server to client components; no functions or class instances.

## Data fetching
- Fetch data in Server Components with `async` functions. Run independent requests in parallel with `Promise.all`.
- Put loading UI in `loading.tsx` and error boundaries in `error.tsx` (a client component) per route segment.
- Use `notFound()` and `redirect()` from `next/navigation` instead of manual responses.

## Caching
- Be explicit: say whether a fetch or page is static, revalidated (`revalidate` seconds or tags) or dynamic.
- After a mutation, call `revalidatePath` or `revalidateTag` for every view that shows the changed data.
- Check the installed Next.js version's caching defaults before relying on them; they changed between major versions.

## Mutations
- Use Server Actions (`"use server"`) for form submissions and mutations. Validate input with a schema inside the action; never trust the client.
- Check authentication and authorisation inside every action and route handler, not only in middleware.
- Return typed results (`{ ok: true } | { ok: false; error }`) and show them with `useActionState`.

## Routing and files
- Route groups `(group)` organise without changing URLs; private folders `_lib` keep helpers out of routing.
- Use `route.ts` for APIs consumed by third parties or webhooks; prefer Server Actions for your own UI.
- Export `metadata` or `generateMetadata` from layouts and pages for SEO.
- Use `next/image` and `next/font` for images and fonts.

## Environment
- Only `NEXT_PUBLIC_*` variables reach the browser. Validate env vars once at startup.

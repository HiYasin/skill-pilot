---
name: node-runtime-practices
description: Write robust Node.js services and scripts. Use when working on Node.js modules, async code, error handling, configuration, streams or process lifecycle.
metadata:
  stack-any: nodejs
---

# Node.js runtime practices

## Modules and tooling
- Use ES modules (`"type": "module"`) and the `node:` prefix for built-ins (`import { readFile } from "node:fs/promises"`).
- Prefer built-ins before adding dependencies: `fetch`, `node:test`, `node:util` `parseArgs`, `crypto.randomUUID()`.
- Pin the Node version (`.nvmrc` and `"engines"`), and run an LTS release in production.

## Async and errors
- Use `async`/`await`; never mix callbacks and promises in one API.
- Run independent work concurrently with `Promise.all`, limit fan-out for large lists.
- Always handle rejections; register `process.on("unhandledRejection")` to log and exit non-zero rather than continue in a broken state.
- Throw `Error` subclasses with a `code` and use `{ cause }` when wrapping errors.

## Configuration
- Read and validate environment variables once at startup; fail fast with a clear message.
- Never log secrets; redact tokens and passwords in structured logs.

## Performance
- Do not block the event loop: avoid sync filesystem calls in request paths and move CPU-heavy work to worker threads.
- Stream large files and responses (`stream/promises` `pipeline`) instead of buffering.
- Set timeouts on outbound HTTP calls (`AbortSignal.timeout(ms)`).

## Lifecycle
- On `SIGTERM`/`SIGINT`, stop accepting work, finish in-flight tasks, close pools, then exit.
- Set `process.exitCode` instead of calling `process.exit()` mid-flight so pending output flushes.

## Security
- Keep dependencies few and pinned; commit the lockfile; review `npm audit` output.
- Never pass user input to `child_process.exec`; use `execFile`/`spawn` with an argument array.

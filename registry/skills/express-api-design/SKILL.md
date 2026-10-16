---
name: express-api-design
description: Design secure, consistent Express REST APIs. Use when adding Express routes, middleware, validation, error handling or security settings.
metadata:
  stack-any: express
---

# Express API design

## Structure
- Split by feature: `routes/` (wiring), `controllers/` (HTTP), `services/` (logic), `schemas/` (validation).
- Create the app in `app.ts` and start the server in `server.ts`, so tests can import the app without listening on a port.

## Requests
- Validate `req.body`, `req.params` and `req.query` with a schema (Zod) in a reusable middleware; reject unknown fields.
- Use plural nouns for resources (`/users/:id`), proper verbs, and status codes: 201 on create, 204 on delete, 400 for invalid input, 404 for missing, 409 for conflicts, 422 for business-rule failures.
- Paginate list endpoints (`?limit=&cursor=`) and cap `limit`.

## Errors
- Express 5 forwards rejected promises from async handlers; on Express 4 wrap handlers or use `express-async-errors`.
- One error-handling middleware (four arguments) at the end: map known errors to status codes, log the rest, return `{ error: { code, message } }` without stack traces in production.

## Security
- `helmet()` for headers, `cors()` with an explicit origin list, `express.json({ limit: "1mb" })`.
- Rate-limit auth and write endpoints.
- `app.disable("x-powered-by")`; set `trust proxy` correctly behind a load balancer.
- Never build SQL or shell commands from input; use parameterised queries.

## Operations
- Add `GET /health` that checks dependencies quickly.
- Handle `SIGTERM`: stop accepting connections, finish in-flight requests, close the DB pool.
- Use structured logging (pino) with a request id.

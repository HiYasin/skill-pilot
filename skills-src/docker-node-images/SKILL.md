---
name: docker-node-images
description: Build small, secure Docker images and compose setups for Node.js apps. Use when writing Dockerfiles, .dockerignore or docker-compose files.
metadata:
  stack-any: docker
---

# Docker images for Node.js

## Dockerfile
- Use multi-stage builds: `deps` (install), `build` (compile), `runner` (production only).
- Pin the base image to a specific Node LTS and variant (`node:22-alpine` or `-slim`); update it deliberately.
- Copy lockfiles first and install before copying source so dependency layers cache:
  ```dockerfile
  COPY package.json package-lock.json ./
  RUN npm ci
  COPY . .
  ```
- In the runner stage install production dependencies only (`npm ci --omit=dev`) or copy a standalone build (Next.js `output: "standalone"`).
- Run as a non-root user (`USER node`), set `NODE_ENV=production`, and use `CMD ["node", "dist/main.js"]` (exec form) so signals reach Node.
- Add a `HEALTHCHECK` or rely on the orchestrator's health checks hitting a `/health` route.

## .dockerignore
- Exclude `node_modules`, `.git`, `.env*`, build output, logs and test artefacts.

## Secrets
- Never bake secrets into images (`ENV`, `ARG` or copied `.env`). Inject them at runtime; use BuildKit `--mount=type=secret` for build-time tokens.

## Compose for local development
- One service per process (app, postgres, redis); named volumes for data.
- Use `depends_on` with `condition: service_healthy` plus a `healthcheck` on the database.
- Keep a separate `compose.override.yml` for dev-only bind mounts and ports.

## Checks
- Scan images (`docker scout`, Trivy) in CI and keep the final image small; inspect layers with `docker history`.

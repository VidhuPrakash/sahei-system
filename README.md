# SaHei

Multi-tenant SaaS platform: an organization connects a phone number, an AI agent answers inbound calls and converses in Malayalam, collects/responds to caller data, and books appointments. Call outcomes, transcripts, and analytics surface in an org dashboard.

See [claude.md](./claude.md) for full architecture, tech stack, and session conventions.

## Prerequisites

- Node.js >= 20, [pnpm](https://pnpm.io) 10.x
- Python 3.11+, [uv](https://docs.astral.sh/uv/) (manages `apps/voice-service` — it's outside the Turborepo/pnpm workspace)
- PostgreSQL and Redis (local instances or connection strings)

## Setup

```bash
# JS/TS workspaces (apps/client, apps/api, packages/*)
pnpm install

# Python voice pipeline (separate toolchain)
cd apps/voice-service
uv sync
cd ../..

# Environment variables
cp .env.example .env   # fill in real values, never commit this file
```

## Running

| App                | Command                                  |
| ------------------ | ----------------------------------------- |
| Everything (JS/TS) | `pnpm dev`                                 |
| Dashboard only      | `pnpm --filter client dev`               |
| API only            | `pnpm --filter api dev`                    |
| Voice service       | `cd apps/voice-service && uv run voice-service` |

`voice-service` is real-time and latency-sensitive — always verify by making a real call and listening, not just by reading the code.

## Docker

Runs the whole stack — Postgres, Redis, `api`, `client`, `voice-service` — via `docker-compose.yml`. The two Node apps build via `turbo prune` for lean images; `voice-service` builds via `uv`.

```bash
cp .env.example .env   # fill in real values first
docker compose up --build
```

| Service       | Port |
| ------------- | ---- |
| client        | 3000 |
| api           | 3001 (container listens on 3000) |
| postgres      | 5432 |
| redis         | 6379 |

`voice-service` has no exposed port here — it connects outbound to Exotel/Sarvam, it isn't served over HTTP.

## Build & verify

Same sequence Claude Code runs before every commit (see [claude.md](./claude.md#required-sequence-before-every-commit)):

```bash
pnpm build         # turbo run build
pnpm type-check    # turbo run type-check
pnpm lint          # turbo run lint
pnpm test          # turbo run test
```

`voice-service` (outside Turborepo):

```bash
cd apps/voice-service
uv run pytest
uv run mypy src
uv run ruff check src tests
```

## Committing

Conventional Commits are enforced via Husky + commitlint. Use Commitizen rather than a raw `git commit`:

```bash
pnpm commit
```

## Folder structure

```
/apps
  /client           Next.js — org dashboard (login, transcripts, calendar, analytics)
  /api              NestJS — multi-tenant data, booking logic, org auth (better-auth)
  /voice-service    Python/Pipecat — Exotel <-> Sarvam STT/TTS <-> Claude call pipeline
                    (own venv via uv, not part of turbo build/dev)
/packages
  /ui               @sahei/ui — shared design system (shadcn/ui components) for the dashboard
  /types            @sahei/types — shared TypeScript types (booking payloads, call events)
  /config           @sahei/config — shared eslint, tsconfig, tailwind config
```

Internal packages are scoped under `@sahei/*`.

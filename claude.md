# CLAUDE.md — SaHei

Context for Claude Code working in this repo. Read this fully before starting any session.

## Project

**SaHei** — a multi-tenant SaaS platform: an organization connects a phone number, an AI agent answers inbound calls and converses in Malayalam, collects/responds to caller data, and books appointments. Call outcomes, transcripts, and analytics surface in an org dashboard.

## Tech Stack

| Layer               | Tool                          | Notes                                         |
| ------------------- | ----------------------------- | --------------------------------------------- |
| Telephony           | Exotel (AgentStream)          | Real-time call audio streaming over WebSocket |
| Voice orchestration | Pipecat (Python, open source) | Wires telephony ↔ STT ↔ LLM ↔ TTS             |
| Malayalam STT       | Sarvam AI (Saaras v3)         | Streaming, tuned for call-center audio        |
| Malayalam TTS       | Sarvam AI (Bulbul v3)         | Streaming, low-latency                        |
| Dialogue LLM        | Claude (Haiku 4.5)            | Tool-calling for booking actions              |
| Backend             | NestJS + PostgreSQL + Redis   | Redis holds live-call session state           |
| Dashboard           | Next.js                       | Org login, transcripts, calendar, analytics   |
| Auth                | better-auth                   | Org auth + multi-tenancy (organization plugin), configured in `apps/api`, consumed from `apps/client` |
| UI components       | shadcn/ui (in `@sahei/ui`)    | Radix primitives + Tailwind, hand-maintained — CLI's `ui.shadcn.com` registry isn't reachable from every environment |
| Monorepo            | Turborepo                     | JS/TS workspaces only — see structure below   |

## Repo Structure

```
/apps
  /client        → Next.js, org-facing UI
  /admin             → Next.js, SaHei-staff-only: organization management, platform analytic
  /api               → NestJS, multi-tenant data, booking logic, org auth
  /voice-service     → Python, Pipecat — outside Turborepo's task graph
/packages
  /ui                → @sahei/ui — shared design system / component library for the dashboard
  /types              → @sahei/types — shared TypeScript types (booking payloads, call events)
  /config             → @sahei/config — shared eslint, tsconfig, tailwind config
```

Internal packages are scoped under `@sahei/*`. Root `package.json` name: `sahei`.

`voice-service` is Python: it is not part of `turbo build`/`turbo dev`. It has its own venv setup (managed with `uv`, since poetry wasn't available when this was scaffolded — `uv sync` / `uv run`) and is run and tested independently. Everything else runs through Turborepo.

## Skills to Use
 
- **Impeccable** — required for any work touching `apps/client`, `apps/admin`, or `packages/ui`. Install with `npx impeccable install` from the repo root, then run `/impeccable init` once to set product context (`PRODUCT.md`). This dashboard is an operational tool for small business owners checking whether their AI phone agent is working — not a marketing site. Use `/impeccable shape <surface>` to plan a screen before writing code, `/impeccable extract` to keep `packages/ui` in sync as a real design system, and `/impeccable audit` / `critique` / `polish` as finishing steps rather than hand-checking against a list of generic-AI-design tells — Impeccable's 61 deterministic detector rules already cover that.
- Impeccable builds on and supersedes a plain frontend-design skill reference — don't run both for the same surface.
- As voice-pipeline and booking-domain patterns solidify (Exotel/Sarvam integration conventions, appointment/business-hours logic), capture them as project skills under `.claude/skills/` and reference them here — don't let the same integration pattern get reinvented per session.

## UI Conventions

- Loading states use `Skeleton` from `@sahei/ui` (`packages/ui/src/components/skeleton.tsx`), shape-matched to the loaded content (table rows, cards, chart blocks) — never bare "Loading…" text.

## Session Conventions

- One session = one integration or one feature, scoped to a single app or package. Don't take on multiple phases in one session.
- State which app/package a session is working in before starting.
- `voice-service` is real-time and latency-sensitive: no blocking calls in the audio path, and always test by making a real call and listening — this is a pipeline where code can look correct and still sound wrong.
- `apps/client` and `packages/ui` work follows plan → critique → build, not straight to code.

## Environment Variables

Names only — never commit actual values.

```
EXOTEL_API_KEY
EXOTEL_API_TOKEN
EXOTEL_ACCOUNT_SID
EXOTEL_API_BASE_URL
EXOTEL_VOICEBOT_FLOW_ID
VOICE_SERVICE_WS_URL
SARVAM_API_KEY
ANTHROPIC_API_KEY
DATABASE_URL
REDIS_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
CLIENT_URL
NEXT_PUBLIC_API_URL
```

## Git Workflow

### Commit tooling setup (once, at repo root)

This repo enforces Conventional Commits via Husky + Commitizen (`cz-conventional-changelog` adapter) + commitlint.

- [x] Install as dev dependencies: `husky`, `commitizen`, `cz-conventional-changelog`, `@commitlint/cli`, `@commitlint/config-conventional`
- [x] Root `package.json`: add `"scripts": { "commit": "cz", "prepare": "husky" }` and `"config": { "commitizen": { "path": "cz-conventional-changelog" } }`
- [x] Add `commitlint.config.js` extending `@commitlint/config-conventional`
- [x] Initialize Husky and add a `commit-msg` hook that runs commitlint against the message, so even a raw `git commit` that bypasses the Commitizen prompt still gets rejected if it isn't conventional
- [x] Verify: `pnpm commit` opens the interactive Commitizen prompt, and a non-conventional manual commit message is blocked by the hook

### Commit format

`type(scope): subject` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Scope is the app/package touched, e.g. `feat(voice-service): add Sarvam STT streaming client`.

### Required sequence before every commit

Claude Code must run this in order at the end of every feature/session. Do not commit if any step fails — fix it first.

1. [ ] `turbo build` succeeds across affected apps/packages
2. [ ] Type-check passes with zero errors (`turbo run type-check` / `tsc --noEmit`)
3. [ ] Lint passes with zero errors (`turbo run lint`)
4. [ ] Tests pass (`turbo run test`) for anything with coverage
5. [ ] Commit via `pnpm commit` (Commitizen) — never a raw `git commit -m` that skips the conventional format

One commit per completed feature/session. Don't batch unrelated changes together, and don't leave a session's work uncommitted once it builds and passes checks.

### `voice-service` (Python) equivalent

Outside Turborepo, so use Python tooling for the same discipline: `mypy` for type-check, `ruff`/`black` for lint, `pytest` for tests. Same rule applies — build, type-check, lint, test, then commit. Manual call-testing (actually calling in and listening) is required in addition to automated tests before committing anything touching the audio pipeline.
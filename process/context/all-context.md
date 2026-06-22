# Bantuin Repository Context

Last updated: 22-06-26

## Product

Bantuin is a self-hostable, Bahasa-Indonesia-first personal AI assistant. Sprints 1–2 are verified; Sprint 3 Memory and Knowledge is awaiting manual/user verification. The approved TinyClaw independent-product-clone program supersedes the selective-parity plan and is currently paused after Phase 01 web research.

## Architecture boundaries

- `apps/api`: HTTP/OpenAPI/SSE composition root; may depend on packages.
- `apps/web`: React/Vite first-run setup, profile, session history, and streamed chat UI.
- `packages/core`: vendor-neutral contracts, configuration, IDs, and errors.
- `packages/agent`: provider-neutral agent orchestration; must not import provider implementations.
- `packages/providers`: model provider adapters; OpenRouter is first, mock is used in tests.
- `packages/db`: SQLite migrations and repositories.
- `packages/client`: transport codecs and later typed clients.
- Packages never import from `apps`.

## Runtime decisions

- Bun 1.3.14 and strict TypeScript.
- Hono with route-owned OpenAPI definitions.
- React 19 and Vite 8, built as static assets and served by the API in production.
- SQLite through `bun:sqlite`, ordered migrations, repository boundaries.
- OpenRouter credentials are server-only environment values.
- Single-owner browser auth uses Argon2id and hashed opaque SQLite sessions.
- The API binds to `127.0.0.1` unless deployment configuration explicitly changes it.
- Automated tests never require live provider credentials.

## Safety invariants

- No secrets, databases, logs, or backups in Git.
- No arbitrary shell, JavaScript, MCP, channel, or automation execution before their dedicated approved sprints.
- No direct application development on `main`; use the active sprint branch.
- A phase is verified only after automated, manual, state, failure, and user-confirmation evidence.

## Start here when resuming

1. Read the umbrella plan.
2. Read the active TinyClaw clone phase plan and report.
3. Read the current sprint plan and report.
4. Run `git status --short --branch` and `bun run check`.

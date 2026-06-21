# Bantuin Repository Context

Last updated: 21-06-26

## Product

Bantuin is a self-hostable, Bahasa-Indonesia-first personal AI assistant. The current execution anchor is Sprint 1 Foundation under `process/features/personal-ai-assistant/active/`.

## Architecture boundaries

- `apps/api`: HTTP/OpenAPI/SSE composition root; may depend on packages.
- `packages/core`: vendor-neutral contracts, configuration, IDs, and errors.
- `packages/agent`: provider-neutral agent orchestration; must not import provider implementations.
- `packages/providers`: model provider adapters; OpenRouter is first, mock is used in tests.
- `packages/db`: SQLite migrations and repositories.
- `packages/client`: transport codecs and later typed clients.
- Packages never import from `apps`.

## Runtime decisions

- Bun 1.3.14 and strict TypeScript.
- Hono with route-owned OpenAPI definitions.
- SQLite through `bun:sqlite`, ordered migrations, repository boundaries.
- OpenRouter credentials are server-only environment values.
- The API binds to `127.0.0.1` unless deployment configuration explicitly changes it.
- Automated tests never require live provider credentials.

## Safety invariants

- No secrets, databases, logs, or backups in Git.
- No arbitrary shell, JavaScript, MCP, channel, or automation execution in Sprint 1.
- No direct application development on `main`; use the active sprint branch.
- A phase is verified only after automated, manual, state, failure, and user-confirmation evidence.

## Start here when resuming

1. Read the umbrella plan.
2. Read the current direct sprint plan.
3. Read the current sprint report.
4. Run `git status --short --branch` and `bun run check`.

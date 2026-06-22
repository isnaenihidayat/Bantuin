# Bantuin Test Context

Last updated: 22-06-26

## Commands

| Gate | Command | Green means |
| --- | --- | --- |
| Format | `bun run format:check` | Biome reports no formatting differences |
| Lint | `bun run lint` | Recommended lint rules pass |
| Types | `bun run typecheck` | Strict TypeScript has no errors |
| Boundaries | `bun run check:boundaries` | Packages do not import apps; agent is provider-neutral |
| Secrets | `bun run check:secrets` | No recognized credential signatures in tracked/untracked files |
| Tests | `bun test` | Unit and integration tests pass |
| Build | `bun run build` | API and React production bundles are created |
| Full local | `bun run check` | All gates above pass in sequence |
| Database | `bun run db:migrate` | Current database migrates or reports current state |
| Container | `docker build -t bantuin:local .` | Multi-stage image builds after all in-image checks |

## Test locations

- Core contracts/config: `packages/core/src/*.test.ts`
- Provider behavior: `packages/providers/src/*.test.ts`
- Agent boundary: `packages/agent/src/*.test.ts`
- SQLite/migrations: `packages/db/src/*.test.ts`
- SSE codec: `packages/client/src/*.test.ts`
- API integration: `apps/api/src/*.test.ts`
- Web compile/bundle: strict root typecheck and `apps/web` Vite production build

Sprint 2 adds setup/auth/CSRF/rate-limit tests, durable ordered chat and deduplication tests, cancel/retry streaming, and SQLite restart reconciliation. Browser visual/accessibility confirmation remains manual when browser automation is unavailable.

Live OpenRouter tests are opt-in, excluded from default CI, and must never print the API key.

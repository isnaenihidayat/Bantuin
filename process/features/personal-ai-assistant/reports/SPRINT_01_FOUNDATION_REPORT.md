# Sprint 01 Foundation Report

Date: 22-06-26
Sprint status: ✅ VERIFIED
Execution status: Foundation implemented, verified, committed, and pushed on `feat/sprint-1-foundation`.

## What's Functional Now

The bootstrap `main` commit is live on GitHub. The feature branch now contains a runnable API with health/readiness, OpenAPI output, SQLite migrations, provider-neutral agent contracts, an isolated OpenRouter adapter, deterministic mock streaming, quality scripts, CI, and a production bundle.

## Implementation Summary

- Bootstrap commit `c9afa7a` pushed to `origin/main`.
- Bun workspace boundaries: `apps/api` and `packages/{core,agent,providers,db,client}`.
- OpenRouter SDK `0.12.79` isolated inside `packages/providers`; tests never make a live paid request.
- Ordered migration `0001_initial.sql` with checksum and double-run idempotency.
- Minimal `owners`, `profiles`, and `chat_sessions` repositories.
- Hono/OpenAPI `/health`, `/ready`, `/openapi.json`, and internal mock-stream vertical slice.
- Stable error envelope and request IDs.
- Biome, strict TypeScript, dependency-boundary check, custom secret scan, Bun tests, and bundle build.
- GitHub Actions quality/container jobs and non-root multi-stage Dockerfile.
- Repository context and test-command maps under `process/context/`.

## Research Scope

- Local runtime, database, Git, Docker, and GitHub remote readiness.
- OpenRouter endpoint, authentication, SDK, streaming, cancellation, usage, and error behavior.
- Secret-storage and deployment posture.
- Empty-repository bootstrap and branch workflow.
- TinyClaw reuse/licensing boundary.

## Environment Evidence

| Check | Result | Decision impact |
| --- | --- | --- |
| Bun | `1.3.14` | Supported baseline for the workspace |
| `bun:sqlite` | In-memory create/insert/select passed | SQLite foundation is viable |
| Node | `v25.9.0` | Available for tooling only; runtime remains Bun |
| Git | `2.50.1` | Suitable |
| Git identity | Configured for Isnaeni Hidayat | Commit metadata ready |
| Credential helper | `osxkeychain` | HTTPS credentials can be stored; write access still unproven |
| GitHub CLI | Not installed | PR/repo automation cannot rely on `gh` initially |
| Bantuin remote | Reachable but returns no HEAD | Repository is empty |
| Docker client | `29.4.0` | Client installed |
| Docker daemon | `29.4.0`, Linux ARM64 via OrbStack | Image build and inspection completed |
| Host | macOS ARM64 | Container and native dependencies must support arm64 |

## OpenRouter Contract Findings

Official documentation confirms:

- Chat requests use `POST https://openrouter.ai/api/v1/chat/completions` with bearer authentication.
- The normalized request/response surface resembles OpenAI Chat Completions, including tools and structured outputs.
- Official TypeScript guidance prefers `@openrouter/sdk`; Bantuin will isolate it inside `packages/providers` so the agent core never depends on SDK-specific types.
- Streaming uses `stream: true` and SSE. Keep-alive comment lines must be ignored, `[DONE]` terminates the stream, and the final chunk may contain usage/cost data.
- Errors before streaming use normal non-2xx JSON responses. Errors after tokens begin arrive inside a 200 SSE stream and must still mark the message failed or partial.
- Cancellation uses `AbortController`, but downstream provider support varies; Bantuin must not promise that cancellation always stops billing.
- `HTTP-Referer` and `X-OpenRouter-Title` are optional attribution headers.
- Model slug must be configurable. Sprint 1 uses a deterministic mock provider and does not require or spend an OpenRouter key.

Official references:

- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Streaming](https://openrouter.ai/docs/api/reference/streaming)
- [OpenRouter OpenAPI specification](https://openrouter.ai/openapi.json)

## Proposed Foundation Decisions

| Topic | Recommendation | Rationale |
| --- | --- | --- |
| Runtime | Bun 1.3.x + strict TypeScript workspaces | Proven locally and aligned with the reference architecture |
| API | Hono + Zod OpenAPI | Thin HTTP boundary and generated contract |
| Database | `bun:sqlite` + ordered SQL migrations + repositories | Local-first, zero service dependency, proven on host |
| Provider | `@openrouter/sdk` only inside an `OpenRouterProvider` adapter | Official SDK with vendor isolation |
| Model | Required `OPENROUTER_MODEL`; no paid default | Avoid accidental spend and silent model drift |
| Tests | Mock provider by default; live OpenRouter smoke is explicit/opt-in | CI remains deterministic and secret-free |
| Secrets | `OPENROUTER_API_KEY` from process environment; `.env.local` ignored; never persist in DB/client/logs | Smallest safe Sprint 1 surface |
| Network | Bind API to `127.0.0.1` by default | No accidental LAN/internet exposure |
| Docker | Non-root multi-stage Bun image | Build passed; image digest recorded below |
| Source reuse | Adapt concepts; copy no TinyClaw application code in Sprint 1 | Avoid imported complexity and attribution ambiguity |
| License | MIT recommended | Matches the public/open-source posture and reference compatibility |

## Threat Boundary

Sprint 1 excludes authentication UI, live chat, tools, MCP, channels, and public deployment. It may implement only health/readiness, migrations, contracts, and a deterministic mock-provider vertical slice. OpenRouter credentials remain optional and unused by automated tests.

Primary risks and controls:

- Secret leak → aggressive `.gitignore`, example env without values, log redaction test, secret scan before every commit.
- Accidental spend → no default live model, no live provider in CI, explicit opt-in smoke command.
- Vendor lock-in → provider-neutral request/stream/result contracts; SDK types stop at adapter boundary.
- Stream ambiguity → test SSE comments, `[DONE]`, final usage, pre-stream errors, mid-stream errors, and abort.
- Data corruption → transactional migrations and double-run idempotency test.
- Unreviewed remote mutation → no Git init/commit/push until this report is approved.

## Git Bootstrap Decision

Because the remote has no HEAD, the recommended workflow is:

1. Initialize local Git with `main`.
2. Create one bootstrap commit containing the approved planning/research artifacts, governance files, `.gitignore`, and no application secrets.
3. Push `main` once with explicit user approval and verify the remote.
4. Create `feat/sprint-1-foundation` for application scaffolding.
5. Subsequent verified work pushes only sprint branches; `main` changes through approved PR/merge.

Write authentication remains unverified until the first approved push. No force push will be used.

## Git Checkpoint

- Foundation commit: `deed8e3` (`feat: establish personal assistant foundation`).
- Branch: [feat/sprint-1-foundation](https://github.com/isnaenihidayat/Bantuin/tree/feat/sprint-1-foundation).
- User confirmation: foundation, MIT license, bootstrap `main`, and continuation of Sprint 1 approved.
- Push completed without force.

## Remaining Remote Gate

GitHub Actions starts on `main` pushes or pull requests, so its remote run belongs to the later PR/merge gate. Local commands matching CI are green.

## What Was Tested

- Bun/Node/Git/Docker client version checks.
- `bun:sqlite` in-memory create, insert, query, and close.
- Read-only remote HEAD lookup.
- Read-only Git identity and credential-helper inspection.
- Official OpenRouter documentation review.
- `bun run check`: format, lint, strict types, package boundaries, secret scan, 18 tests, and production bundle all pass.
- Clean-copy `bun install --frozen-lockfile` and `bun run check` pass.
- Docker image `bantuin:sprint1` built successfully as `sha256:1c23b7b8ec6a28ced582178afe2c8223becea4ebc3441071f69a94a012268cdf` for ARM64 with non-root user `bantuin`.
- Source API smoke: `/health` 200, `/ready` 200, and mock SSE stream completed.
- Production bundle smoke: `dist/api/index.js` started and `/ready` returned 200.
- SQLite state: migration version `1`, name `initial`, 64-character checksum; expected four tables exist.
- Failure behavior: invalid request returns 400; closed database returns readiness 503; mock provider cancellation rejects cleanly.
- Ignore policy: `.env`, `.env.local`, SQLite data, logs, and backups are ignored by Git.

## What You Can Test

- Run `bun install --frozen-lockfile && bun run check`.
- Run `bun start`, then request `/health`, `/ready`, and `/openapi.json`.
- Build the image with `docker build -t bantuin:sprint1 .`.

## Ready For

Begin Sprint 02 research from the verified foundation. Open a pull request when remote CI and review are desired.

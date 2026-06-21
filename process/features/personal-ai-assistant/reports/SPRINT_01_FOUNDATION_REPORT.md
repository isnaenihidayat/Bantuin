# Sprint 01 Foundation Report

Date: 21-06-26  
Sprint status: ⏳ PLANNED — Pre-Sprint Research Complete, awaiting approval  
Execution status: No application scaffold, Git initialization, dependency installation, commit, or push performed.

## What's Functional Now

Only planning and research artifacts exist. The local runtime and SQLite capability have been proven, but Bantuin application code has not started.

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
| Docker daemon | Unavailable at current OrbStack socket | Docker build/smoke verification is blocked until daemon starts |
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
| Docker | Multi-stage image later in Sprint 1; no success claim until daemon test passes | Client alone is insufficient proof |
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

## Blockers Before Implementation

1. User approval of this decision set.
2. User approval of MIT licensing, or selection of another license posture.
3. User approval of the one-time bootstrap commit/push to empty `main`.

Docker daemon availability is required before Sprint 1 can become ✅ VERIFIED, but it does not block initial scaffolding after approval.

## What Was Tested

- Bun/Node/Git/Docker client version checks.
- `bun:sqlite` in-memory create, insert, query, and close.
- Read-only remote HEAD lookup.
- Read-only Git identity and credential-helper inspection.
- Official OpenRouter documentation review.

## What You Can Test

- Start OrbStack or Docker Desktop, then run `docker info`.
- Confirm that `https://github.com/isnaenihidayat/Bantuin` is intentionally empty.
- Confirm whether the project should use MIT licensing.

## Ready For

After explicit approval: Sprint 1 implementation stages 1–6, beginning with Git bootstrap and workspace scaffolding. The next checkpoint occurs before the first remote push.

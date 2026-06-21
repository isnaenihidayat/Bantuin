# Bantuin Personal AI Assistant — Program Plan

Date: 21-06-26  
Complexity: **Complex — phase program**  
Status: ⏳ PLANNED  
Cadence assumption: six two-week sprints (12 weeks), adjustable after Sprint 1 sizing.

## Overview

Bantuin will be a self-hostable, Bahasa-Indonesia-first personal AI assistant inspired by TinyClaw without transplanting its entire multi-tenant platform. The first release will provide secure web chat, persistent history and memory, explicit provider boundaries, approved tools and automations, Telegram access, Docker deployment, and a verified Git delivery workflow. Every sprint is independently researched, implemented, tested, manually confirmed, then committed and pushed to a sprint branch.

## Quick Links

- [Context and Goals](#context-and-goals)
- [Architecture Decisions](#architecture-decisions-final)
- [Sprint Roadmap](#phased-delivery-plan)
- [Security Posture](#security-posture)
- [Git Delivery Policy](#git-delivery-policy)
- [Acceptance Criteria](#acceptance-criteria-v1)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

## Context and Goals

Repository context note: `process/context/all-context.md` and `process/context/tests/all-tests.md` do not exist yet because Bantuin is an empty greenfield repository. Sprint 1 creates the authoritative context and test-command maps; all later sprint research must read them.

Goals:

- A personal assistant that converses naturally in Indonesian and streams responses.
- Durable conversations, curated user memory, and explicit deletion/export controls.
- Server-side provider credentials with a replaceable provider adapter.
- Safe built-in tools and scheduled automations with approval and audit trails.
- Web as the primary client; Telegram as the first external channel.
- Reproducible local and Docker deployment.
- Automated quality gates and controlled commit/push after verified sprint completion.

Success metrics for v1:

- A new owner can configure a provider and complete first chat in under 10 minutes.
- 100% of accepted messages survive restart and retain ordered history.
- Tool execution is blocked unless assigned and, for medium/high risk, explicitly approved.
- No secrets appear in Git history, browser payloads, or application logs.
- Critical E2E suite passes on CI and the Docker smoke test reaches healthy state.
- Telegram and web resolve to the same assistant profile and persistent conversation store.

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** — Works with other system pieces.
2. **Manual Test** — User can perform the action.
3. **Data Verification** — Database/state changes are confirmed.
4. **Error Handling** — Failure cases are handled gracefully.
5. **User Confirmation** — User says “it works.”

Status meanings:

- ⏳ PLANNED — Not started
- 🔨 CODE DONE — Written but not E2E tested
- 🧪 TESTING — Currently being tested
- ✅ VERIFIED — Tested and user-confirmed
- 🚧 BLOCKED — Cannot proceed

After each sprint document:

- [ ] Manual tests performed
- [ ] State/DB evidence with command and redacted result
- [ ] Errors found and resolved
- [ ] User confirmation
- [ ] Commit hash and pushed branch/PR URL

## Execution Brief

| Sprint | Outcome | Integration proof | Done when |
| --- | --- | --- | --- |
| 1. Foundation | Git/toolchain, contracts, DB, provider spike, CI | API, DB migration, provider mock, Docker skeleton | Clean clone passes lint/type/test/build and user approves stack |
| 2. Core Chat | Onboarding, auth boundary, streaming chat, profiles, durable history | Browser → API/SSE → provider → SQLite | Restart preserves conversation and user completes first chat |
| 3. Memory | Curated memory, knowledge ingestion/search, compaction, export/delete | Chat context uses scoped memory with provenance | User can inspect, correct, export, and delete memory |
| 4. Tools & Automations | Safe tools, MCP boundary, approvals, scheduler, audit | Model tool call → policy → approval → execution → audit | Unauthorized tools fail closed; approved job runs once |
| 5. Channels | Telegram production path; WhatsApp go/no-go beta | Channel identity → common session/runtime/store | Paired user continues the same assistant flow safely |
| 6. Hardening & Release | Observability, backups, security, E2E, Docker release, docs | Fresh install and recovery drill | Release candidate passes gates and is pushed/tag-ready |

Expected outcome: a secure, maintainable v1—not a clone—whose next expansion can add providers, channels, or team tenancy behind stable contracts.

## Phased Execution Workflow

For each sprint:

1. **Pre-Sprint Research:** re-read current code and prior report, validate dependencies and threats, present findings, then stop for approval.
2. **Detailed Planning:** update exact files/contracts/test cases; receive approval.
3. **Implementation:** execute only the approved sprint plan.
4. **Testing and Verification:** unit, integration, E2E/manual, DB/state checks, failure tests, security checks.
5. **User Confirmation:** report “What’s Functional Now,” “What Was Tested,” “What You Can Test,” and “Ready For”; wait for confirmation.
6. **Git Checkpoint:** only after confirmation, create an atomic conventional commit and push the sprint branch. Main is updated through an approved PR or explicit user instruction.

Example: Sprint 1 research may reveal Bun incompatibility. The executor reports the evidence and **stops**. It does not swap to Node or scaffold code until the user approves the revised decision.

No later sprint begins until its dependency is ✅ VERIFIED.

## Non-Goals and Constraints

- No multi-organization tenancy, billing, marketplace, voice calls, autonomous purchasing, or arbitrary host shell in v1.
- No always-on background autonomy without a visible schedule, scope, stop control, and audit history.
- WhatsApp is optional beta and may be deferred after a legal/operational reliability review.
- API keys and channel tokens never enter source control.
- TinyClaw is reference material; any substantial reuse must retain MIT notice and be recorded in `THIRD_PARTY_NOTICES.md`.

## Architecture Decisions (Final)

1. **Central server runtime.** All model calls, tool policy, memory access, and credential use remain server-side. This prevents client drift and credential leakage.
2. **Bun/TypeScript monorepo, conditional on Sprint 1 proof.** It aligns with TinyClaw and keeps shared contracts simple; failure triggers an explicit decision record, not a silent rewrite.
3. **Single owner first.** Authentication is local-owner oriented; schema keeps future ownership seams without shipping organization administration.
4. **SQLite first with repository boundaries.** Local deployment stays simple while migrations and adapters avoid locking business logic to SQL calls.
5. **Durable message log.** User and assistant messages persist before/after provider processing with deterministic ordering and failure status.
6. **Provider-neutral agent core.** OpenRouter is the initial provider, isolated behind a typed adapter; later providers implement the same contract.
7. **Default-deny tools.** Each tool has schema, risk class, timeout, permissions, redacted audit events, and optional approval.
8. **Thin channels.** Web and Telegram call the same API/runtime; channels never embed agent decisions.
9. **Human-controlled Git automation.** Tests and secret scans gate commits; push targets a sprint branch, never an unreviewed direct main update.

## Architecture Clarification

Proposed workspaces:

```text
apps/api          Hono HTTP, auth, SSE, composition root
apps/web          React/Vite owner UI
apps/worker       scheduler and queued executions
apps/telegram     Telegram adapter
packages/agent    prompt assembly, model/tool loop, compaction
packages/core     shared contracts, IDs, errors, config types
packages/providers provider interface and adapters
packages/tools    schemas, policy, builtin tool handlers, MCP bridge
packages/db       migrations, repositories, SQLite adapter
packages/client   typed HTTP/SSE client used by web/channels
```

Dependency direction: packages never import apps; UI/channels never import provider or tool handlers.

## High-Level Data Flow

```text
User -> Web/Telegram -> API/Auth -> Session Service -> Agent Harness
                                                |-> Memory/History -> SQLite
                                                |-> Provider -> LLM
                                                |-> Tool Policy -> Approval -> Tool/MCP
Worker -> Scheduled Run ------------------------^
```

## Security Posture

- Bind locally by default; internet exposure requires authenticated mode and documented reverse-proxy TLS.
- Store secrets outside SQLite/source where possible; encrypt at rest when persisted.
- Hash session tokens; use secure/HttpOnly/SameSite cookies and CSRF protection for browser mutations.
- Validate all API/tool inputs with Zod and cap body, attachment, output, and context sizes.
- Tool SSRF/file-path controls, egress allowlists where feasible, execution timeouts, cancellation, and output truncation.
- MCP servers disabled until explicitly added, tested, and assigned.
- Redact secrets and sensitive message content from structured logs.
- Add dependency, license, secret, and container scans before release.

## Component Details

| Component | Responsibility | v1 boundary |
| --- | --- | --- |
| API | Auth, validation, OpenAPI, SSE, orchestration | No provider keys returned to clients |
| Agent | Prompt/context, provider loop, tool calls | No direct HTTP/DB implementation imports |
| DB | Migrations and repositories | SQLite; backup/export hooks |
| Web | Setup, chat, history, memory, approvals, settings | No agent logic |
| Worker | Leases, retries, scheduler, cancellation | Idempotent runs only |
| Channels | Identity/pairing, input normalization, output rendering | Telegram first |

## Backend Endpoints and Workers

Initial API surface:

- `GET /health`, `GET /ready`, `GET /openapi.json`
- `POST /v1/setup`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me`
- `GET/POST /v1/profiles`, `PATCH /v1/profiles/:id`
- `GET/POST /v1/sessions`, `GET /v1/sessions/:id/messages`
- `POST /v1/sessions/:id/messages` with SSE stream and cancellation
- `GET/PATCH/DELETE /v1/memory`, `POST /v1/knowledge`, `GET /v1/export`
- `GET /v1/tools`, `POST /v1/tool-approvals/:id/{approve|reject}`
- `GET/POST/PATCH /v1/automations`, `GET /v1/automation-runs`
- `POST /v1/channels/telegram/pair`

Worker responsibilities: schedule acquisition, idempotency key, run heartbeat, timeout, retry policy, cancellation, and durable run result.

## Database Schema

Core tables: `owners`, `auth_sessions`, `profiles`, `chat_sessions`, `messages`, `memories`, `knowledge_documents`, `knowledge_chunks`, `tools`, `profile_tools`, `tool_approvals`, `tool_audit_events`, `automations`, `automation_runs`, `channel_identities`, `provider_usage`, and `schema_migrations`.

Every user-owned row has `owner_id`; messages have `(session_id, sequence)` uniqueness; automation runs have an idempotency key; secrets are referenced by secret ID rather than stored in normal JSON config.

## API Surface

- OpenAPI route definitions are the source of truth.
- Stable error envelope: `{ error: { code, message, requestId, details? } }`.
- IDs use opaque prefixes (`usr_`, `ses_`, `msg_`, `run_`).
- SSE events: `message.delta`, `message.completed`, `tool.requested`, `tool.started`, `tool.completed`, `error`, `done`.
- Additive changes are allowed within `/v1`; breaking changes require `/v2` or a migration window.

## Phased Delivery Plan

| Sprint | Dates | Status | Direct plan | Report |
| --- | --- | --- | --- | --- |
| 1 | Weeks 1–2 | 🔨 CODE DONE | `SPRINT_01_FOUNDATION_PLAN_21-06-26.md` | `reports/SPRINT_01_FOUNDATION_REPORT.md` |
| 2 | Weeks 3–4 | ⏳ PLANNED | `SPRINT_02_CORE_CHAT_PLAN_21-06-26.md` | `reports/SPRINT_02_CORE_CHAT_REPORT.md` |
| 3 | Weeks 5–6 | ⏳ PLANNED | `SPRINT_03_MEMORY_PLAN_21-06-26.md` | `reports/SPRINT_03_MEMORY_REPORT.md` |
| 4 | Weeks 7–8 | ⏳ PLANNED | `SPRINT_04_TOOLS_AUTOMATIONS_PLAN_21-06-26.md` | `reports/SPRINT_04_TOOLS_AUTOMATIONS_REPORT.md` |
| 5 | Weeks 9–10 | ⏳ PLANNED | `SPRINT_05_CHANNELS_PLAN_21-06-26.md` | `reports/SPRINT_05_CHANNELS_REPORT.md` |
| 6 | Weeks 11–12 | ⏳ PLANNED | `SPRINT_06_HARDENING_RELEASE_PLAN_21-06-26.md` | `reports/SPRINT_06_HARDENING_RELEASE_REPORT.md` |

What green proves:

- Sprint 1: the chosen stack and delivery pipeline are viable.
- Sprint 2: the core assistant flow is useful and durable.
- Sprint 3: personalization is controllable, inspectable, and reversible.
- Sprint 4: actions are bounded and auditable.
- Sprint 5: external access does not fork runtime or identity rules.
- Sprint 6: a fresh operator can deploy, observe, back up, restore, and upgrade v1.

## Features List (MoSCoW)

| ID | Priority | Feature |
| --- | --- | --- |
| F-01 | Must | Provider setup and streamed web chat |
| F-02 | Must | Persistent sessions/messages and profile identity |
| F-03 | Must | Inspectable memory with delete/export |
| F-04 | Must | Tool allowlist, approval, timeout, audit |
| F-05 | Must | Docker deployment, backup/restore, CI/E2E |
| F-06 | Should | Knowledge document search with provenance |
| F-07 | Should | Scheduled automations with visible run history |
| F-08 | Should | Telegram channel |
| F-09 | Could | Anthropic adapter |
| F-10 | Could | WhatsApp beta |
| F-11 | Won't v1 | Multi-tenant organizations/billing |

## Sequential RFCs

- RFC-001: Runtime, workspace, configuration, schema, and Git/CI foundation.
- RFC-002: Owner onboarding, profile, chat streaming, and durable history.
- RFC-003: Curated memory, knowledge retrieval, compaction, export, deletion.
- RFC-004: Tool policy, MCP boundary, approvals, automation worker.
- RFC-005: Channel identity, Telegram, WhatsApp go/no-go.
- RFC-006: Security/performance hardening, observability, recovery, release.

Each RFC is owned by its corresponding sprint plan and must follow research → approval → implementation → verification → user confirmation.

## Git Delivery Policy

1. Sprint 1 initializes Git and sets `origin` to `https://github.com/isnaenihidayat/Bantuin.git` only after verifying ownership and authentication.
2. Branch naming: `feat/sprint-N-short-name`; conventional atomic commits.
3. Before commit: format, lint, typecheck, unit/integration tests, generated-file check, secret scan, and diff review.
4. Before push: manual verification evidence and explicit user confirmation are recorded in the sprint report.
5. Push the sprint branch; do not force-push or commit directly to protected `main`.
6. PR checks repeat quality gates; merge/tag remains an explicit release decision.
7. Never commit `.env`, provider tokens, Telegram tokens, WhatsApp credentials, local DBs, logs, or backups.

## Rules

- Strict TypeScript, schema validation at every external boundary, no `any` without justification.
- Repository methods own persistence; services own use cases; routes remain thin.
- Tests accompany behavior in the same sprint.
- Architecture decisions live under `docs/adr/`; external attribution under `THIRD_PARTY_NOTICES.md`.
- No phase is “done” because it builds; manual and state evidence are mandatory.

## Verification Evidence

Every sprint report records:

- Commit and source branch.
- Exact commands and pass/fail summaries.
- Migration version and DB verification query/result.
- Manual test path and screenshots/log excerpts with secrets redacted.
- Negative/error scenarios.
- Known deviations and user confirmation.

Program-level final evidence: clean-clone CI, Docker smoke test, provider mock E2E, live-provider opt-in smoke, Telegram pairing flow, backup/restore drill, security scan, and upgrade migration test.

## Post-Phase Testing

After every sprint, rerun its unit/integration suites plus all previously green critical flows. Record regressions, exact commands, state queries, and manual confirmation in the sprint report before changing status to ✅ VERIFIED.

## Touchpoints

All proposed application workspaces, `.github/workflows`, `Dockerfile`, compose/env examples, migrations, tests, docs, and the remote Git workflow. Existing application touchpoints are currently absent.

## Public Contracts

OpenAPI `/v1`, SSE event names/order, provider interface, tool schema/result envelope, database migration compatibility, channel adapter interface, environment variable names, backup/export format, and health/readiness semantics.

## Blast Radius

High: tool execution, secrets, auth, migrations, scheduler, external channels, and automated Git push. Medium: provider switching, memory/context selection, SSE compatibility. Low: isolated presentational UI. High-risk changes require threat-model update and negative tests.

## Acceptance Criteria (v1)

- Owner can complete setup, chat in Indonesian, stop generation, reload, and reopen complete history.
- Provider failures preserve the user message and expose a retryable, non-secret error.
- Memory used in a response is inspectable and can be corrected/deleted.
- Disallowed tools never execute; risky allowed tools require approval and create redacted audit events.
- Scheduled runs are idempotent, cancellable, and visible.
- Telegram pairing blocks unknown users and uses the common agent runtime.
- Backup restored into a clean instance preserves schema, sessions, memory, and settings except external secrets as documented.
- CI, container, dependency, license, and secret checks pass.
- A verified sprint produces a traceable commit and pushed branch without modifying protected main directly.

## Future Work

Voice, calendar/email connectors, more providers, vector-store abstraction, mobile/PWA polish, team tenancy, policy sandboxing, encrypted multi-device sync, and a reviewed WhatsApp production path.

## Resume and Execution Handoff

Read in this order:

1. `references/TINYCLAW_ADAPTATION_STUDY_21-06-26.md`
2. This umbrella plan
3. The current sprint direct plan
4. The prior sprint report, if any
5. Current repository status and recent commits

Execute only `SPRINT_01_FOUNDATION_PLAN_21-06-26.md` next. Start at its pre-sprint research gate, present findings, and pause for approval before scaffolding. Cursor Plan mode may import that sprint checklist only. RIPER-5 must use RESEARCH → INNOVATE → PLAN → approval → EXECUTE → VERIFY → REVIEW.

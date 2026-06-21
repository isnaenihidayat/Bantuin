# Sprint 01 — Foundation Plan

Date: 21-06-26  
Complexity: Complex phase 1/6  
Status: 🔨 CODE DONE
Objective: prove the stack, initialize the target repository safely, and establish contracts, migrations, CI, and deployment skeleton.

## Context

This is the greenfield proof phase. `process/context/all-context.md` and `process/context/tests/all-tests.md` are currently absent and must be created here from the approved scaffold.

## Dependencies

None. OpenRouter is confirmed as the first provider. User must still approve the one-time empty-repository bootstrap, license choice, and local-first deployment posture before remote mutation.

## Phase Completion Rules

Completion requires integration test, manual test, data verification, failure handling, and user confirmation. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED. Record manual tests, DB evidence, errors, confirmation, commit, and push URL.

## Pre-Sprint Research Gate

- Confirm Bun version/support on development and deployment hosts.
- Confirm remote repository state, default branch, authentication, and branch protection plan.
- Decide first provider/model and secret-storage method.
- Threat-model local-only versus internet-exposed deployment.
- Compare a minimal original scaffold with selective MIT-licensed reuse; create attribution ledger.
- Present findings and **stop for approval** before implementation.

## Implementation Stages

1. Initialize Git, `.gitignore`, contribution/security docs, branch policy, and workspace manifests.
2. Scaffold apps/packages and dependency-direction checks.
3. Define configuration, error, ID, provider, SSE, and repository contracts.
4. Add SQLite migration runner and minimal owner/profile/session schema.
5. Implement health/readiness and mock provider vertical slice.
6. Add formatting, lint, typecheck, unit/integration CI, secret scan, Docker skeleton, and dependency lock.

## Touchpoints

`.git*`, root manifests/config, `apps/api`, `packages/{core,agent,providers,db,client}`, initial migrations, `.github/workflows/ci.yml`, `Dockerfile`, `.env.example`, `docs/adr`, `LICENSE`, `THIRD_PARTY_NOTICES.md`.

## Public Contracts

Provider request/stream interface, repository transaction boundary, standard error envelope, ID prefixes, health/readiness response, migration versioning, environment variable names.

## Blast Radius

Program-wide. Poor decisions here affect every later sprint. Git remote mutation and secrets are high-risk; no push until user confirmation and secret scan.

## Test Stage

- Unit: config parsing, ID/error utilities, provider mock, migrations.
- Integration: start API against temporary SQLite; `/health` and `/ready`; migrate empty DB twice.
- Commands, finalized after scaffold: `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`, `docker build .`.
- Failure tests: missing config, read-only DB, failed migration, occupied port, unavailable provider.

## Verification Evidence

- Clean clone/install succeeds using documented commands.
- `schema_migrations` shows the expected version; rerun is idempotent.
- API health and graceful failure outputs are captured.
- CI run URL, container image digest, secret-scan result, commit hash, and branch URL are recorded in `reports/SPRINT_01_FOUNDATION_REPORT.md`.

## Done Criteria

User confirms the approved stack runs locally from a clean clone and approves the foundation before the first automated sprint-branch commit/push.

## Acceptance Criteria

- All quality commands and Docker build pass from a clean clone.
- Migrations are repeatable and health/readiness behavior is documented.
- No secret is tracked; user approves the stack and Git checkpoint.

## Blocker Rules

Block on unsupported runtime, unclear repository ownership/auth, unresolved secret storage, failed migrations/tests, license uncertainty for copied material, or any detected secret.

## What This Green Check Proves

The architecture and delivery path are viable enough to build product behavior without silently accumulating infrastructure debt.

## Implementation Checklist

- [x] Complete research gate and receive approval
- [x] Initialize Git/remote policy without pushing secrets
- [x] Scaffold workspace boundaries and quality scripts
- [x] Add contracts and mock provider with tests
- [x] Add migrations/repositories with idempotency tests
- [x] Add health/readiness integration test
- [x] Build Docker and CI/secret scan paths
- [x] Run manual clean-clone proof and record evidence
- [x] Receive user confirmation
- [ ] Commit atomically and push `feat/sprint-1-foundation`

## Resume and Execution Handoff

Primary execute anchor: this file. Supporting context: adaptation study and umbrella plan. Next action is research only; pause before code. After ✅ VERIFIED, resume with Sprint 02. Cursor imports this checklist; RIPER-5 follows RESEARCH → approval → EXECUTE → VERIFY.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_01_FOUNDATION_REPORT.md`.

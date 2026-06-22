# TinyClaw Independent Product Clone Program

Date: 22-06-26
Complexity: Complex — phase program
Approval: ✅ Approved by user on 22-06-26
Status: 🔨 ACTIVE — Phases 01–03 verified; Phase 04 research next

## Context and Goals

Rebuild TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa` as the observable product target for Bantuin without importing TinyClaw's multi-tenant hub-and-spoke architecture. Bantuin remains a single-owner, durable-state personal assistant and independently implements each capability behind its existing security and data boundaries.

Quick links: [Phases](#phased-delivery) · [Architecture](#architecture-decisions) · [Scope](#scope) · [Verification](#verification-evidence) · [Handoff](#resume-and-execution-handoff)

## Phase Completion Rules

A phase is not complete until integration, manual, state, failure, and user-confirmation checks pass.

- ⏳ PLANNED — not started
- 🔨 CODE DONE — written but not verified end to end
- 🧪 TESTING — verification in progress
- ✅ VERIFIED — tested and user-confirmed
- 🚧 BLOCKED — cannot proceed safely

Each phase records manual steps, state/API evidence, errors fixed, and explicit user confirmation in its report.

## Architecture Decisions

1. **Clone product behavior, not source architecture.** TinyClaw is a pinned reference; Bantuin code is independently implemented.
2. **Single-owner local-first runtime.** No organizations, invitations, tenant headers, roles, or platform administrator.
3. **Durable state is authoritative.** Messages, memory, knowledge, tasks, and automation runs survive restart in SQLite.
4. **Capability-oriented modular monolith.** `apps/api` composes use cases from existing packages; clients never embed agent execution.
5. **Default-deny actions.** Tools, MCP, automations, and channels require explicit allowlists, validation, timeout, audit, and cancellation.
6. **Ponytail dependency gate.** Native APIs and installed packages come first; a new dependency must remove more maintenance than it adds.
7. **No automatic upstream sync.** Every future TinyClaw update requires a new pinned comparison and explicit approval.

## Scope

In scope:

- TinyClaw-style web shell, navigation, chat, profiles, system, status, automations, tasks, and settings;
- rich chat states, model selection, attachments, knowledge, thinking/tool activity, retry, and branching;
- safe tools and MCP, scheduled automations, task execution, CLI, Telegram, WhatsApp, status, usage, Docker, and backup/restore;
- Bantuin branding and Bahasa Indonesia.

Out of scope:

- TinyClaw organizations, invitations, org roles, platform administration, and tenant switching;
- wholesale source/package-manifest copying;
- unsafe arbitrary execution without a separately approved sandbox contract;
- automatic merges from upstream.

## Phased Delivery

| Phase | Plan | Objective | Status | Report |
| --- | --- | --- | --- | --- |
| 01 | `TINYCLAW_CLONE_PHASE_01_WEB_EXPERIENCE_PLAN_22-06-26.md` | Replace the current approximation with a faithful functional web experience | ✅ VERIFIED | `reports/TINYCLAW_CLONE_PHASE_01_WEB_EXPERIENCE_REPORT.md` |
| 02 | `TINYCLAW_CLONE_PHASE_02_ASSISTANT_CAPABILITIES_PLAN_22-06-26.md` | Profiles, rich chat, model choice, files, knowledge, thinking, branching | ✅ VERIFIED | `reports/TINYCLAW_CLONE_PHASE_02_ASSISTANT_CAPABILITIES_REPORT.md` |
| 03 | `TINYCLAW_CLONE_PHASE_03_ACTIONS_PLAN_22-06-26.md` | Safe tools, MCP, automations, tasks, run history | ✅ VERIFIED | `reports/TINYCLAW_CLONE_PHASE_03_SAFE_ACTIONS_REPORT.md` |
| 04 | `TINYCLAW_CLONE_PHASE_04_CHANNELS_RELEASE_PLAN_22-06-26.md` | CLI, Telegram, WhatsApp, operations, backup, Docker, release | ⏳ PLANNED | `reports/TINYCLAW_CLONE_PHASE_04_CHANNELS_RELEASE_REPORT.md` |

Only one phase may be active. Research and approval for the next phase begin only after the current phase is ✅ VERIFIED.

## Public Contracts

- Existing `/v1` auth, profile, session, message, memory, knowledge, export, health, readiness, and SSE contracts remain compatible until a phase explicitly versions them.
- OpenRouter credentials remain server-only.
- Current SQLite migrations are append-only; no destructive migration without backup/restore proof.
- Browser mutations retain CSRF protection and owner authorization.
- Bantuin remains usable without live provider credentials in automated tests.

## Touchpoints

- `apps/web`: observable product clone and accessibility.
- `apps/api`: HTTP/OpenAPI/SSE composition and capability endpoints.
- `packages/agent`: orchestration, rich chat, tools, tasks, automations.
- `packages/core`: vendor-neutral contracts and validation.
- `packages/providers`: OpenRouter adapter and model metadata.
- `packages/db`: durable schema, repositories, audit/run history.
- `packages/client`: typed transport for web, CLI, and channels.
- `process/features/personal-ai-assistant`: phase plans, reports, research, provenance.

## Blast Radius

High. The program spans every application and package, authentication-adjacent UI, durable data, external providers, action execution, and messaging channels. Existing Sprint 3 work and the user's independent README edit must be preserved. No source replacement, reset, or bulk copy is authorized.

## Verification Evidence

Every phase report must include:

- exact automated commands and pass counts;
- browser screenshots at desktop, collapsed rail, tablet, and 320px when tooling is available;
- API/SQLite evidence for persisted state and deletion;
- failure, cancellation, restart, and permission scenarios;
- dependency and provenance changes;
- explicit user confirmation before commit or push.

Program gate: `bun run check && git diff --check`, phase-specific integration checks, and Docker/channel checks where applicable.

Testing context: `process/context/tests/all-tests.md`. Every phase plan defines its own test stage and records post-phase testing in its report.

## Post-Phase Testing

After each phase, rerun the full Bantuin gate, exercise the complete user flow, verify SQLite/API state, test at least one failure/recovery path, and stop for user confirmation. A later phase must not conceal a regression from an earlier one.

## Acceptance Criteria

- [ ] Observable in-scope TinyClaw product flows are available in Bantuin branding and Bahasa Indonesia.
- [ ] Architecture contains no organization/platform-admin tenancy model.
- [ ] Durable chat, memory, knowledge, tasks, automations, and deletion survive restart as specified.
- [ ] Powerful actions are default-deny, bounded, auditable, cancellable, and user-approved.
- [ ] Approved clients remain thin and share one typed API contract.
- [ ] No live secret is exposed to browser, logs, tests, exports, or Git.
- [ ] Every phase passes automated, manual, state, failure, and user-confirmation gates.
- [ ] License/provenance records cover all substantial reused material.

## Implementation Checklist

- [x] Approve this umbrella and Phase 01 scope.
- [x] Complete and verify Phase 01 before Phase 02.
- [x] Complete and verify Phase 02 before Phase 03.
- [x] Approve the security contract, then complete and verify Phase 03.
- [ ] Approve channel credentials/order, then complete and verify Phase 04.
- [ ] Run final cross-phase regression, recovery, provenance, and release review.
- [ ] Receive final approval before commit, push, or release.

## Change Management

- New TinyClaw feature: update the research inventory, assign a phase, request approval.
- New dependency: document the native/existing alternatives rejected and its removal value.
- New destructive migration or executable capability: stop and request a separate security/data approval.
- Upstream change: pin a new commit; never merge automatically.

## Resume and Execution Handoff

Read in order:

1. `process/context/all-context.md`
2. `references/TINYCLAW_ADAPTATION_STUDY_21-06-26.md`
3. this umbrella plan
4. the single active phase plan and its report
5. `SPRINT_03_MEMORY_PLAN_21-06-26.md` and report
6. `git status --short --branch`

Execution anchor after approval: `TINYCLAW_CLONE_PHASE_01_WEB_EXPERIENCE_PLAN_22-06-26.md` only.

## Cursor + RIPER-5 Guidance

- Cursor Plan mode: import only the active phase checklist.
- RIPER-5: research and approve one phase, execute it, verify it, obtain user confirmation, then advance.
- Never execute the whole program in one call.

Next instruction: begin Phase 02 pre-phase research only and stop before implementation approval.

# TinyClaw Clone Phase 02 — Assistant Capabilities

Date: 22-06-26
Complexity: Complex — phase 2 of 4
Status: ⏳ PLANNED

## Context and Objective

Implement TinyClaw-equivalent assistant profiles and rich-chat behavior through Bantuin's durable single-owner architecture.

## Phase Completion Rules

Completion requires integration, manual, state, failure, and user-confirmation evidence. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED.

## Dependencies

Phase 01 ✅ VERIFIED. Data model and upload limits require separate approval before migration.

## Scope

- multiple assistant profiles, system/soul instructions, model selection, per-profile knowledge;
- Markdown/code rendering, supported image/document attachments, thinking state, retry, branching, session titles;
- durable message and provenance continuity across restart.

Excluded: tools/actions, automations, tasks, and channels.

## Touchpoints

`apps/web`, `apps/api`, `packages/core`, `packages/agent`, `packages/providers`, `packages/db`, `packages/client`.

## Public Contracts

Version any expanded profile/message/upload API explicitly. Preserve existing single-profile clients during migration, server-only provider credentials, size/type validation, CSRF, and secure deletion.

## Blast Radius

High: profile/session/message schema and streamed event surface. Migrations must be append-only and reversible by backup restore.

## Test Stage

- Testing context: `process/context/tests/all-tests.md`.
- Unit/integration tests for profile isolation, model selection, uploads, branching, restart durability, deletion, malformed content, oversized files, and provider failure.
- Run `bun run check` and database migration/restart smoke.
- Manual chat flows with and without a provider.

What green proves: rich assistant behavior matches the product target while Bantuin remains durable and single-owner.

## Post-Phase Testing

Rerun all Phase 01 flows plus profile/rich-chat integration, restart, deletion, and failure checks; stop for user confirmation.

## Acceptance Criteria

- [ ] Profiles, model choice, supported files, knowledge, thinking, retry, and branching work.
- [ ] Messages and provenance remain durable and owner-scoped across restart.
- [ ] Upload and provider failures are bounded and recoverable.
- [ ] Existing clients remain compatible or migrate through a versioned contract.
- [ ] User confirms the complete rich-chat flow.

## Implementation Checklist

- [ ] Re-research pinned profile/chat flows and present contract delta.
- [ ] Approve schema/API/event changes.
- [ ] Write migration and repository tests first.
- [ ] Implement profile and rich-chat use cases minimally.
- [ ] Connect verified Phase 01 pages.
- [ ] Verify restart, deletion, failure, and accessibility.
- [ ] Record provenance/dependency changes.
- [ ] Receive user confirmation before commit or push.

## Verification Evidence

Report commands, schema/state queries, event samples without secrets, browser flows, failure results, and approval.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, Phase 01 report, current contracts/migrations, and pinned TinyClaw profile/chat sources. Start with contract research only.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 may enter RESEARCH only after Phase 01 verification.

Next Step: do not start execution until Phase 01 is ✅ VERIFIED.

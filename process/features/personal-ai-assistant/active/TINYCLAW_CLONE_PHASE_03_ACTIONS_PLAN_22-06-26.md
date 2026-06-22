# TinyClaw Clone Phase 03 — Safe Actions

Date: 22-06-26
Complexity: Complex — phase 3 of 4
Status: ⏳ PLANNED

## Context and Objective

Deliver TinyClaw-equivalent tools, MCP, automations, and tasks using a Bantuin-specific default-deny execution architecture.

## Phase Completion Rules

Completion requires integration, manual, state, failure, and user-confirmation evidence. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED.

## Dependencies

Phase 02 ✅ VERIFIED and a separately approved threat model/sandbox contract.

## Architecture Boundary

The model proposes typed actions; a policy layer validates owner approval, allowlist, arguments, timeout, output limit, cancellation, and audit before an executor runs. No raw TinyClaw bash/JavaScript handler is transplanted.

## Touchpoints

`packages/core`, `packages/agent`, `packages/db`, `apps/api`, `apps/web`, optional executor adapters, and audit/run tables.

## Public Contracts

Typed action proposals/results, approval lifecycle, MCP registry, automation schedules/runs, task states/runs, and SSE activity events. All mutations remain owner-authenticated and CSRF protected.

## Blast Radius

Critical: host execution, network access, credentials, recurring jobs, and durable state. Any uncontained execution path blocks the phase.

## Test Stage

- Testing context: `process/context/tests/all-tests.md`.
- STRIDE/security review before code.
- Tests for deny-by-default, schema validation, prompt-injection boundaries, timeout, output cap, cancellation, audit, restart recovery, scheduler duplication, and secret redaction.
- `bun run check`, isolated executor smoke, and manual approval/rejection flows.

What green proves: Bantuin can act like the product target without inheriting TinyClaw's execution trust model.

## Post-Phase Testing

Rerun prior-phase regressions plus approval, denial, timeout, cancellation, restart, duplicate-run, audit, and redaction checks; stop for user confirmation.

## Acceptance Criteria

- [ ] Every action is typed, allowlisted, bounded, cancellable, and audited.
- [ ] MCP, automation, and task flows deny unsafe or unauthorized input.
- [ ] Scheduler restart cannot duplicate completed work.
- [ ] Secrets never enter model-visible output, logs, exports, or Git.
- [ ] User confirms approval/rejection and run-history flows.

## Implementation Checklist

- [ ] Inventory target actions and delete speculative ones.
- [ ] Approve threat model and minimal executor set.
- [ ] Define typed contracts and audit schema.
- [ ] Test policy denial before happy-path execution.
- [ ] Implement MCP, automation, and task use cases incrementally.
- [ ] Verify restart, cancellation, duplication, and secret handling.
- [ ] Receive user confirmation before commit or push.

## Verification Evidence

Report threat-model decisions, tests, audit rows, denial samples, timeout/cancel proof, dependency/provenance delta, and approval.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, Phase 02 report, safety invariants, and pinned TinyClaw tool/task/automation sources as untrusted reference. Begin with threat modeling only.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 begins with security RESEARCH and cannot enter EXECUTE without threat-model approval.

Next Step: do not start execution until Phase 02 is ✅ VERIFIED.

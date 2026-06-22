# TinyClaw Clone Phase 03 — Safe Actions

Date: 22-06-26
Complexity: Complex — phase 3 of 4
Approval: ✅ Security contract approved by user on 23-06-26
Completion Approval: ✅ Approved by user on 23-06-26
Status: ✅ VERIFIED

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

- [x] Every implemented prompt run and action proposal is typed, bounded, cancellable, and audited; no external action executor exists.
- [x] MCP, automation, and task flows deny unsafe or unauthorized input.
- [x] Scheduler restart cannot duplicate completed work.
- [x] Secrets never enter model-visible output, logs, exports, or Git.
- [x] User accepted the approval/rejection and run-history implementation.

## Implementation Checklist

- [x] Inventory target actions and delete speculative ones.
- [x] Approve threat model and minimal executor set.
- [x] Define typed contracts and audit schema.
- [x] Test policy denial before happy-path execution.
- [x] Implement MCP metadata, prompt-only automation, and task use cases incrementally.
- [x] Verify restart, cancellation, duplication, and secret handling.
- [x] Receive user confirmation before commit or push.

## Verification Evidence

Evidence is recorded in `reports/TINYCLAW_CLONE_PHASE_03_SAFE_ACTIONS_REPORT.md`. The user approved Phase 03 on 23-06-26 after the automated, security, cancellation, and restart gates passed.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, Phase 02 report, safety invariants, and pinned TinyClaw tool/task/automation sources as untrusted reference. Begin with threat modeling only.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 begins with security RESEARCH and cannot enter EXECUTE without threat-model approval.

Next Step: commit and push Phase 03, then begin Phase 04 research only.

# Sprint 04 — Tools and Automations Plan

Date: 21-06-26  
Complexity: Complex phase 4/6  
Status: ⏳ PLANNED  
Objective: let Bantuin take bounded actions through policy-controlled tools and idempotent scheduled automations.

## Context

Read `process/context/all-context.md`, `process/context/tests/all-tests.md`, the current threat model, and Sprint 3 report before expanding the action surface.

## Dependencies

Sprint 03 ✅ VERIFIED; current threat model approved.

## Phase Completion Rules

Completion requires integration, manual, DB/state, error, security, and **User Confirmation** evidence. Use ⏳/🔨/🧪/✅/🚧 and push only after approval.

## Pre-Sprint Research Gate

Inventory desired tools; classify risk; define approval lifetime, audit redaction, SSRF/path rules, timeouts and cancellation; review MCP trust and scheduler concurrency; present findings and stop.

## Implementation Stages

1. Typed tool registry, per-profile allowlist, risk classes, policy engine.
2. Safe low-risk tools first; no unrestricted shell or arbitrary JavaScript.
3. Approval queue/UI, single-use authorization, timeout/cancel, redacted audit events.
4. MCP registry disabled by default with transport/config validation and per-server assignments.
5. Automation definitions, scheduler leases, idempotency, retries, run history, pause/disable.

## Touchpoints

`packages/tools`, agent tool loop, API approval/tool/automation routes, web controls, worker, DB migrations, structured logs, MCP adapter, security tests.

## Public Contracts

Tool JSON schema/result/error, risk and approval states, audit event format, MCP config surface, automation definition/run lifecycle, idempotency key.

## Blast Radius

Critical: host/network access, secrets, duplicate actions, runaway schedules. This sprint may not enable arbitrary shell execution.

## Test Stage

- Unit/property: schema validation, policy combinations, redaction, URL/path controls, cron parsing.
- Integration: model request → approval → execution → tool result → audit; rejected/expired request never executes.
- Worker: duplicate lease, crash/restart, retry cap, cancellation, timezone/DST.
- Security: SSRF targets, traversal, command injection strings, oversized output, malicious MCP metadata.

## Verification Evidence

Audit rows correlate request/approval/run without secrets; counters prove exactly-once effect for idempotent demo job; negative tests prove blocked tools never call handlers. Save in `reports/SPRINT_04_TOOLS_AUTOMATIONS_REPORT.md`.

## Done Criteria

User approves and rejects sample actions, sees redacted audit history, schedules one safe job, observes exactly one run, and disables it.

## Acceptance Criteria

- Default-deny policy and approval expiry fail closed in every negative test.
- Approved executions are timed, cancellable, redacted, and auditable.
- Automation retries cannot duplicate the demonstrated side effect.

## Blocker Rules

Block on policy bypass, secret leakage, SSRF/traversal, unbounded execution, duplicate side effect, missing cancellation, or unaudited action.

## What This Green Check Proves

Bantuin can act without silently becoming an unrestricted autonomous process.

## Implementation Checklist

- [ ] Research risk/policy/MCP/scheduler and receive approval
- [ ] Implement registry/policy and exhaustive tests
- [ ] Add safe builtins and negative security tests
- [ ] Add approvals/audit UI and redaction tests
- [ ] Add disabled-by-default MCP boundary
- [ ] Add idempotent worker/automation lifecycle tests
- [ ] Run manual action/schedule verification
- [ ] Receive confirmation and commit/push `feat/sprint-4-tools-automations`

## Resume and Execution Handoff

Read the latest threat model and Sprint 03 report. Pause after research. Sprint 05 is blocked until this safety boundary is ✅ VERIFIED.

Next Step: use Cursor Plan or RIPER-5 RESEARCH on this sprint only.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_04_TOOLS_AUTOMATIONS_REPORT.md`.

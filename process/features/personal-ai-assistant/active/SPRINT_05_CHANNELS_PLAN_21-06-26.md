# Sprint 05 — Channels Plan

Date: 21-06-26  
Complexity: Complex phase 5/6  
Status: ⏳ PLANNED  
Objective: add Telegram through the common runtime and make an evidence-based WhatsApp beta decision.

## Context

Read `process/context/all-context.md`, `process/context/tests/all-tests.md`, channel threat findings, and Sprint 4 report before adding external entrypoints.

## Dependencies

Sprint 04 ✅ VERIFIED; stable auth, sessions, tools, and audit contracts.

## Phase Completion Rules

Completion requires integration, manual, data, failure/security, and **User Confirmation** evidence. Use ⏳/🔨/🧪/✅/🚧; push only after confirmation.

## Pre-Sprint Research Gate

Review Telegram webhook/polling deployment fit, pairing and replay protection, identity mapping, rate limits, message size/formatting; assess WhatsApp library terms/reliability and issue a go/no-go; present findings and stop.

## Implementation Stages

1. Generic channel adapter and channel identity mapping.
2. Single-use pairing flow, revocation, allowlist, rate limits, replay/idempotency.
3. Telegram inbound normalization and outbound chunking/formatting through shared client/runtime.
4. Channel settings/status/diagnostics and secret-safe logs.
5. WhatsApp beta only if the research gate is explicitly approved; otherwise record deferral.

## Touchpoints

`apps/telegram`, optional `apps/whatsapp`, channel contracts/client, API pairing routes, DB identity mappings, web channel settings, deployment config and E2E mocks.

## Public Contracts

Channel adapter input/output, pairing code lifecycle, identity mapping, delivery/idempotency status, health diagnostics.

## Blast Radius

High for unauthorized external access, token leakage, replay, spam, and provider/library instability. Medium for formatting differences.

## Test Stage

- Unit: normalization, chunking, pairing expiry, identity matching, redaction.
- Integration: mocked Telegram update → common API/session → response delivery.
- E2E/manual: pair authorized account, reject unknown account, revoke, reconnect, restart.
- Failures: duplicate update, stale code, invalid signature/token, API outage, oversized message, rate limit.

## Verification Evidence

DB proves one owner mapping; logs correlate but redact identifiers/tokens; web and Telegram messages appear under intended sessions. Save in `reports/SPRINT_05_CHANNELS_REPORT.md`.

## Done Criteria

User pairs Telegram, chats successfully, verifies unknown/revoked users are blocked, and accepts the documented WhatsApp go/no-go decision.

## Acceptance Criteria

- Telegram uses the shared runtime and persistent data contracts.
- Pairing, expiry, revocation, replay protection, and rate limits pass tests.
- WhatsApp is either separately approved with evidence or explicitly deferred.

## Blocker Rules

Block on unauthorized access, token exposure, duplicate processing, channel-specific agent fork, unreliable recovery, or unapproved WhatsApp risk.

## What This Green Check Proves

External channels are thin, secure entrypoints to the same Bantuin assistant—not separate bots.

## Implementation Checklist

- [ ] Research channel security/deployment and WhatsApp go/no-go
- [ ] Implement channel adapter and identity mapping tests
- [ ] Implement secure pairing/revocation/rate limiting
- [ ] Implement Telegram adapter and integration mock
- [ ] Add settings/diagnostics and recovery tests
- [ ] Implement WhatsApp beta only if separately approved
- [ ] Run manual pairing/revocation proof
- [ ] Receive confirmation and commit/push `feat/sprint-5-channels`

## Resume and Execution Handoff

Read Sprint 04 report and channel threat findings. Stop after research. Sprint 06 requires this sprint ✅ VERIFIED, with WhatsApp allowed to remain deferred.

Next Step: use Cursor Plan or RIPER-5 RESEARCH on this sprint only.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_05_CHANNELS_REPORT.md`.

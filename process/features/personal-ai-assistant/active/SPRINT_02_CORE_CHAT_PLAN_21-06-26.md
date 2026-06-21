# Sprint 02 — Core Chat Plan

Date: 21-06-26  
Complexity: Complex phase 2/6  
Status: ⏳ PLANNED  
Objective: deliver owner setup, assistant profile, streamed web chat, and durable restart-safe history.

## Context

Build on Sprint 1 contracts. Read `process/context/all-context.md` and `process/context/tests/all-tests.md` before research; if missing, block and repair the foundation documentation.

## Dependencies

Sprint 01 ✅ VERIFIED; provider choice and security boundary approved.

## Phase Completion Rules

Completion requires integration, manual, DB/state, failure, and user-confirmation evidence. Use ⏳/🔨/🧪/✅/🚧 honestly and record the commit/pushed branch only after confirmation.

## Pre-Sprint Research Gate

Inspect current contracts/migrations; verify browser auth and CSRF design; test provider streaming/cancellation semantics; define message durability states and retry behavior; present findings and stop.

## Implementation Stages

1. Owner setup/login/logout and secure browser session.
2. Default profile with Indonesian-first system instructions and editable identity.
3. Session/message repositories with ordered durable events.
4. Agent harness plus OpenAI-compatible adapter, SSE stream, cancellation, retry/error state.
5. React setup wizard, chat, session list/history, responsive empty/error/loading states.
6. OpenAPI/client generation and full vertical E2E.

## Touchpoints

`apps/api` auth/chat/profile routes and services, `apps/web` setup/chat/history, `packages/agent`, provider adapter, client SSE parser, DB migrations/repositories, E2E tests.

## Public Contracts

`/v1/setup`, auth/profile/session/message endpoints; SSE ordering; message lifecycle states; provider cancellation; cookie and CSRF behavior.

## Blast Radius

High for authentication, provider credentials, message ordering, and SSE. Medium for UI/client compatibility.

## Test Stage

- Unit: prompt assembly, SSE parser, message state machine, auth/session expiry.
- Integration: setup → login → create session → streamed reply → restart → reload history.
- E2E: first-run setup and chat using deterministic mock provider; optional live-provider smoke excluded from default CI.
- Failures: invalid key, rate limit, timeout, disconnect, cancellation, duplicate submission, expired auth, malformed stream.

## Verification Evidence

DB query proves ordered user/assistant messages and failed/cancelled states; browser screenshot/video proves streaming/reload; logs prove no secret leakage. Save to `reports/SPRINT_02_CORE_CHAT_REPORT.md`.

## Done Criteria

User completes onboarding, chats in Indonesian, cancels one response, restarts the server, and confirms history/profile remain correct.

## Acceptance Criteria

- Setup/auth/profile/chat/history work through the shared API contract.
- Streams cancel cleanly and failures never lose or duplicate accepted messages.
- Restart retains ordered history and no provider secret reaches the browser/logs.

## Blocker Rules

Block on auth bypass, secret exposure, lost/duplicated messages, non-deterministic ordering, failed restart recovery, or broken cancellation.

## What This Green Check Proves

Bantuin's core loop is useful, durable, and secure enough to personalize.

## Implementation Checklist

- [ ] Complete research gate and approval
- [ ] Implement owner auth plus negative tests
- [ ] Implement profile and prompt assembly tests
- [ ] Implement durable sessions/messages and migration tests
- [ ] Implement provider stream/cancel and SSE tests
- [ ] Build setup/chat/history UI and accessibility checks
- [ ] Run restart-safe E2E and DB verification
- [ ] Receive user confirmation
- [ ] Commit/push `feat/sprint-2-core-chat`

## Resume and Execution Handoff

Read Sprint 01 report, umbrella plan, then this file. Execute only after research approval. Sprint 03 begins only after ✅ VERIFIED. Cursor imports this checklist; RIPER-5 enforces the pause.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_02_CORE_CHAT_REPORT.md`.

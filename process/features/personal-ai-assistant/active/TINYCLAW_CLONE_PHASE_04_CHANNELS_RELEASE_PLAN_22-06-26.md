# TinyClaw Clone Phase 04 — Channels and Release

Date: 22-06-26
Complexity: Complex — phase 4 of 4
Approval: ✅ Ten-point minimal contract approved by user on 23-06-26
Status: ✅ VERIFIED — automated gates, Docker smoke, and user approval complete on 23-06-26

## Context and Objective

Complete product parity with thin CLI, Telegram-first channel adapter, operational status, usage, backup/restore, Docker, and release evidence. WhatsApp remains deferred behind a separate approval.

## Phase Completion Rules

Completion requires integration, manual, state, failure, and user-confirmation evidence. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED.

## Dependencies

Phase 03 ✅ VERIFIED. Channel credentials and external message transmission require explicit environment-specific authorization.

## Architecture Boundary

Channels translate inbound/outbound events through `packages/client`; they never embed agent logic or access provider credentials. One owner mapping replaces TinyClaw organization/channel routing.

The approved implementation uses native `readline` for CLI, environment-only Telegram credentials, durable inbound deduplication, provider-reported usage, offline verified SQLite restore, and the existing non-root container. WhatsApp remains behind a separate approval.

## Touchpoints

New thin channel/CLI apps only when activated, `packages/client`, API channel endpoints, credential config, status/usage views, backup/restore scripts, Docker and release docs.

## Public Contracts

Channel identity mapping, deduplication keys, attachment limits, delivery status, webhook/signature verification where applicable, health/readiness, backup format/version, and image/runtime configuration.

## Blast Radius

High: external message delivery, credentials, network callbacks, filesystem backups, and deployment artifacts.

## Test Stage

- Testing context: `process/context/tests/all-tests.md`.
- Tests for inbound deduplication, authorization, formatting, attachments, retries, offline recovery, credential redaction, backup/restore integrity, and container persistence.
- `bun run check`, Docker build/run, SQLite volume restart, and opt-in channel sandbox tests.
- Manual delivery requires user authorization at action time.

What green proves: Bantuin delivers the TinyClaw product surface across approved channels and can be operated/recovered safely.

## Post-Phase Testing

Rerun the complete program regression, restore a backup into a clean instance, restart the container, test authorized channel failure/retry, and stop for final confirmation.

## Acceptance Criteria

- [x] CLI and Telegram clients remain thin and Telegram deduplicates inbound messages durably.
- [x] Credentials and private payloads remain outside logs, exports, tests, and Git.
- [x] Backup/restore reproduces verified SQLite state and attachments.
- [x] Container reports accurate readiness from the non-root runtime image.
- [x] User confirms CLI, fake Telegram, status/usage, and recovery flows.

## Implementation Checklist

- [x] Approve channel order and credential handling.
- [x] Extend `packages/client` with the smallest authenticated HTTP/SSE transport and implement a native `readline` CLI.
- [x] Persist aggregate provider usage and expose owner-authenticated status/usage.
- [x] Add durable Telegram identity/message claims and a fake-tested private-text adapter using environment credentials.
- [x] Add SQLite snapshot/checksum backup and guarded offline restore.
- [x] Add `/ready` container healthcheck; build and smoke-test the non-root image.
- [x] Complete license/provenance and release checklist.
- [x] Receive final user confirmation before commit/push/release.

WhatsApp, Baileys, rich terminal rendering, Compose, PM2, live outbound verification, and local pricing catalogs are explicitly deferred.

## Verification Evidence

Recorded in `process/features/personal-ai-assistant/reports/TINYCLAW_CLONE_PHASE_04_CHANNELS_RELEASE_REPORT.md`: `bun run check`, `git diff --check`, `docker build -t bantuin:phase04 .`, and `/ready` smoke on `127.0.0.1:55436`.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, Phase 03 report, client contracts, deployment context, and pinned TinyClaw channel sources as untrusted reference. Start with channel-order research only.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 begins with channel/deployment RESEARCH and requests action-time authorization for external messages.

Next Step: commit and push Phase 04, then begin final cross-phase release review only if requested.

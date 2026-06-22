# TinyClaw Clone Phase 04 — Channels and Release

Date: 22-06-26
Complexity: Complex — phase 4 of 4
Status: ⏳ PLANNED

## Context and Objective

Complete product parity with thin CLI, Telegram, and WhatsApp adapters plus operational status, usage, backup/restore, Docker, and release evidence.

## Phase Completion Rules

Completion requires integration, manual, state, failure, and user-confirmation evidence. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED.

## Dependencies

Phase 03 ✅ VERIFIED. Channel credentials and external message transmission require explicit environment-specific authorization.

## Architecture Boundary

Channels translate inbound/outbound events through `packages/client`; they never embed agent logic or access provider credentials. One owner mapping replaces TinyClaw organization/channel routing.

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

- [ ] Approved CLI/channel clients remain thin and deduplicate inbound messages.
- [ ] Credentials and private payloads remain outside logs, exports, tests, and Git.
- [ ] Backup/restore reproduces verified SQLite state and attachments.
- [ ] Container restart preserves data and reports accurate readiness.
- [ ] User confirms approved channel and recovery flows.

## Implementation Checklist

- [ ] Approve channel order and credential handling.
- [ ] Implement CLI first using the existing client contract.
- [ ] Implement Telegram, verify, then separately approve WhatsApp.
- [ ] Add status/usage and backup/restore with integrity checks.
- [ ] Build and restart the production container with persistent data.
- [ ] Complete license/provenance and release checklist.
- [ ] Receive final user confirmation before commit/push/release.

## Verification Evidence

Report commands, delivery IDs with sensitive values removed, dedup/retry evidence, backup hashes/restore queries, Docker persistence, notices, and approval.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, Phase 03 report, client contracts, deployment context, and pinned TinyClaw channel sources as untrusted reference. Start with channel-order research only.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 begins with channel/deployment RESEARCH and requests action-time authorization for external messages.

Next Step: do not start execution until Phase 03 is ✅ VERIFIED.

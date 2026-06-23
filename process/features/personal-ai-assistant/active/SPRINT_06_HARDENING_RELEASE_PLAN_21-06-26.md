# Sprint 06 — Hardening and Release Plan

Date: 21-06-26  
Complexity: Complex phase 6/6  
Status: ✅ PATCH VERIFIED — release-readiness patch approved for commit/push on 23-06-26
Objective: make v1 deployable, observable, recoverable, documented, and release-ready.

## Context

Read `process/context/all-context.md`, `process/context/tests/all-tests.md`, all prior reports, current ADRs, and current Git/CI state before the release audit.

## Dependencies

Sprints 01–05 ✅ VERIFIED, except an explicitly deferred WhatsApp beta.

## Phase Completion Rules

Completion requires integration, manual, DB/state, failure/recovery, security, and user-confirmation evidence. Use ⏳/🔨/🧪/✅/🚧; release/merge/tag requires explicit approval.

## Pre-Sprint Research Gate

Audit architecture drift, dependencies/licenses, auth/secrets, migrations, logs, performance budgets, backup/restore, deployment target, and release/rollback procedure; present findings and stop.

Audit findings and the release-readiness patch are recorded in `process/features/personal-ai-assistant/reports/SPRINT_06_HARDENING_RELEASE_REPORT.md` on 23-06-26. No release, tag, merge, or live channel action is approved yet.

## Implementation Stages

1. Structured redacted logs, request/run correlation, health/readiness, minimal metrics.
2. Backup, restore, schema upgrade, rollback/runbook drills.
3. Security hardening and dependency/license/secret/container scans.
4. Performance/load/context-cost budgets and accessibility/browser E2E.
5. Multi-stage Docker image, persistent volumes, sample deployment, operator/user docs.
6. Release candidate evidence, changelog, version, PR; merge/tag/publish only with explicit approval.

## Touchpoints

All apps/packages, migrations, CI/release workflows, Docker/deployment files, monitoring/logging, docs/runbooks, licenses/notices, E2E/load/security tests.

## Public Contracts

Health/readiness, backup/export version, migration compatibility, environment configuration, log fields/redaction, Docker volume/port behavior, release versioning.

## Blast Radius

Program-wide. Backup, migrations, deployment, and release automation can cause data loss or outage; remote publication is externally visible.

## Test Stage

- Clean-clone CI and production build.
- Playwright critical flows; API integration suite; provider/channel mocks.
- Load test concurrent streams and scheduled jobs against stated budgets.
- Backup clean DB, populate, backup, restore to new volume, compare counts/checksums, upgrade from previous schema.
- Security scans and manual authorization regression.
- Container restart, disk-full/read-only simulation where feasible, graceful shutdown, rollback rehearsal.

## Verification Evidence

Attach CI URLs, image digest/SBOM, scan summaries, E2E artifacts, performance table, backup/restore commands and redacted results, migration/rollback evidence, docs review, commit/PR URL to `reports/SPRINT_06_HARDENING_RELEASE_REPORT.md`.

## Done Criteria

User deploys or reviews a fresh deployment, completes critical flows, observes health/logs, restores backup, and explicitly approves the v1 release/merge decision.

## Acceptance Criteria

- Clean deployment, critical E2E, security scans, and performance budgets pass.
- Backup/restore and schema upgrade are proven on a separate volume.
- Operator docs are sufficient and release mutation has explicit approval.

## Blocker Rules

Block on critical/high exploitable findings, secret exposure, data-loss recovery failure, migration incompatibility, failing critical E2E, undocumented operation, or unapproved remote release.

## What This Green Check Proves

Bantuin v1 can be operated and recovered—not merely demonstrated on one development machine.

## Implementation Checklist

- [x] Complete hardening/release audit and receive approval
- [ ] Add observability/redaction tests
- [ ] Implement and prove backup/restore/upgrade
- [ ] Run security/license/secret/container scans
- [ ] Run E2E, accessibility, load, and shutdown tests
- [x] Finalize Docker/deployment/user/operator docs
- [x] Prepare release candidate and evidence report
- [x] Receive explicit user confirmation
- [ ] Commit/push `feat/sprint-6-release`; open PR
- [ ] Merge/tag/publish only under separate explicit approval

## Resume and Execution Handoff

Read every prior sprint report, the umbrella acceptance criteria, and current Git/CI state. Stop after audit findings. Cursor imports this checklist only; RIPER-5 requires approval before execution and again before release mutation.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_06_HARDENING_RELEASE_REPORT.md`.

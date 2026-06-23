# Sprint 06 — Hardening and Release Report

Date: 23-06-26  
Status: ✅ PATCH VERIFIED — approved for commit/push on 23-06-26

## Scope

Release-readiness patch only. No tag, release, merge, live Telegram delivery, WhatsApp activation, or production publish was performed.

## Automated Evidence

Commands run:

```bash
bun run check
bun audit
git diff --check
docker build -t bantuin:release-readiness .
docker run --rm -d --name bantuin-release-readiness-smoke -p 55437:4310 bantuin:release-readiness
bun -e "await new Promise(r=>setTimeout(r,1000)); for (const path of ['/ready','/health']) { const r=await fetch('http://127.0.0.1:55437'+path); console.log(path, r.status, await r.text()); }"
docker stop bantuin-release-readiness-smoke
bun run release:smoke
```

Results:

- `bun run check`: passed.
- Tests: 39 passed, 0 failed, 196 assertions.
- Secret scan: passed for 109 files.
- Builds: API, web, CLI, and Telegram passed.
- `bun audit`: no vulnerabilities found.
- `git diff --check`: passed.
- Docker build: passed.
- Container smoke:
  - `/ready`: `200 ready`.
  - `/health`: `200`, API version `1.0.0-rc.1`.
- `bun run release:smoke`: passed.
  - Checks: E2E setup/session/status, static accessibility guard, backup/restore, and 40-request health/readiness load smoke.
  - Load result: 40 requests, 3 ms local duration in the latest run.
  - Note: authenticated SSE chat is covered by the integration suite; the release smoke intentionally avoids duplicating the SSE stream client because that made the smoke harness flaky under Bun child-process streaming.

## Release Blockers

Resolved in this patch:

- `README.md` now documents current v1 features, setup, CLI, Telegram, backup/restore, Docker, rollback, and quality gates.
- `.env.example` now includes CLI/Telegram/runtime variables with empty safe defaults.
- Runtime API version is now `1.0.0-rc.1`.
- README contains the compact release/rollback runbook.
- `THIRD_PARTY_NOTICES.md` now references TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa` and states no substantial source copy.

| Severity | Area | Finding | Required before v1 |
| --- | --- | --- | --- |
| Medium | Container scan/SBOM | Docker image builds and runs, but no dedicated image vulnerability scan or SBOM evidence exists. | Run a scanner if available, or document as a release risk/defer. |
| Low | Logging | Logs are simple console lines, not structured correlation logs. Secret redaction exists for action output and tests, but general structured logging is not implemented. | Add only if needed for deployment; otherwise document local-first limit. |

## Security Audit Summary

No unresolved Critical or High exploitable code finding was found in this audit pass. Existing controls observed:

- Argon2id password hashing.
- Opaque session cookies, token hashes in SQLite, `HttpOnly`, `SameSite=Strict`, and HTTPS-only `Secure`/`__Host-` behavior.
- CSRF header/origin checks on browser mutations.
- Parameterized SQLite queries.
- Owner-scoped repository access.
- Request body limits, login throttling, provider timeout, stream cancellation.
- Secret scan and dependency audit pass.
- Telegram credentials remain environment-only.
- Backup restore validates checksum, schema, integrity, and refuses overwrite.

## Recommendation

The user approved this release-readiness patch for commit/push on 23-06-26.

Stop again for explicit user approval before merge, tag, publish, live Telegram, or WhatsApp.

# TinyClaw Clone Phase 04 — Channels and Release Report

Date: 23-06-26  
Status: ✅ VERIFIED — approved by user for commit/push on 23-06-26

## Outcome

Phase 04 is implemented behind the approved minimal contract:

- native `readline` CLI using the shared authenticated HTTP/SSE client;
- Telegram-first adapter with private-text allowlist and durable inbound deduplication;
- owner-authenticated runtime status plus aggregate provider-reported usage;
- SQLite backup/restore with checksum, schema, and integrity validation;
- non-root Docker runtime with `/ready` healthcheck.

WhatsApp, Baileys, Compose, PM2, live channel delivery, and pricing catalogs remain deferred.

## Implementation Evidence

- Added `apps/cli` with `/new`, `/status`, and `/exit`.
- Added `apps/telegram` with env-only credentials: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID`, `BANTUIN_EMAIL`, `BANTUIN_PASSWORD`, and optional `BANTUIN_API_URL`.
- Added `packages/client/src/http-client.ts` as the single thin transport for CLI/channel apps.
- Added migration `0006_channels_release.sql` for `channel_sessions`, `channel_inbound_messages`, and `owner_usage`.
- Added `/v1/system/status` and `/v1/channels/telegram/claims`.
- Added `scripts/database-backup.ts` for offline backup/restore.
- Added Docker `HEALTHCHECK` against `/ready`.

## Security Notes

- No live Telegram or WhatsApp message was sent during implementation.
- Channel secrets are read from environment only and are not persisted, exported, or logged.
- Telegram polling has a 1s backoff on repeated errors.
- Restore refuses in-memory targets, incompatible manifests, checksum mismatches, failed integrity checks, schema mismatches, and existing target files.
- `bun run check` includes secret scan and passed.

## Verification

Commands run:

```bash
bun run check
bun audit
git diff --check
docker build -t bantuin:phase04 .
docker run --rm -d --name bantuin-phase04-smoke -p 55436:4310 bantuin:phase04
bun -e "await new Promise(r=>setTimeout(r,1000)); const r=await fetch('http://127.0.0.1:55436/ready'); console.log(r.status, await r.text())"
docker stop bantuin-phase04-smoke
```

Results:

- `bun run check`: pass.
- `bun audit`: no vulnerabilities found.
- Tests: 39 passed, 0 failed, 196 assertions.
- Secret scan: passed for 107 files.
- Build: API, web, CLI, and Telegram passed.
- Docker build: passed after one registry/cache retry.
- Container readiness smoke: `200 {"status":"ready","checks":{"database":"ok","providerConfiguration":"ok"}}`.
- `git diff --check`: pass.

## User Approval

The user approved Phase 04 for commit/push on 23-06-26.

Live Telegram delivery, WhatsApp, tags, and release publishing still require separate action-time approval.

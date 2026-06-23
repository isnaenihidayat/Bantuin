# TinyClaw Phase 04 — Channels and Release Study

Date: 23-06-26  
Mode: Xia `--adapt` research only  
Status: Ready for contract review; no implementation authority  
Reference: TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`

## Scope

Study only the final product surfaces: CLI, Telegram, WhatsApp, status/usage, backup/restore, Docker, and release evidence. TinyClaw is untrusted reference material; no source code or architecture is transplanted.

## Source Manifest

| Surface | Primary source | Observed behavior |
| --- | --- | --- |
| CLI | `apps/cli/src/chat.ts`, `commands.ts`, `cli-config.ts` | Thin client, profile selection, streamed chat, cancellation, slash commands, optional images |
| Telegram | `apps/platform/telegram/*` | `grammy`, private chats, one-time pairing, per-chat serialization, stream cancellation, split replies |
| WhatsApp | `apps/platform/whatsapp/*` | Baileys socket, private chats, QR/pairing state, reconnect, stream cancellation |
| Shared client | `packages/client/src/client.ts`, `stream.ts` | HTTP/SSE transport; source-specific auth and organization headers |
| Status/usage | `system-status-service.ts`, `llm-usage-tracker.ts` | Runtime worker status and durable aggregate token/cost counters |
| Container | `Dockerfile` | Multi-stage Bun image, healthcheck, persistent config volume |
| Backup/restore | No first-class source implementation found | Persistence relies on the mounted volume |

## Source Map

### CLI

TinyClaw's CLI owns terminal rendering, input queues, clipboard images, profile/model commands, and cancellation, but delegates sessions and streaming to the shared HTTP client. Most terminal-frame machinery is presentation complexity, not a required assistant capability.

### Telegram

The Telegram bridge accepts private chats only, authorizes a numeric user ID through a one-time pairing code, serializes work per chat, binds a chat to a remote session, and supports `/new`, `/clear`, `/compact`, `/status`, and `/stop`. The pinned implementation has in-memory chat locks but no durable inbound update-id deduplication.

### WhatsApp

The WhatsApp bridge uses the unofficial Baileys protocol client and stores device authentication state outside the main database. It filters groups, authorizes a JID, reconnects the socket, and exposes roughly the same chat commands. This introduces a large credential state, compatibility, and account-policy surface.

### Operations

TinyClaw records aggregate provider usage and reports worker status. Its container has a healthcheck and volume, but the pinned commit does not define a verified backup/restore workflow.

## Local Integration Map

| Local area | Current capability | Smallest Phase 04 addition |
| --- | --- | --- |
| `packages/client` | SSE codec only | Thin authenticated HTTP/SSE client used by CLI and channels |
| `apps/api` | Owner auth, chat SSE, health/readiness, durable runs | Channel ingress boundary, status/usage read API, dedup claims |
| `packages/core` | Provider usage events and validated env config | Channel-neutral message/result types only if shared twice |
| `packages/db` | SQLite migrations and owner-scoped repositories | Channel identity/dedup plus aggregate usage migration |
| `apps/cli` | Absent | Native `readline` chat client; no custom terminal renderer |
| Telegram app | Absent | One `grammy` adapter after credential approval |
| WhatsApp app | Absent | Deferred behind a separate explicit approval |
| Docker | Multi-stage, non-root, `/data` volume | Healthcheck only; no Compose unless deployment needs it |
| Backup | JSON owner export only | SQLite-consistent snapshot, checksum manifest, offline restore guard |

## Dependency and Conflict Matrix

| Capability | Status | Source dependency | Local decision |
| --- | --- | --- | --- |
| CLI text chat | EXISTS in API | Custom terminal stack | Use Bun/Node `readline`; no dependency |
| Shared transport | PARTIAL | Source client package | Extend existing `packages/client` minimally |
| Telegram | NEW | `grammy` | One justified dependency after contract approval |
| WhatsApp | CONFLICT | `@whiskeysockets/baileys` plus device state | Defer; separate risk and credential gate |
| Inbound dedup | NEW | Not durable in source | SQLite unique `(channel, external_message_id)` |
| Usage events | EXISTS | Source aggregate tracker | Persist existing provider usage events; do not invent pricing |
| Runtime status | PARTIAL | Source worker manager | Report API/database/provider/scheduler and enabled adapters only |
| Docker | EXISTS | Bun image | Keep current image; add native healthcheck |
| Backup/restore | NEW | No source feature | SQLite-native consistent snapshot and SHA-256 manifest |
| Process manager | CONFLICT | Source worker lifecycle | No PM2 or supervisor; one process per container/app |

## Challenge Questions

| # | Question | Source answer | Local answer | Risk if wrong |
| --- | --- | --- | --- | --- |
| 1 | Do we need TinyClaw's rich terminal UI? | Custom renderer, sticky prompt, clipboard and queues | A text-first `readline` CLI already reaches the same API value | Medium: large maintenance surface with little product gain |
| 2 | Should channel credentials live in dashboard files/database? | Tokens and pairing data use local config files | Secrets remain environment-only; database stores non-secret identity mappings | Critical: export or backup could leak credentials |
| 3 | Can Telegram delivery be retried blindly? | Adapter sends replies directly | Inbound is durably deduplicated; outbound retries only on clearly retryable failures | Critical: duplicate external messages |
| 4 | Can WhatsApp ship with Telegram? | Baileys bridge is part of the source workspace | No; unofficial protocol and durable device keys require a separate approval | Critical: account lockout or credential compromise |
| 5 | Is JSON export a recoverable backup? | Source has no first-class restore workflow | No; use a SQLite snapshot plus manifest, and restore only while API is stopped | Critical: partial or corrupt recovery |
| 6 | Do we need PM2/worker controls? | Source status integrates worker management | No; process/container runtime owns restarts | Low: duplicate lifecycle ownership if copied |
| 7 | Should cost be recalculated locally? | Source estimates from pricing metadata | Preserve provider-reported cost when present; otherwise report tokens without fake precision | Medium: misleading usage totals |
| 8 | Is Docker Compose required? | Source ships one Dockerfile | No; current Dockerfile and named volume cover the single-service runtime | Low: deployment boilerplate without a second service |

## Decision Matrix

| # | Decision | Source way | Local way | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | CLI UX | Rich terminal framework | Native line-oriented client | Low | Local |
| 2 | Client architecture | Broad source client | Minimal Bantuin owner client | Low | Local |
| 3 | Telegram auth | Pairing/config file | Environment token + one allowlisted user ID | Medium | Local, safer and smaller |
| 4 | Channel idempotency | In-memory serialization | Durable database claim | Medium | Local |
| 5 | WhatsApp | Baileys now | Separate gated phase | Critical | Defer |
| 6 | Usage | Persistent aggregate with estimates | Persist provider usage, exact cost only when supplied | Low | Hybrid |
| 7 | Backup | Volume only | Verified SQLite snapshot/restore | Critical | Local |
| 8 | Deployment | Root-oriented config volume | Existing non-root `/data` image | Low | Keep local |

## Risk Summary

Risk: **Medium**. Four critical assumptions exist: secret placement, external-message idempotency, WhatsApp device credentials, and destructive restore. They are containable only if Telegram is implemented before WhatsApp, live delivery remains separately authorized, secrets stay environment-only, and restore is offline with checksum and schema validation.

## Recommended Minimal Contract

1. Implement a text-first CLI with native `readline`; reuse the authenticated API/SSE contract and add no terminal UI dependency.
2. Implement Telegram before WhatsApp. Accept private text messages only initially; one configured numeric user ID maps to the single Bantuin owner/profile.
3. Keep `TELEGRAM_BOT_TOKEN` and channel secrets environment-only. Never persist or return them through API, logs, export, backup manifest, tests, or Git.
4. Claim every inbound external message durably by channel and external message ID before creating a Bantuin message. Duplicate claims return the recorded result or no-op.
5. Do not send any live external message during development or verification without action-time approval of channel and recipient. Automated tests use fakes.
6. Defer WhatsApp and Baileys until Telegram, backup/restore, and container recovery are verified, then request a separate approval for device credentials and account-policy risk.
7. Persist aggregate input/output tokens and provider-reported cost when available. Do not add a pricing catalog or billing subsystem.
8. Back up SQLite using a database-consistent snapshot with a SHA-256 manifest. Restore only while stopped, into a new path, after checksum and schema checks; never overwrite the sole database in place.
9. Keep the current non-root Docker image and `/data` volume. Add a native `/ready` healthcheck; skip Compose and process managers.
10. Complete license/provenance and full regression evidence before release; commit/push/release still require explicit user confirmation.

## Recommendation and Stop

Proceed only after the ten-point contract is approved. The first implementation slice should be CLI + shared transport + usage persistence; Telegram follows behind its credential gate. WhatsApp remains outside that authorization.

If you want to turn this into implementation work, use generate-plan with this research artifact.

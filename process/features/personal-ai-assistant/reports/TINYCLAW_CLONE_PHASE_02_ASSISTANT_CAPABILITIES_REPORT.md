# TinyClaw Clone Phase 02 — Assistant Capabilities Report

Date: 23-06-26
Status: ✅ VERIFIED — approved by user on 23-06-26
Reference: TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`

## Approved Contract

The user approved the Phase 02 contract on 22-06-26:

- profiles are archived and never cascade-delete chat history;
- attachments use separate durable storage with a 5 MiB per-file limit;
- knowledge is isolated per profile and existing documents are backfilled;
- thinking state waits for a verified OpenRouter SDK event contract;
- Markdown rendering may add one maintained safe renderer dependency.

## Implemented

- Multiple active assistant profiles with per-profile system prompt and configured model choice.
- Profile archive protection for the final active profile while preserving its historical sessions.
- Per-profile knowledge listing, indexing, search, deletion, and migration backfill.
- Durable image and text/Markdown attachments with strict type, base64, count, and size validation.
- OpenRouter multimodal user-message mapping without exposing provider credentials to the browser.
- Deterministic first-message session titles without an additional provider request.
- Durable conversation branches at completed-message checkpoints, including copied attachments.
- Profile, model, attachment, branch, copy, retry, and archive controls in the Phase 01 web shell.
- Expanded OpenAPI route inventory while keeping the existing `/v1/profile` compatibility route.
- Safe Markdown and code rendering through `react-markdown`; raw HTML rendering is not enabled.

## Schema and State

Migration `0004_assistant_capabilities.sql` is append-only. It adds profile archive metadata, branch provenance, per-profile knowledge ownership, and `message_attachments`. Historical knowledge is assigned to the owner's first profile before profile ownership becomes mandatory.

Profile deletion is logical archive. Chat sessions and messages remain readable after archive. Branch creation is transactional and rejects a missing or incomplete checkpoint.

## Verification Evidence

Focused integration:

```text
bun test packages/db/src/database.test.ts apps/api/src/app.test.ts
18 pass, 0 fail, 126 assertions
```

Full project gate:

```text
bun run check
format, lint, typecheck, package boundaries, secret scan, tests, and production build passed
30 pass, 0 fail, 152 assertions
```

Additional checks:

- `git diff --check` passed.
- API started twice against the same SQLite file; `/ready` returned `ready` after restart.
- Invalid attachment base64 returns HTTP 400.
- Archiving a profile preserves its session history; archiving the last active profile returns HTTP 409.
- Branch history contains the expected messages and attachment records.

## Approved Deferral

- Thinking-state UI and events are intentionally deferred until the OpenRouter SDK contract is proven, as approved.
- Automated browser visual verification was unavailable in this session; the user explicitly accepted Phase 02 on 23-06-26 after the automated, restart, state, and failure gates passed.

## Dependency and Provenance

No TinyClaw source file or architecture was copied. The pinned repository remains a product-behavior reference. `react-markdown@10.1.0` is the single approved production dependency added for safe Markdown rendering; no handwritten parser or raw-HTML plugin was added.

`README.md` remains an unrelated user-owned working-tree change and is excluded from Phase 02.

## Confirmation

The user approved Phase 02 on 23-06-26 and authorized the planned commit and push. Browser regression remains a follow-up check when the integrated browser is available.

# TinyClaw Clone Phase 03 — Safe Actions Report

Date: 23-06-26
Status: ✅ VERIFIED — approved by user on 23-06-26
Reference: TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`

## Approved Contract

The user approved the eight-point Phase 03 security contract on 23-06-26. The implementation intentionally excludes shell, dynamic JavaScript, filesystem mutations, email, arbitrary HTTP, stdio MCP, connector credentials, and provider-driven tool execution.

## Implemented

- Durable owner/profile-scoped tasks with explicit prompt-only runs, archive semantics, status, ordering, cancellation, and run history.
- Durable prompt-only manual/scheduled automations, disabled by default, five-field cron matching, native 30-second tick, no missed-run replay, and transactional occurrence claims.
- Shared 60-second run timeout, `AbortController` cancellation, 32 KiB output cap, and secret-pattern redaction before persistence/export.
- Startup lease recovery for interrupted task and automation runs.
- Durable action proposal lifecycle and database-enforced append-only decision events. No action executor or public proposal-creation endpoint exists.
- MCP HTTPS metadata and cached tool descriptions only. Records are permanently disabled by database constraint; no connection, secret, stdio, or execution surface exists.
- Minimal Tasks and Automations pages using the existing Bantuin shell; task status changes never trigger execution.
- OpenAPI inventory and data export extended with safe-action metadata and run history.

## Schema and State

Migration `0005_safe_actions.sql` adds tasks/runs, automations/runs, action proposals/events, and MCP metadata. Definition deletion is logical archive. Run and approval history use restrictive foreign keys and remain durable. `(automation_id, occurrence_key)` prevents duplicate scheduled claims across restart.

## Security Evidence

- Unsafe MCP URL (`http://127.0.0.1`) is rejected; stored MCP metadata requires a clean HTTPS URL.
- MCP metadata has a database constraint `enabled = 0` and no execution route.
- Task and automation runs only call the configured model with profile prompt context.
- Cancellation is bound to the authenticated owner and reaches a durable `cancelled` terminal state.
- Run output and errors are capped and redacted before persistence.
- Action events reject SQL `UPDATE` and `DELETE` through append-only triggers.
- No Phase 03 production dependency was added; scheduler and cron matching use native APIs.
- `bun audit` reported no vulnerabilities and the repository secret scan passed.

## Verification Evidence

```text
bun run check
format, lint, typecheck, boundaries, secret scan, all tests, API build, and web build passed
34 pass, 0 fail, 177 assertions
```

Additional evidence:

- Focused migration/repository/API tests cover duplicate claims, approval decisions, invalid cron, SSRF-shaped MCP metadata, prompt-only execution, cancellation, and redaction.
- `git diff --check` passed.
- The built API started twice against the same Phase 03 SQLite file; `/ready` returned `ready` after restart.

## Approved Deferrals

- No host or network action executor.
- MCP connection/tool execution and connector credentials remain deferred.
- Provider tool-call events and model-created action proposals remain deferred until their SDK contract is proven.
- Automated visual verification remains pending because the integrated browser was unavailable.

## Confirmation

The integrated browser remained unavailable, so automated visual verification could not be recorded. The user explicitly accepted Phase 03 on 23-06-26 after the automated, restart, and security gates passed, and authorized its commit and push.

`README.md` remains an unrelated user-owned working-tree change and is excluded from Phase 03.

# Sprint 02 Core Chat Report

Date: 22-06-26
Sprint status: ✅ VERIFIED — approved by user on 22-06-26
Branch: `feat/sprint-2-core-chat`

## What's Functional Now

- First-run single-owner setup with Argon2id password hashing.
- Secure browser login/logout with opaque hashed SQLite sessions, CSRF/origin checks, session rotation, expiry, and login throttling.
- Editable Indonesian-first assistant identity and system prompt.
- Durable session list and ordered user/assistant message history.
- SSE chat through the existing mock/OpenRouter provider boundary.
- Duplicate request protection, partial-stream persistence, explicit cancellation/retry, and interrupted-stream recovery after restart.
- Responsive TinyClaw-inspired dark React UI for setup, login, history, chat, cancel/retry, and profile settings.
- Production React assets served from the same Hono API origin.

## Implementation Summary

- Migration `0002_core_chat.sql` adds credentials, auth sessions, and lifecycle-aware messages.
- Public API v2 covers setup, auth, profile, sessions, history, send, cancel, and retry; paths are listed in `/openapi.json`.
- React 19/Vite 8 plus a self-hosted Plus Jakarta Sans font form the UI stack; no router, state library, component kit, ORM, auth library, or additional SSE parser was added.
- API requests are capped at 64 KiB, provider streams time out after 120 seconds, static responses receive CSP/security headers, and session lists are capped at 100.
- API version is `2.0.0-core-chat`.

## Automated Evidence

- `bun run check`: format, lint, strict types, boundaries, secret scan, 24 tests, API bundle, and web bundle pass.
- Test result: 24 passed, 0 failed, 85 assertions.
- Web production output: 200.87 kB JavaScript (63.35 kB gzip) and 13.37 kB CSS (5.12 kB gzip), plus self-hosted font assets.
- `bun audit`: no vulnerabilities found.
- Docker image `bantuin:sprint2`: `sha256:c205cde63444bad1629d2bedf3d2672f6e1fbf348a6a9717ee73ab447672ff5b`.
- Docker runtime smoke: `/health` returned API version `2.0.0-core-chat`; `/` served the production React HTML.
- `bun run dev` starts both the API at `127.0.0.1:4310` and Vite UI at `127.0.0.1:5173`.
- Restart test reopens the same SQLite file and converts an interrupted assistant message to durable `failed/STREAM_INTERRUPTED` state.
- Failure coverage includes missing CSRF/origin, wrong password, login throttling, duplicate request, provider cancellation, retry, malformed input, closed DB, and provider abort.

## Security Audit

STRIDE/OWASP review found no unresolved Critical or High issue in the current local-first boundary. Controls include exact-origin CSRF validation, `HttpOnly`/`SameSite=Strict` cookies, `Secure`/`__Host-` cookies under HTTPS, SHA-256 session-token storage, Argon2id credentials, parameterized SQL, owner-scoped resource queries, CSP/security headers, generic auth failures, request-size limits, provider timeout, secret scan, and dependency audit.

Known low/medium ceilings:

- Login throttling is process-local; move it to shared storage before horizontal deployment.
- Session/history lists use simple fixed limits rather than cursor pagination.
- Security event logging and alerting belong to the hardening sprint.
- Public-internet deployment still requires TLS and a reviewed reverse proxy configuration.

## User Confirmation

The user explicitly approved Sprint 2 on 22-06-26 after the TinyClaw-inspired UI redesign. The in-app browser automation was unavailable, so no screenshot evidence is claimed; automated accessibility structure, focus states, responsive CSS, API integration, and production build gates remain green.

## Research Outcome

Sprint 1 already provides the required provider contract, OpenRouter streaming adapter, SSE codec, request IDs, SQLite migration runner, owner/profile/session skeleton, and deterministic mock provider. Sprint 2 should extend those pieces rather than introduce a second agent framework, auth library, ORM, or SSE dependency.

## Proposed Security Contract

- Single-owner setup closes permanently after the first owner is created.
- Passwords use asynchronous `Bun.password.hash`/`verify` with Argon2id; no auth dependency is needed.
- Browser sessions use random opaque tokens. Only a SHA-256 token digest is stored in SQLite.
- Session cookies are `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` outside local HTTP development. Production uses the `__Host-` prefix.
- All state-changing JSON requests require an `X-CSRF-Token` custom header and exact configured-origin validation. CORS credentials are not enabled for arbitrary origins.
- Login rotates the session token; logout deletes the database session and cookie. Auth responses use `Cache-Control: no-store`.
- Provider keys remain process environment values and never enter API responses, browser storage, SQLite, or logs.

This follows the platform capabilities and current guidance from [Bun password hashing](https://bun.sh/docs/runtime/hashing), [Hono cookie helpers](https://hono.dev/docs/helpers/cookie), [Hono CSRF middleware](https://hono.dev/docs/middleware/builtin/csrf), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), and [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Proposed Persistence Contract

Migration `0002_core_chat.sql` adds:

- `owner_credentials`: one Argon2id password hash per owner.
- `auth_sessions`: hashed token, owner, creation, expiry, and last-seen timestamps.
- `chat_messages`: session-local monotonic sequence, role, content, lifecycle status, error/provider metadata, and client request ID.

Message lifecycle:

```text
user:      accepted -> completed
assistant: pending -> streaming -> completed
                              \-> failed
                              \-> cancelled
```

The user message and pending assistant row are inserted in one transaction before provider work starts. `(session_id, sequence)` and `(session_id, client_request_id)` are unique so duplicate submissions cannot create duplicate accepted messages. Partial assistant text is persisted during streaming. Any `pending` or `streaming` row left after restart becomes `failed` with an interruption code and remains visible in history.

There is no automatic provider retry after streaming begins. Retry is explicit and creates a new assistant attempt, avoiding hidden duplicate billing or duplicated text.

## Proposed API Surface

- `GET /v1/setup/status`, `POST /v1/setup`
- `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me`
- `GET /v1/profile`, `PATCH /v1/profile`
- `GET /v1/sessions`, `POST /v1/sessions`
- `GET /v1/sessions/:id/messages`
- `POST /v1/sessions/:id/messages` (SSE response)
- `POST /v1/messages/:id/cancel`
- `POST /v1/messages/:id/retry`

The existing `/_foundation/mock-chat` route is removed after the authenticated vertical slice replaces it.

## Provider and Cancellation Findings

The existing OpenRouter adapter already forwards `AbortSignal`, emits usage, and maps mid-stream errors. OpenRouter documents that disconnect/abort cancellation only stops processing and billing for supported downstream providers; Bantuin will therefore report cancellation as best-effort and never promise billing termination. Pre-stream failures become failed assistant messages; mid-stream failures preserve partial text and become failed. See [OpenRouter streaming and cancellation](https://openrouter.ai/docs/api/reference/streaming) and [error handling](https://openrouter.ai/docs/api/reference/errors-and-debugging).

## Minimal Web Scope

One React application under `apps/web` contains only:

1. first-run setup/login;
2. session list and new session action;
3. streamed chat with cancel/retry;
4. editable assistant name/system prompt;
5. loading, empty, error, and keyboard-focus states.

The API serves the production build from the same origin. Development uses a Vite proxy, keeping cookies and CSRF behavior same-origin. No component library, state framework, router, or generated client is added unless the native React/Hono types prove insufficient.

## Verification Plan

- Unit: Argon2 auth, session expiry, CSRF rejection, prompt assembly, message state transitions, SSE parsing.
- Integration: setup → login → profile → session → streamed reply → cancellation/retry.
- Restart: stop/reopen the API against the same SQLite file, reconcile interrupted messages, reload ordered history.
- Browser E2E: deterministic mock provider only; verify setup, Indonesian chat, streaming, cancel, reload, logout, and accessibility basics.
- Failure: duplicate client request, expired session, wrong password, wrong origin/missing CSRF header, unavailable provider, disconnect, and malformed request.

## Deliberate Omissions

- No OAuth, password reset, MFA, multi-user roles, remote credential vault, ORM, WebSocket, service worker, or message branching.
- No automatic retry of paid provider calls.
- No memory, tools, MCP, Telegram, or public-internet deployment; those remain later sprints.

## Ready For

Sprint 3 memory research. Sprint 2 is verified and approved for commit/push on `feat/sprint-2-core-chat`.

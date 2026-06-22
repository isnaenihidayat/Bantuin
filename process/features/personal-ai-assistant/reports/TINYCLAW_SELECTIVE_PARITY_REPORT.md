# TinyClaw Selective Parity Report

Date: 22-06-26
Branch: `feat/sprint-3-memory`
Plan approval: ✅ Approved by user on 22-06-26
Status: 🚧 SUPERSEDED — retained as evidence for the abandoned selective-parity approach

## Phase 1 — Application Shell

### Functional now

- Desktop sidebar switches between 240px and 56px modes.
- Collapse preference persists in browser `localStorage`.
- Collapsed mode retains new-chat, expand, and owner/settings actions.
- Mobile header retains new-chat, session history, and owner/settings access.
- Existing chat, history, settings, memory, and knowledge behavior remains connected.

### Automated evidence

Command: `bun run check && git diff --check`

- Biome format and lint passed without warnings.
- Strict TypeScript, package boundaries, and secret scan passed.
- 28 tests passed across 9 files with 133 assertions.
- API and web production builds passed.
- No API, database migration, provider contract, or dependency was added for Phase 1.

### User confirmation

Phase 1 parity was explicitly approved by the user on 22-06-26.

### Reproduction steps

The in-app browser was unavailable in this session. Verify locally:

1. Run `bun run dev` and open the displayed local URL.
2. On desktop, click `Ciutkan sidebar`, reload, and confirm it stays collapsed.
3. Expand it and confirm session titles plus owner identity return.
4. At a width below 760px, confirm new chat, session history, and the owner/settings button are reachable.
5. Open Settings and return to chat; confirm the active conversation is unchanged.

Phase 1 is verified. Commit and push remain deferred until the full parity plan and Sprint 3 are confirmed.

## Phase 2 — Functional Navigation

### Functional now

- Chat, History, Profile, System, Status, and Settings are real workspace views.
- History reopens an existing session and returns to chat without duplicating data.
- Profile edits use the existing `/v1/profile` contract.
- System loads and manages existing memory and knowledge data.
- Status reports API, database, and OpenRouter configuration from `/health` and `/ready`.
- Settings exposes owner identity, JSON export, and logout.
- Automations and Tasks remain hidden because no backend exists yet.

### Automated evidence

Command: `bun run check && git diff --check`

- Biome format and lint passed without warnings.
- Strict TypeScript, package boundaries, and secret scan passed.
- 28 tests passed across 9 files with 133 assertions.
- API and web production builds passed.
- HTTP smoke confirmed the production shell and health endpoint.
- No endpoint, schema, provider contract, router, or dependency was added.

### Manual verification pending

1. Open every sidebar destination and confirm its active state.
2. Open a session from History and confirm it returns to the same chat.
3. Save Profile, reload, and confirm the value persists.
4. Add/edit memory and add/remove a knowledge file from System.
5. Confirm Status reflects database and OpenRouter configuration.
6. Export JSON from Settings, then return to Chat without losing the active conversation.

Phase 2 was approved by the user on 22-06-26.

## Phase 3 — Chat Surface

### Functional now

- Empty state, message rhythm, sticky composer, retry, cancel, and source chips retain their existing behavior.
- Composer now identifies the active assistant profile and configured model.
- Streaming state is visible below the composer and exposed through `aria-busy`/`aria-live`.
- Plain text remains the intentional rendering contract; attachments and rich Markdown remain out of scope.

### Automated evidence

Command: `bun run check && git diff --check`

- Biome format and lint passed without warnings.
- Strict TypeScript, package boundaries, and secret scan passed.
- 28 tests passed across 9 files with 133 assertions.
- API and web production builds passed.
- No endpoint, schema, provider contract, or dependency was added.

### Manual verification pending

1. Confirm the empty chat greeting and composer proportions match the TinyClaw reference.
2. Send a message and confirm the assistant/model indicator remains readable.
3. During streaming, confirm the live state and stop button are visible.
4. Cancel or retry a response and confirm the conversation remains ordered.
5. Open a grounded answer and confirm its source chips remain compact and legible.

No commit or push is authorized until Phase 3 is user-confirmed.

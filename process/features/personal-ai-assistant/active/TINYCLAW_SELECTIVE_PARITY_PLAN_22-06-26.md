# TinyClaw Selective Parity Plan

Date: 22-06-26
Complexity: Complex — standard, one execution stream
Approval: ✅ Approved by user on 22-06-26
Status: 🚧 SUPERSEDED — replaced by the independent product-clone program on 22-06-26

## Overview

Bring Bantuin's existing web experience into close visual and interaction parity with TinyClaw commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa` without transplanting TinyClaw's application architecture. Bantuin keeps its verified single-owner auth, OpenRouter provider, durable chat, explicit memory, FTS5 knowledge, export, and deletion contracts.

Quick links: [Goals](#goals-and-success-metrics) · [Execution](#execution-brief) · [Scope](#scope) · [Checklist](#implementation-checklist) · [Verification](#verification-evidence) · [Handoff](#resume-and-execution-handoff)

## Goals and Success Metrics

- Match TinyClaw's compact dashboard proportions, grouped navigation, collapsible sidebar, centered chat column, greeting, composer, and settings organization.
- Expose only navigation destinations backed by working Bantuin behavior.
- Preserve every Sprint 1–3 API, database, security, and data-retention contract.
- Add no new frontend runtime dependency unless native React/CSS cannot meet an approved requirement.
- Pass `bun run check`, responsive manual testing, keyboard testing, and user visual confirmation.

## Phase Completion Rules

A phase is not complete until:

1. **Integration Test** — it works with current setup, auth, sessions, chat, memory, and knowledge.
2. **Manual Test** — the owner can perform the intended browser flow.
3. **Data Verification** — UI actions read or mutate the expected existing API/state only.
4. **Error Handling** — failed requests remain visible and recoverable.
5. **User Confirmation** — the user says the result works and looks correct.

Status meanings:

- ⏳ PLANNED — not started
- 🔨 CODE DONE — written but not verified end to end
- 🧪 TESTING — currently being tested
- ✅ VERIFIED — tested and user-confirmed
- 🚧 BLOCKED — cannot progress safely

## Execution Brief

### Phase 1 — Application shell parity

Status: ✅ VERIFIED — approved by user on 22-06-26

What happens: refactor the existing workspace into a TinyClaw-style shell with a 240px/56px collapsible sidebar, grouped labels, compact header/footer, and responsive mobile behavior. Persist the collapse choice in `localStorage`.

Integration points: existing owner/profile/session state and the current single React entrypoint.

Test: setup/login, collapse/expand, mobile layout, keyboard focus, reload persistence.

Verify: no API or database migration; current session and settings actions still work.

Done when: the user confirms shell density and proportions match the TinyClaw reference.

### Phase 2 — Functional navigation parity

Status: ✅ VERIFIED — approved by user on 22-06-26

What happens: organize existing behavior into functional views only: Chat, History, Profile, System (memory/knowledge), Status, and Settings. Automations and Tasks remain absent until Sprint 4 implements their backend.

Integration points: `/v1/sessions`, `/v1/profile`, `/v1/memories`, `/v1/knowledge`, `/health`, `/ready`, and `/v1/export`.

Test: switch views, reopen history, edit profile, manage memory/knowledge, inspect status, export, and return to chat without losing state.

Verify: changed profile/memory/knowledge remains correct after reload; navigation creates no duplicate writes.

Done when: every visible navigation item performs a real action and no dead page exists.

### Phase 3 — Chat surface parity

Status: 🧪 TESTING

What happens: align empty state, message rhythm, sticky composer, model/profile indicator, streaming/cancel/retry states, and source chips with TinyClaw's chat surface. Keep plain text rendering; rich Markdown and attachments remain separate feature work.

Integration points: existing SSE codec, durable messages, OpenRouter metadata, and knowledge provenance.

Test: empty chat, new message, streaming, cancellation, retry, long content, source labels, and request failure.

Verify: stored message order/status/source provenance is unchanged after the UI refactor.

Done when: the user completes a grounded chat and confirms the visual parity.

### Phase 4 — Responsive and regression verification

What happens: finish mobile/tablet layouts, reduced motion, focus states, overflow behavior, destructive-action confirmation, and visual cleanup.

Integration points: all existing browser flows and production build.

Test: 320px, 768px, and desktop widths; keyboard-only navigation; reduced motion; long filenames/messages.

Verify: `bun run check` passes and existing Sprint 2–3 integration tests remain green.

Done when: automated gates pass and the user confirms desktop and mobile behavior.

Expected outcome:

- Bantuin looks and behaves like a focused TinyClaw variant.
- Bantuin branding and Bahasa Indonesia remain intact.
- No verified backend contract is replaced.
- Sprint 4 can add Automations and Tasks to the same shell without another redesign.

## Phased Execution Workflow

1. Research: completed in `references/TINYCLAW_ADAPTATION_STUDY_21-06-26.md` and approved by the user.
2. Plan: this file defines exact scope; pause for approval.
3. Execute: implement the checklist only; stop if an API/schema change becomes necessary.
4. Verify: run automated gates, manual flows, and state checks.
5. Confirm: present screenshots/manual steps and wait for user acceptance before commit/push.

Do not begin Sprint 4 feature implementation from this plan. This plan only makes existing Bantuin capabilities visually coherent with the future shell.

## Scope

### In scope

- compact TinyClaw-inspired shell and design tokens;
- collapsible/responsive sidebar;
- functional views for existing Bantuin capabilities;
- existing chat, memory, knowledge, profile, status, export, and auth flows;
- accessibility and error-state preservation.

### Out of scope

- copying TinyClaw source components wholesale;
- multi-organization tenancy, roles, invitations, or platform admin;
- Automations, Tasks, MCP, skills, shell/JavaScript tools, Telegram, or WhatsApp implementation;
- rich Markdown/code renderer, image/file attachments, voice, thinking UI, chat branching;
- Tailwind, shadcn, Base UI, TanStack Query, React Router, Lucide, Streamdown, DnD, or AI SDK adoption merely for parity.

## Architecture Decisions

1. **Local adaptation, not fork.** Keep Bantuin's application boundaries and reproduce only approved UX behavior.
2. **Functional navigation only.** A sidebar item ships with working content or does not ship.
3. **No new router yet.** The current SPA can switch a small fixed set of views with local state; add routing only when deep links become a measured requirement.
4. **No new design system dependency.** Existing React and CSS cover the approved shell.
5. **Backend contracts are frozen for this work.** Any required endpoint/schema change pauses execution and triggers plan revision.
6. **Attribution is explicit.** Substantial copied code, if later approved, must update `THIRD_PARTY_NOTICES.md`; visual inspiration alone remains documented in the adaptation study.

## Functional Requirements

- Owner can collapse/expand the desktop sidebar and the choice survives reload.
- Mobile users can reach every functional view without a permanently visible rail.
- Chat/History/Profile/System/Status/Settings views use current API data.
- Selecting a historical session returns to Chat with that session loaded.
- Memory and knowledge CRUD remains available under System.
- Settings contains owner-level actions such as export and logout.
- Chat sources, streaming, stop, retry, and errors remain visible.

## Non-Functional Requirements

- No new secret exposure or client-side provider credential handling.
- No regression in CSRF, authentication, ownership, deletion, or export guarantees.
- 320px minimum supported width and no horizontal page overflow.
- Keyboard focus remains visible; reduced-motion preference is honored.
- Production bundle remains within the existing dependency set.

## Touchpoints

- `apps/web/src/main.tsx` — split the workspace into small local view components only where repetition justifies it.
- `apps/web/src/styles.css` — shell, navigation, responsive, and view styles.
- `apps/web/index.html` — only if metadata/title needs Bantuin parity cleanup.
- Existing API/client contracts are read-only dependencies.
- `process/features/personal-ai-assistant/reports/` — verification evidence.

## Public Contracts

- No endpoint, request, response, SSE, cookie, schema, or ID change is authorized.
- Existing routes `/health`, `/ready`, and `/v1/*` remain compatible.
- Existing accessibility names used by tests/manual flows should remain stable where possible.
- Bantuin name, owner identity, and Bahasa Indonesia copy remain product-owned.

## Blast Radius

- **High:** `apps/web/src/main.tsx` because it owns setup, auth, sessions, chat, and settings.
- **Medium:** responsive layout and focus behavior in `styles.css`.
- **Low:** API/database/provider packages; they must not change.
- Primary failure risks: hidden actions after refactor, state loss during view switches, mobile overflow, and deceptive dead navigation.

## Post-Phase Testing

Follow the repository testing context in `process/context/tests/all-tests.md` after every phase.

Test paths:

- Existing integration: `apps/api/src/app.test.ts`
- Existing client/agent/database tests under `packages/*/src/*.test.ts`
- Web verification: strict TypeScript, Vite production build, and manual browser flow.

Commands:

- `bun run typecheck`
- `bun test`
- `bun run build:web`
- `bun run check`
- `git diff --check`

Pass criteria: all existing tests pass, production web build succeeds, no new secret/boundary issue appears, and manual desktop/mobile flows are confirmed.

## Verification Evidence

Record in `process/features/personal-ai-assistant/reports/TINYCLAW_SELECTIVE_PARITY_REPORT.md`:

- exact commands and pass counts;
- desktop, collapsed-sidebar, and mobile screenshots when browser tooling is available;
- manual steps for setup/login, navigation, chat, memory/knowledge, export, and logout;
- state/API evidence that profile, session, memory, and knowledge data remains correct;
- failures found and fixes applied;
- explicit user confirmation before commit/push.

## Acceptance Criteria

- [x] Desktop shell visually matches TinyClaw's compact proportions and density.
- [x] Sidebar collapse persists and has accessible controls.
- [ ] Mobile navigation works at 320px without horizontal overflow.
- [ ] Every visible page is backed by existing functional data/actions.
- [ ] Chat streaming, cancel, retry, history, and sources still work.
- [ ] Profile, memory, knowledge, status, export, and logout remain functional.
- [ ] No API/schema/provider change is introduced.
- [ ] `bun run check` and `git diff --check` pass.
- [ ] User confirms desktop and mobile parity.

## Implementation Checklist

- [x] Capture current UI baseline and preserve unrelated README/Sprint 3 changes.
- [x] Extract minimal workspace/view state from `main.tsx`; do not add a router.
- [x] Implement expanded/collapsed TinyClaw-style sidebar with persisted preference.
- [x] Add functional Chat, History, Profile, System, Status, and Settings navigation.
- [x] Move existing profile, memory, knowledge, export, and logout controls into their matching views.
- [x] Align chat empty state, message spacing, composer, streaming controls, and source chips.
- [ ] Implement mobile navigation, overflow handling, focus states, and reduced motion.
- [x] Run `bun run check` and fix only parity-related regressions.
- [ ] Perform manual/state verification and write the parity report.
- [ ] Receive user confirmation before staging, committing, or pushing.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Giant `main.tsx` refactor causes regressions | Move one view at a time; keep API calls unchanged |
| Parity becomes dependency cloning | Enforce the out-of-scope dependency list |
| Dead navigation appears | Hide all future capability pages |
| Sprint 3 verification becomes ambiguous | Finish parity verification, then rerun Sprint 3 acceptance |
| Upstream keeps changing | Pin the studied commit; no automatic sync |

## Change Management

- Visual adjustments within existing views: update this checklist and continue.
- New endpoint/schema/dependency or new TinyClaw feature: stop, record impact, and request revised approval.
- Full source cloning request: replace this plan with a fork/migration plan; never mix both approaches.

## Resume and Execution Handoff

Read in order:

1. `process/context/all-context.md`
2. `references/TINYCLAW_ADAPTATION_STUDY_21-06-26.md`
3. this plan
4. `SPRINT_03_MEMORY_PLAN_21-06-26.md` and its report
5. `git status --short --branch`

Execution anchor: this file only. Preserve the user's unstaged `README.md` edit. Do not stage, commit, or push until parity and Sprint 3 are manually confirmed.

## Cursor + RIPER-5 Guidance

- Cursor Plan mode: import the Implementation Checklist and execute one phase at a time.
- RIPER-5: research is complete; request plan approval, then enter EXECUTE for Phase 1 only.
- After each phase, stop for automated/manual/state verification before continuing.

Next instruction: visually verify Phase 3, then continue to Phase 4 — Responsive and regression verification.

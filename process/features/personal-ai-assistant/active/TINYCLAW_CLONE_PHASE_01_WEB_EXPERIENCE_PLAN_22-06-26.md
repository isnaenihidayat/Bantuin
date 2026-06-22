# TinyClaw Clone Phase 01 — Web Experience

Date: 22-06-26
Complexity: Complex — phase 1 of 4
Status: ✅ VERIFIED — automated gates passed and user approved the rendered result on 22-06-26

## Context and Objective

Replace the current selective-parity approximation with a faithful Bantuin-branded implementation of TinyClaw's web shell and functional page flows, while keeping every existing Bantuin API and state contract intact.

## Phase Completion Rules

Completion requires integration, manual, state, failure, and user-confirmation evidence. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, 🚧 BLOCKED.

## Dependencies

- Approved umbrella program and pinned TinyClaw commit.
- Current Sprint 3 work preserved and automated gates green.
- Reference screenshots/routes/components inventoried before implementation.

## Execution Brief

1. Capture TinyClaw desktop, collapsed, tablet, and mobile reference states.
2. Map its routed pages to existing Bantuin behavior; hide capabilities owned by later phases.
3. Rebuild shell, typography, spacing, navigation, page hierarchy, empty/loading/error states, and responsive behavior in `apps/web`.
4. Keep direct state/native browser routing unless a real URL/deep-link requirement proves a router necessary.
5. Verify every visible control performs real behavior.

## Touchpoints

- `apps/web/src/main.tsx`, `apps/web/src/styles.css`, and existing web entry assets.
- Existing `/v1/sessions`, `/v1/profile`, `/v1/memories`, `/v1/knowledge`, `/health`, `/ready`, `/v1/export`.
- Phase report: `process/features/personal-ai-assistant/reports/TINYCLAW_CLONE_PHASE_01_WEB_EXPERIENCE_REPORT.md`.

## Public Contracts

No API, schema, provider, auth, or SSE contract change. Keyboard navigation, focus visibility, reduced motion, and 16px mobile form inputs remain required.

## Blast Radius

Medium: web-only structural replacement. The current `main.tsx`/CSS parity work may be deleted or rewritten, but backend and user data may not change.

## Test Stage

- Testing context: `process/context/tests/all-tests.md`.
- Run `bun run typecheck`, `bun run lint`, `bun run build:web`, then `bun run check`.
- Manual: setup/login, each visible view, chat continuity, collapse persistence, keyboard-only flow, 320/768/desktop widths.
- State: reload after profile/memory/knowledge actions and confirm existing data is unchanged.
- Failure: API unavailable, readiness 503, failed save, empty history.

What green proves: the Bantuin web product matches the pinned TinyClaw experience without importing its architecture or breaking Sprint 1–3.

## Post-Phase Testing

Rerun the full gate, exercise all Phase 01 browser flows, reload persisted state, test one API failure, and stop for user confirmation.

## Acceptance Criteria

- [x] Desktop, collapsed, tablet, and mobile shell accepted by the user against the pinned reference.
- [x] Every visible navigation item performs a real Bantuin action.
- [x] Existing chat/profile/memory/knowledge contracts pass persistence and integration tests.
- [x] Keyboard, focus, reduced-motion, loading, empty, and error states remain implemented.
- [x] No backend contract or unnecessary dependency is introduced.

## Implementation Checklist

- [x] Record reference screenshots and observable behavior inventory.
- [x] Compare current DOM/CSS and identify what should be deleted rather than layered.
- [x] Present exact file-level plan and stop for approval.
- [x] Implement shell and responsive layout using current React/CSS.
- [x] Connect only existing functional pages and actions.
- [x] Skip a view-parser test because Phase 01 adds no router or new branching state parser.
- [x] Run all automated gates and record evidence.
- [x] Verify state/failure behavior through the integration suite; browser automation was unavailable.
- [x] Receive user confirmation before commit or push (approved 22-06-26).

## Verification Evidence

Report screenshots, commands/pass counts, state checks, errors fixed, dependency delta, and user approval.

## Resume and Execution Handoff

Read `process/context/all-context.md`, the umbrella, adaptation study, current web files, TinyClaw `Layout.tsx`, navigation, pages, and CSS. Begin with research only; no code until the user approves the file-level delta.

## Cursor Plan + RIPER-5

Cursor Plan imports this checklist. RIPER-5 enters RESEARCH first and stops before EXECUTE.

Next Step: commit and push the approved Phase 01 work, then begin Phase 02 research only.

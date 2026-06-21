# Sprint 03 — Memory and Knowledge Plan

Date: 21-06-26  
Complexity: Complex phase 3/6  
Status: ⏳ PLANNED  
Objective: add inspectable, correctable, reversible memory and source-grounded personal knowledge.

## Context

Read `process/context/all-context.md`, `process/context/tests/all-tests.md`, and the Sprint 2 report before changing context assembly or persistence.

## Dependencies

Sprint 02 ✅ VERIFIED with stable message and profile contracts.

## Phase Completion Rules

Completion requires integration, manual, data, failure, and **User Confirmation** evidence. Use ⏳/🔨/🧪/✅/🚧; push only after confirmation.

## Pre-Sprint Research Gate

Measure real context limits; decide memory extraction policy, consent, retention, provenance, and deletion semantics; compare SQLite FTS with embedding/vector requirements; present findings and stop.

## Implementation Stages

1. Curated memory model with type, content, source message, confidence, timestamps, and status.
2. Explicit remember/forget/edit UI and safe assistant memory tool.
3. Knowledge document ingestion, extraction limits, chunking, search, and citations/provenance.
4. Context assembly budgets and history compaction without erasing source history.
5. Export and cascading deletion workflows.

## Touchpoints

Memory/knowledge migrations and repositories, prompt/context builder, protected memory tools, web memory/knowledge settings, export/delete endpoints, tests and retention docs.

## Public Contracts

Memory CRUD, provenance model, knowledge ingestion/search result, context budget, export version, deletion guarantees.

## Blast Radius

High privacy and prompt-injection risk. Medium model-quality and token-cost risk. Deletion/export bugs can violate user trust.

## Test Stage

- Unit: extraction filters, dedupe, search ranking, context budgets, compaction, path/file validation.
- Integration: remember → new session recall → edit → corrected recall → forget → no recall.
- E2E: upload a safe document, ask a grounded question, inspect source, export, delete.
- Failures: malicious document instructions, oversized/unsupported file, corrupt encoding, duplicate chunks, deletion during search.

## Verification Evidence

Queries prove provenance and cascading delete; token/context measurements; exported archive inspection; screenshots of inspect/edit/delete. Record in `reports/SPRINT_03_MEMORY_REPORT.md`.

## Done Criteria

User confirms Bantuin recalls an approved preference, cites a knowledge source, accepts a correction, and fully forgets/deletes selected data.

## Acceptance Criteria

- Memory writes are visible, attributable, editable, and deletable.
- Knowledge answers expose provenance and resist document prompt injection.
- Export/delete and context budgets pass automated and manual verification.

## Blocker Rules

Block on hidden memory writes, unverifiable provenance, incomplete deletion, prompt injection crossing tool policy, unbounded context cost, or export containing secrets unexpectedly.

## What This Green Check Proves

Personalization improves continuity while the owner retains visibility and control.

## Implementation Checklist

- [ ] Research memory/retention/search choices and receive approval
- [ ] Add memory schema/repository and tests
- [ ] Add explicit memory tool and approval rules
- [ ] Add knowledge ingestion/search with provenance tests
- [ ] Add context budget/compaction tests
- [ ] Add inspect/edit/delete/export UI and E2E
- [ ] Run privacy/deletion verification
- [ ] Receive confirmation and commit/push `feat/sprint-3-memory`

## Resume and Execution Handoff

Read Sprint 02 report and current contracts before this plan. Research must pause for approval. Sprint 04 waits for ✅ VERIFIED.

Next Step: use Cursor Plan or RIPER-5 RESEARCH on this sprint only.

Report path: `process/features/personal-ai-assistant/reports/SPRINT_03_MEMORY_REPORT.md`.

# TinyClaw Phase 02 Assistant Capabilities Study

Date: 22-06-26
Mode: Xia `--adapt`
Source: TinyClaw `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`
Target: Bantuin `feat/sprint-3-memory` at `7760eee140032fa509cc5446e973353a0d6a57f6`
Status: Research complete — contract approval required; no implementation authority

## Objective

Study TinyClaw's multiple profiles, model selection, thinking, rich messages, attachments, retry, branching, session titles, and per-profile knowledge. Prepare the smallest Bantuin-native contract delta without copying TinyClaw's tenancy, source architecture, or dependency graph.

## 1. Source Manifest

| Area | Primary source | Observed responsibility |
| --- | --- | --- |
| Profiles | `apps/server/src/http/routes/profiles.ts` | Profile CRUD, soul files, avatar, knowledge, assignments |
| Sessions | `apps/server/src/http/routes/sessions.ts` | Profile-bound sessions, messages, branching, compaction, streaming |
| Profile UI | `apps/web/src/pages/ProfilesPage.tsx` | Profile selection, autosave, model/thinking selection, avatar and assignments |
| Chat UI | `apps/web/src/pages/ChatPage.tsx` | Profile/model switch, attachments, branch/retry, URL state, streaming |
| Composer | `apps/web/src/components/chat/chat-composer.tsx` | Attachment input and profile/model controls |
| Messages | `apps/web/src/components/chat/chat-message-list.tsx` | Rich turns, copy, retry, branch, attachment and thinking surfaces |
| Stream state | `apps/web/src/lib/chat-stream.ts` | Chunk/thinking/tool event reduction |
| Attachments | `packages/core/src/message-content.ts` | Typed content, count/type/size validation and provider conversion |
| Provider thinking | `apps/server/src/providers/openrouter/thinking.ts` | Conservative model support allow/deny rules |
| Titles | `packages/agent/src/session-title.ts` | Best-effort provider-generated title after first exchange |
| Persistence | `packages/db/sql/schema.sql` | Profile, session, and JSON message payload storage |

Source dependency signals include React Router, TanStack Query, AI SDK/UI parts, Streamdown, Lucide, Base UI, and source-specific provider abstractions. They are implementation choices, not product requirements.

## 2. Source Map

```text
profile
  -> model + thinking + system prompt
  -> session(profile_id)
      -> ordered JSON message payloads
          -> text | image | document | assistant thinking | tool content
      -> branch copies history through a selected message index
      -> title generated asynchronously after first reply
  -> knowledge-base documents
```

Important behavior:

- A new chat belongs to one profile and profile switches open a separate draft/session context.
- The selected profile model is passed per request; global provider settings remain separate.
- Thinking is optional, streamed separately from assistant text, then persisted for display.
- Up to five combined attachments are accepted; source limits each image/document to 5 MiB.
- Source message payloads embed base64 attachment data in JSON.
- Retry creates a new session branch for completed messages; its simpler retry endpoint is reserved for interrupted responses.
- Session title generation is best effort and never blocks the primary reply.
- Profile deletion cascades through source sessions, which is unsuitable for Bantuin without explicit destructive confirmation.

## 3. Local Integration Map

| Local surface | Already exists | Required delta |
| --- | --- | --- |
| `profiles` table | Owner, name, prompt, `provider_model` | Repository list/get/create/update; deletion policy; optional archived state |
| `chat_sessions` | Owner/profile FK, title, timestamps | Create with selected profile; branch ancestry/copy transaction; title update |
| `chat_messages` | Ordered durable text, status, retries | Rich content/attachment reference and optional thinking field |
| `knowledge_documents` | Owner-scoped text/Markdown + FTS | Add/backfill `profile_id`; update uniqueness and all owner/profile guards |
| Provider contract | Per-request `model`; streaming text/usage/errors | Multimodal content and optional reasoning event only after SDK proof |
| Agent context | Bounded prompt, owner memory, knowledge citations | Resolve session profile; filter knowledge by profile; retain owner-wide explicit memory |
| API | Profile singleton, sessions, retry/cancel, knowledge | Versioned profile CRUD/model list, branch/title, attachment contract |
| Web | Profile page, model label, chat/history | Profile picker/CRUD, rich renderer, attachment preview, branch/copy controls |

Existing overlap is substantial. No router, query cache, UI kit, icon package, source agent framework, or new provider stack is needed for the contract.

## 4. Dependency and Conflict Matrix

| Capability | Status | Local choice | Conflict or dependency |
| --- | --- | --- | --- |
| Multiple profiles | EXISTS/PARTIAL | Extend current repository and routes | Current API always selects first owner profile |
| Per-profile model | EXISTS/PARTIAL | Use existing `provider_model` and request `model` | Profile update currently ignores model |
| Per-profile prompt | EXISTS | Keep `system_prompt` | Must resolve by session profile, not first profile |
| Per-profile knowledge | CONFLICT | Add `profile_id` and backfill | Current checksum uniqueness is owner-wide |
| Owner memory | EXISTS | Keep owner-wide | Do not duplicate as profile memory without proven need |
| Branching | NEW | Transactionally copy messages through checkpoint | Need ancestry and idempotency decision |
| Session titles | EXISTS/PARTIAL | Add repository update and best-effort background call | Provider call cost and race handling |
| Copy response | EXISTS via browser | `navigator.clipboard` | No backend change |
| Markdown/code | NEW | One audited renderer dependency | Handwritten HTML parser is an XSS/maintenance risk |
| Images | NEW | Typed attachments plus provider capability check | Current provider accepts string content only |
| Documents | PARTIAL | Reuse text/Markdown ingestion first | PDF/DOCX extraction needs extra libraries or provider-native input |
| Thinking | UNKNOWN | Add only after OpenRouter SDK event/request proof | Model support and provider payload differ |
| Source router/query/UI stack | AVOID | Keep local state and fetch helper | No demonstrated local need |

## 5. Challenge Questions

| # | Challenge | Source answer | Bantuin answer | Risk if wrong |
| --- | --- | --- | --- | --- |
| 1 | Do profiles need full soul/tool/skill parity now? | Profile owns prompts, soul, tools, skills, MCP, avatar | Phase 02 needs identity, prompt, model, knowledge only; actions belong to Phase 03 | Scope explosion and duplicated ownership |
| 2 | Can deleting a profile delete its chat history? | Source uses cascading foreign keys | No; Bantuin must reject deletion while sessions exist or archive the profile | Critical irreversible data loss |
| 3 | Should explicit memory become per-profile? | Source has profile memory/soul files | No evidence yet; Bantuin's user facts/preferences are owner-wide | Conflicting memories and migration complexity |
| 4 | Should attachments be embedded as base64 message JSON? | Yes, within source payloads | Not automatically; storage growth and export size must be measured first | Critical database bloat and slow backups |
| 5 | Can browser clients choose any OpenRouter model string? | Source resolves configured provider catalogs | No; server should expose an allowed catalog and validate the profile selection | Unexpected cost or unsupported model requests |
| 6 | Is thinking a generic string stream? | Source normalizes provider reasoning into separate events | Unknown for the installed OpenRouter SDK; verify actual request/response fields first | Broken requests or accidental sensitive reasoning retention |
| 7 | Does rich Markdown justify a dependency? | Source uses Streamdown and AI UI components | Yes, one small audited renderer is safer than a custom parser; no syntax plugins initially | XSS if custom, bloat if source stack copied |
| 8 | Must PDF and DOCX upload ship with text attachments? | Source accepts both and adapts by provider | No safe local extraction exists; require provider-native proof or defer these formats | Incorrect parsing, memory pressure, dependency bloat |
| 9 | Should retry mutate the existing conversation? | Source branches completed history, retries interrupted messages in place | Preserve current interrupted retry; completed retry should create a branch | History ambiguity and duplicate sequence errors |
| 10 | Should title generation block the response? | No, it is scheduled best effort | No; use a bounded background task and fallback to prompt truncation | Slower chat and avoidable provider failure coupling |

## 6. Decision Matrix

| # | Decision | Source's way | Local way | Hybrid option | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Profile scope | Broad soul/tool/skill aggregate | Identity/prompt/model only | Add knowledge relation | Medium | Hybrid, limited to Phase 02 |
| 2 | Profile deletion | Cascade | Reject/archive | Explicit purge later | Critical | Local: no cascade through history |
| 3 | Knowledge scope | Profile directory/catalog | Owner SQL/FTS | Add profile FK to existing FTS | Critical | Hybrid with backfill |
| 4 | Message content | JSON payload with base64 | Normalized text rows | Attachment metadata/content table | Critical | Local normalized storage after size decision |
| 5 | Models | Multi-provider catalog | One configured OpenRouter adapter | Server-proxied OpenRouter catalog | Medium | Hybrid; validate model server-side |
| 6 | Thinking | Provider-normalized stream | No reasoning event | Optional event/column | Critical | Defer until SDK contract proof |
| 7 | Markdown | Streamdown/AI UI | Plain text | One safe renderer | Low | Hybrid; one dependency maximum |
| 8 | Branching | Copy by message index | No branch | Copy by stable message ID | Medium | Local stable-ID transaction |
| 9 | Titles | Provider-generated async | User-supplied default | Local fallback plus optional provider title | Low | Hybrid, never block chat |
| 10 | Client state | Router + query cache | React local state | Native URL only if deep links become required | Low | Local; add nothing now |

## 7. Risk Summary

Risk: **Medium**, with four critical assumptions requiring explicit resolution before implementation:

1. Profile deletion must not cascade into durable user history.
2. Per-profile knowledge needs an append-only backfill and revised uniqueness contract.
3. Attachment storage/limits must be selected before message schema changes.
4. OpenRouter thinking support must be verified against the installed SDK before defining SSE or persistence fields.

Other risks are bounded by existing owner authorization, CSRF, durable message sequencing, provider-neutral request models, and integration tests.

## 8. Recommendation and Handoff

Keep:

- Bantuin's owner authorization, durable ordered messages, current retry/cancel semantics, bounded context assembly, FTS knowledge, and provider-neutral boundary.

Adapt:

- Multiple profile CRUD, session-selected profile/model, per-profile knowledge, safe Markdown, stable-message branching, non-blocking titles, and attachments only after storage approval.

Avoid:

- TinyClaw tenancy/admin guards, soul file stack, profile tool/skill/MCP assignments in Phase 02, JSON/base64 message transplantation, router/query/UI stacks, and speculative PDF/DOCX parsers.

Required decisions before implementation planning:

- profile deletion policy: reject-with-sessions or archive;
- attachment storage and initial supported types/limits;
- per-profile knowledge backfill behavior;
- whether thinking is required in the first Phase 02 delivery or gated behind SDK proof;
- approval for one safe Markdown renderer dependency.

If you want to turn this into implementation work, use generate-plan with this research artifact.

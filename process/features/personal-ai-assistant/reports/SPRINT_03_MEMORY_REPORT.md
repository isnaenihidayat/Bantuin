# Sprint 03 Memory and Knowledge Research Report

Date: 22-06-26
Sprint status: 🧪 VERIFYING — automated checks complete; manual/user confirmation pending
Branch: `feat/sprint-3-memory`

## Research Outcome

Sprint 3 should add owner-controlled memory and local text knowledge without automatic extraction, embeddings, a vector database, or a general tool framework. The smallest safe version is explicit CRUD, SQLite FTS5, bounded context assembly, JSON export, and verifiable deletion.

## Current-State Evidence

- Sprint 2 persists complete ordered chat history in `chat_messages` and scopes resources to one authenticated owner.
- The current chat path sends every completed message in a session to the provider. It has no message-count, character, or token budget.
- `ChatRequest.maxTokens` exists, but the API does not currently set it.
- The configured OpenRouter model lives only in environment configuration. No model context length is versioned, and local secret environment files were intentionally not inspected.
- OpenRouter's Models API exposes `context_length`, tokenizer metadata, and provider completion limits. Token counts vary by model.
- Bun's SQLite build reports `ENABLE_FTS5`; a local `fts5` table, `MATCH`, and `bm25()` probe passed.
- Bantuin uses SQLite WAL mode. Normal deletes do not promise physical erasure without secure-delete and checkpoint handling.

## Approved-Scope Proposal

### Explicit memory only

No model-generated or background memory write is allowed in Sprint 3.

The owner can:

- create a memory explicitly;
- inspect its type, content, source, status, and timestamps;
- edit it;
- archive and restore it;
- permanently delete it.

Typing a normal chat message never writes memory. A model-initiated memory tool is deferred to Sprint 4, where tool approval and authorization belong. This removes the hidden-write risk without blocking useful recall.

Memory types are a small fixed set: `preference`, `fact`, `goal`, and `note`. Manual memories have confidence `1.0`. A memory derived from a message must retain `source_message_id`; deleting that source cascades to the derived memory.

### Knowledge v1

Accept UTF-8 `.txt` and `.md` files only, with a 1 MiB upload limit. Store content and chunks in SQLite; do not write uploaded files to arbitrary filesystem paths.

Chunk by paragraphs with a bounded character target and small overlap. Each chunk keeps document ID, ordinal, checksum, and source name. Duplicate document content is rejected by checksum.

Use SQLite FTS5 with the Unicode tokenizer and `bm25()` ranking. Return at most five chunks. Query terms must be normalized and quoted before entering `MATCH`; raw user query syntax is never passed directly to FTS5.

Embeddings are deferred. Add them only if measured recall failures remain after FTS tuning or the local corpus grows beyond roughly 10,000 chunks. This avoids a second provider, new secrets, remote data transfer, vector storage, and embedding cost.

### Source grounding and injection boundary

Retrieved knowledge is untrusted quoted data, never instructions. Context labels every excerpt with a stable source key such as `[K1]`. The API sends source metadata with the response so the UI renders citations from retrieval results rather than trusting model-invented filenames.

Knowledge cannot invoke tools or alter the system prompt. OWASP notes that RAG does not eliminate indirect prompt injection, so Sprint 3 limits knowledge to answer grounding and gives it no agency.

### Context budget

Resolve the configured OpenRouter model's `context_length` from the public Models API and cache it in process memory. If metadata lookup fails, use a conservative 8,192-token window.

Use at most half of the resolved window for assembled input, capped at 24,000 estimated tokens. Reserve the remainder for tokenizer variance, provider framing, reasoning, and output. Estimate conservatively from text length without adding a tokenizer dependency; actual provider usage remains the measurement source.

Assembly order:

1. assistant system prompt;
2. active explicit memories within their own cap;
3. up to five retrieved knowledge excerpts, clearly marked as untrusted data;
4. newest completed chat exchanges that fit the remaining budget.

Full source history remains in SQLite. Sprint 3 does not generate a lossy hidden summary; bounded selection is the compaction mechanism.

### Retention, export, and deletion

- Local retention is indefinite until the owner archives or deletes data.
- Archive removes a memory from recall but is reversible.
- Permanent delete is hard delete and is not reversible.
- Export is versioned JSON containing profile, memories, knowledge documents, and chat history. It excludes password hashes, auth-session hashes, provider keys, and process environment values.
- Enable SQLite core `secure_delete`; configure FTS5 secure-delete; truncate the WAL after destructive purge. Document that filesystem snapshots and external backups are outside the application's deletion guarantee.

## Proposed Schema

- `memories`: public ID, owner ID, type, content, source message, confidence, status, created/updated timestamps.
- `knowledge_documents`: public ID, owner ID, source name, media type, checksum, content, timestamps.
- `knowledge_chunks`: integer row ID, public ID, document ID, ordinal, checksum, content.
- `knowledge_chunks_fts`: FTS5 index synchronized with chunks and checked with FTS integrity tests.

All owner/document/source relationships use foreign keys. Document deletion cascades to chunks and FTS cleanup in one repository transaction.

## Proposed API

- `GET /v1/memories`, `POST /v1/memories`
- `PATCH /v1/memories/:id`, `DELETE /v1/memories/:id`
- `GET /v1/knowledge`, `POST /v1/knowledge`
- `DELETE /v1/knowledge/:id`
- `GET /v1/export`

No separate archive endpoints are needed; memory status changes through `PATCH`.

## Verification Plan

- Unit: context budget, newest-history selection, FTS query escaping, chunk limits, checksums, file type/UTF-8 validation.
- Database: memory provenance, archive/restore, source cascade, document/chunk/FTS cascade, FTS integrity, secure-delete configuration.
- Integration: remember → new session recall → edit → corrected recall → archive → no recall → restore → recall → delete → no recall.
- Knowledge: upload safe Markdown → retrieve grounded chunks → expose source metadata → delete → zero search hits.
- Export: parse JSON and prove credentials, sessions, keys, and environment data are absent.
- Failure: oversized file, unsupported type, corrupt UTF-8, duplicate content, malicious instructions, raw FTS operators, deletion during lookup.

## Deliberate Omissions

- No automatic memory extraction or model-initiated writes.
- No PDF, DOCX, OCR, URL crawling, embeddings, vector database, or semantic reranker.
- No hidden conversation summary.
- No general tool-call framework; that remains Sprint 4.

## Sources

- [OpenRouter Models API](https://openrouter.ai/docs/guides/overview/models)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [SQLite secure_delete and WAL pragmas](https://www.sqlite.org/pragma.html)
- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

## Approval Gate

Approved by the user on 22-06-26. Implementation may proceed; automatic/model-initiated memory writes and embeddings remain deliberately omitted.

## Implementation Result

- Migration 0003 adds owner-scoped memories, knowledge documents/chunks, FTS5 synchronization, message provenance, secure-delete, and cascading foreign keys.
- The API exposes explicit memory CRUD, `.md`/`.txt` knowledge ingestion, durable source metadata, versioned JSON export, and hard-delete checkpointing.
- Context assembly caps input at half the model window (maximum 24,000 estimated tokens), clips oversized inputs, prioritizes active explicit memory and retrieved sources, and keeps knowledge inside an untrusted-data boundary.
- OpenRouter model metadata is cached from `GET /api/v1/model/:author/:slug`; failures use the approved 8,192-token fallback.
- Settings now supports inspect/edit/archive/delete memory, upload/delete knowledge, export, and source labels beneath grounded assistant messages.

## Automated Verification — Passed 22-06-26

Command: `bun run check`

- Formatting, lint, strict TypeScript, package boundaries, and secret scan passed.
- 28 tests passed across 9 files.
- Production API and web builds passed.
- Integration coverage proves create → recall → archive → no recall → correct/restore → corrected recall → delete → no recall.
- Knowledge coverage proves FTS retrieval and durable source metadata, duplicate/type/size rejection, deletion, and zero source retrieval after deletion.
- Export inspection proves current profile/memory/knowledge/chat data is present while password hashes, session-token hashes, provider keys, and environment values are absent.
- Database coverage proves source-message and document cascades, FTS integrity, and SQLite secure-delete configuration.

## Remaining Verification Gate

The in-app browser was unavailable in this session, so no screenshot or visual/manual claim is recorded. Sprint 3 remains 🧪 VERIFYING until the Settings flow and grounded chat are visually checked and the user confirms acceptance. No Sprint 3 commit or push has been made.

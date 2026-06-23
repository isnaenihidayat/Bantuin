# TinyClaw Phase 03 — Safe Actions Study

Date: 23-06-26
Mode: `xia --compare` after threat-model downgrade
Source: `ahmadrosid/tinyclaw` commit `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`
Target: Bantuin commit `13dc8db`
Status: Research complete — security contract approval required before planning or implementation

## Executive Decision

Do not transplant TinyClaw's execution model. Six critical assumptions can lead to host code execution, SSRF, secret disclosure, or duplicate durable work. Phase 03 should first deliver durable tasks, prompt-only automations, and an approval/audit state machine. Generic bash, JavaScript tools, stdio MCP, and arbitrary MCP URLs remain excluded until a separately isolated executor exists.

## Source Manifest

| Area | Pinned source | Observed contract |
| --- | --- | --- |
| Tool schema | `packages/core/src/tools/schema.ts` | JSON-schema definitions exposed to the model |
| Tool resolution | `apps/server/src/services/tool-resolver.ts` | Built-in, bash, and dynamically loaded JavaScript handlers |
| Shell execution | `apps/server/src/tools/bash.ts` | `/bin/bash -lc`, inherited process environment, 30–120 second timeout, 32k output cap |
| Tool loop | `packages/agent/src/tool-loop.ts` | Finds a tool by name and executes it immediately without an approval gate |
| MCP | `apps/server/src/services/mcp-service.ts`, `mcp-client-manager.ts`, `mcp-tool-bridge.ts` | HTTP and stdio transports; cached discovery; profile assignment; direct tool calls |
| Automations | `automation-service.ts`, `automation-scheduler.ts`, `automation-runner.ts` | Cron schedules, in-memory active-run lock, durable output/error history |
| Tasks | `task-service.ts`, `task-runner.ts`, `task-validate.ts` | Kanban state, prompt execution, in-memory active-run lock, run history |
| Persistence | `packages/db/sql/schema.sql` | Tools, assignments, MCP configs, automations/runs, tasks/runs |
| UI/API | `routes/{tools,mcp,automations,tasks}.ts` and matching web components | CRUD, manual run, schedule, assignments, and run-history surfaces |

All source content was treated as untrusted reference. No source command, setup script, or code was executed.

## Source Execution Map

```text
profile assignment -> model receives tool schema -> model emits name + arguments
-> resolver finds handler -> handler executes immediately -> raw result returns to model

automation cron/manual trigger -> in-memory running Set -> run row
-> agent prompt + assigned tools -> output/error row

task enters in_progress/manual run -> in-memory running Set -> run row
-> agent prompt + assigned tools -> done/failed + output/error row
```

Important source properties:

- bash is bounded by time and output length, but still inherits server secrets and runs arbitrary shell;
- JavaScript tools are dynamically loaded into the server process;
- MCP HTTP accepts any syntactically valid URL and MCP stdio accepts an arbitrary command;
- tool calls have no durable proposal, approval, denial, cancellation, or audit lifecycle;
- scheduler/task duplicate protection is process-local and disappears on restart;
- run output and errors are stored and returned without a shared redaction boundary.

## Local Integration Map

| Bantuin surface | Current state | Phase 03 implication |
| --- | --- | --- |
| `packages/core/src/provider.ts` | Text/vision streaming only; no tool-call events | Add vendor-neutral proposals/results only after contract approval |
| `packages/agent/src/agent-service.ts` | Thin provider delegation | Keep policy outside providers; agent cannot execute directly |
| `apps/api/src/app.ts` | Owner auth, CSRF, durable chat, cancellation | Compose approvals/runs under the same owner boundary |
| `packages/db` | Append-only migrations, SQLite WAL, secure delete | Durable leases, approvals, audit, tasks, automations belong here |
| `apps/web/src/workspace.tsx` | Chat/profile/system/status shell | Add proposal approval, task board, automation list, run history minimally |
| `packages/providers` | OpenRouter + deterministic mock | Provider tool-call mapping requires a proven SDK contract and mock coverage |
| `packages/client` | SSE parsing only | Extend only when action activity events exist |

Bantuin has no tool registry, action policy, executor, scheduler, MCP SDK, cron dependency, or worker process today.

## Dependency and Conflict Matrix

| Capability | Source dependency/assumption | Local status | Decision |
| --- | --- | --- | --- |
| Typed action schema | Custom JSON schema | NEW | Use Zod-derived validation already installed; no second schema system |
| Bash executor | Host shell + inherited env | CONFLICT | Exclude |
| JavaScript tools | Dynamic module execution | CONFLICT | Exclude |
| HTTP MCP | MCP SDK + arbitrary remote URL | CONFLICT | Defer execution; registry metadata only unless an HTTPS allowlist contract is separately approved |
| Stdio MCP | Local process spawn | CONFLICT | Exclude |
| Cron scheduler | `croner` + process-local jobs | NEW | Prefer a native minute tick plus durable due-time claim before adding a dependency |
| Task board | Durable CRUD/status/order | NEW, LOW RISK | Adapt locally |
| Prompt-only task run | Existing provider flow | EXISTS/PARTIAL | Adapt with timeout, cancellation, and output cap |
| Automation run history | SQLite run records | NEW | Adapt with durable occurrence key and lease |
| Approval/audit | Missing in source and local | NEW, REQUIRED | Build before executable actions |
| Secret storage | Plain MCP config JSON in source | CONFLICT | Do not store connector secrets in Phase 03 |

Dependency checks on 23-06-26: `bun audit` reported no vulnerabilities and `bun run check:secrets` passed for 90 files.

## STRIDE + OWASP Threat Model

| Threat | Severity | Source exposure | Required Bantuin control |
| --- | --- | --- | --- |
| Spoofing | High | Tool identity is a model-provided name | Stable action ID, profile assignment, owner/session verification |
| Tampering / Injection | Critical | Shell command, JavaScript handler, MCP arguments execute directly | No generic code executor; strict typed arguments; immutable proposal hash |
| Repudiation | Critical | No durable approval/denial audit | Append-only action event rows with actor, decision, timestamps, and redacted result |
| Information disclosure | Critical | Shell inherits environment; raw output/error is model-visible and persisted | Minimal environment, shared redactor, output cap, never export secrets |
| Denial of service | High | Long external calls, process-local concurrency only | Timeout, abort, body/output caps, durable lease, bounded retries |
| Elevation of privilege | Critical | stdio MCP and dynamic handlers become host execution | Exclude stdio/bash/JavaScript; tool-by-tool allowlist |
| SSRF (OWASP A10) | Critical | Any valid HTTP MCP URL is accepted | No arbitrary URL; exact HTTPS allowlist plus private-address and redirect denial if later enabled |
| Insecure design (OWASP A04) | Critical | In-memory locks cannot guarantee restart uniqueness | Unique occurrence key and transactional claim in SQLite |

Summary: 6 critical, 2 high. Per Xia's risk rule this study is downgraded from adaptation-prep to comparison. Implementation is blocked until the local threat-model decisions below are explicitly approved.

## Challenge Questions

| # | Question | TinyClaw answer | Bantuin answer | Risk if wrong |
| --- | --- | --- | --- | --- |
| 1 | Is arbitrary host execution necessary? | Bash and JavaScript are first-class tools | No; product value starts with durable tasks and prompt runs | RCE and secret theft |
| 2 | Can model output authorize an action? | Tool calls execute immediately | No; policy validates and mutations require owner approval | Prompt injection causes side effects |
| 3 | Is process-local locking enough? | `Set<string>` blocks concurrent runs | No; SQLite must claim a unique occurrence transactionally | Duplicate scheduled work after restart |
| 4 | Can MCP accept user URLs/commands? | Any valid HTTP URL or stdio command | No; stdio excluded and HTTP execution deferred by default | SSRF or host execution |
| 5 | Where may secrets live? | MCP headers/env are stored in config JSON and redacted on response | No connector secret persistence in Phase 03 | Database/export/model leakage |
| 6 | What may run without confirmation? | Assigned tools run directly | Only explicitly read-only internal actions; mutations require proposal approval | Unauthorized data changes |
| 7 | Should tasks moving to `in_progress` execute automatically? | Yes | No; status changes and execution are separate explicit operations | Accidental execution from drag/drop |
| 8 | Should missed schedules replay after restart? | Cron resumes future schedules; no durable occurrence contract | No backfill initially; claim only current due occurrence | Burst, duplication, unexpected cost |

## Decision Matrix

| # | Decision | Source way | Recommended Bantuin contract | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Initial executor set | Built-in + bash + JavaScript + MCP | Prompt-only task/automation runs; zero host executors | Critical | Local |
| 2 | Approval | Immediate model execution | Durable proposal; explicit approval for every mutation/external call | Critical | Local |
| 3 | MCP | HTTP + stdio, UI-configurable | Registry metadata only in Phase 03; no execution or secrets | Critical | Local |
| 4 | Scheduler | Cron objects in API process | One native minute tick, transactional due claim, no catch-up | High | Local |
| 5 | Task semantics | `in_progress` triggers run | Status update never executes; separate Run action | High | Local |
| 6 | Run output | Raw text/error persisted | 32 KiB cap, redaction, terminal status, cancel reason | Critical | Local |
| 7 | Deletion | Cascade run history | Archive definitions; retain audit/run history | High | Local |
| 8 | Provider actions | Source tool loop | Defer provider tool calling until proposal events are proven | High | Local |

## Recommended Minimal Contract for Approval

1. **Tasks:** owner/profile-scoped CRUD, `backlog|todo|in_progress|done|failed`, stable ordering, archive instead of destructive delete, separate explicit prompt-only Run action, durable run history.
2. **Automations:** owner/profile-scoped prompt-only definitions, `manual` or five-field cron schedule, disabled by default, explicit enable, no missed-run backfill, one transactional occurrence claim, timeout/cancel/output cap.
3. **Actions:** durable `proposed|approved|denied|running|completed|failed|cancelled` lifecycle and append-only events. Phase 03 has no shell, JavaScript, filesystem mutation, email, arbitrary HTTP, or other host executor.
4. **Approval:** read-only internal actions may be explicitly pre-allowed per profile; every mutation or external action requires a fresh owner decision. Approval is bound to action name, canonical arguments hash, profile, session/run, and expiry.
5. **MCP:** persist only non-secret server metadata and cached schemas; no connection or tool execution in Phase 03. Stdio is excluded. A later HTTPS execution contract must include exact host allowlists, SSRF/redirect protection, environment-only credentials, per-tool enablement, and per-call approval.
6. **Audit and secrets:** cap result/error at 32 KiB, redact before persistence/model/SSE/export, never store Phase 03 connector credentials, retain run and approval history when definitions are archived.
7. **Recovery:** startup marks expired `running` leases failed; unique `(definition_id, scheduled_for)` prevents duplicate schedule claims; cancellation uses `AbortController` and durable terminal state.
8. **Dependencies:** use Bun/SQLite/Zod/native timers first. Do not add a worker queue, cron library, MCP SDK, sandbox framework, or second validation library in this phase.

## Risk Summary and Blockers

Risk remains **high** until all eight contract points are approved. Blocking decisions are the zero-host-executor boundary, MCP metadata-only scope, per-mutation approval, no secret persistence, and durable scheduler occurrence semantics.

## Recommendation and Handoff

Approve or revise the minimal contract above before any migration, provider event, scheduler, or UI code is written. After approval, update the existing Phase 03 plan from this research artifact and implement tasks/automations before any action execution surface.

If you want to turn this into implementation work, use generate-plan with this research artifact.

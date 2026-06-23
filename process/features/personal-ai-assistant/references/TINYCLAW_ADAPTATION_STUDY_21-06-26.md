# TinyClaw Parity and Adaptation Study for Bantuin

Created: 21-06-26
Updated: 22-06-26
Mode: `xia --adapt`
Status: Research revised for approved product-clone direction; TinyClaw remains a pinned reference only.

## 1. Source Manifest

| Item | Value |
| --- | --- |
| Source | `https://github.com/ahmadrosid/tinyclaw.git` |
| Inspected branch | `main` |
| Inspected commit | `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa` |
| Commit date | 21-06-26 23:52:50 +0700 |
| License | MIT; preserve copyright and license notice for substantial reuse |
| Local target | Bantuin branch `feat/sprint-3-memory` |
| Requested parity | Product behavior and web design, independently reimplemented |
| Local source clone | `/private/tmp/tinyclaw-reference-latest` (research only) |

Primary source entrypoints:

- `README.md`, `ARCHITECTURE.md`, `LICENSE`, and package manifests;
- `apps/web/src/components/Layout.tsx`, `pages/ChatPage.tsx`, `lib/navigation.ts`, and `index.css`;
- server HTTP routes and services for profiles, tools, MCP, tasks, automations, models, and channels;
- `packages/agent`, `packages/core`, `packages/db`, and `packages/client`.

## 2. Source Map

TinyClaw is a Bun/TypeScript monorepo with one Hono agent server and thin web, CLI, Telegram, and WhatsApp clients.

### Web experience

- fixed 240px sidebar with collapsible 56px mode;
- grouped navigation: Chat, History, Profiles, System, Status, Automations, Tasks, Settings;
- Plus Jakarta Sans, 14px body text, compact controls, amber accent, dark/light themes;
- centered 768px chat column, greeting state, sticky composer, profile/model picker;
- Markdown/code rendering, attachments, thinking state, tool activity, retry, and branching;
- separate routed pages rather than a single settings drawer.

### Product capabilities

| Area | TinyClaw implementation |
| --- | --- |
| Chat | Streaming, durable session messages, retry/branch, images/documents, thinking |
| Profiles | Multiple profiles, model selection, prompt/soul files, tool and skill assignment |
| Providers | OpenRouter plus other compatible providers and model catalogs |
| Tools | Profile allowlists, builtin tools, bash/JavaScript, MCP bridge |
| Knowledge | Per-profile document upload and retrieval |
| Automations | Natural-language drafting, CRUD, scheduler, runs, worker controls |
| Tasks | Kanban board, agent execution, run history, task chat |
| Channels | Web, CLI, Telegram, WhatsApp |
| Platform | Organizations, roles, invitations, platform administrators |
| Operations | Status dashboard, usage tracking, Docker, provider/channel settings |

## 3. Local Integration Map

Bantuin is no longer empty. Sprints 1–2 are verified and Sprint 3 is in verification.

| Bantuin surface | Current capability | TinyClaw relation |
| --- | --- | --- |
| `apps/web` | Setup/login, compact dark chat, history rail, settings drawer | Same React/Vite and visual tokens; much smaller component surface |
| `apps/api` | Hono, auth/CSRF, OpenAPI, SSE, profile/chat/memory/knowledge APIs | Same central-server pattern; Bantuin is single-owner |
| `packages/agent` | Provider-neutral streaming and bounded memory/knowledge context | TinyClaw additionally has tool loop, thinking, tasks, and compaction |
| `packages/providers` | OpenRouter and deterministic mock | TinyClaw supports more providers and model browsing |
| `packages/db` | Durable users, sessions, messages, curated memory, FTS5 knowledge | Bantuin persistence is stricter for personal continuity |
| Roadmap Sprint 4 | Safe tools, MCP boundary, approvals, scheduler, audit | Overlaps TinyClaw tools and automations |
| Roadmap Sprint 5 | Telegram then WhatsApp decision | Overlaps TinyClaw channels |
| Roadmap Sprint 6 | Status, backup/restore, Docker, release | Overlaps operational surfaces |

The smallest integration surface for design parity is `apps/web/src/main.tsx` plus `styles.css`. Feature parity must remain behind existing API, database, security, and sprint contracts.

## 4. Dependency and Conflict Matrix

| Capability | TinyClaw | Bantuin | Status | Recommendation |
| --- | --- | --- | --- | --- |
| Bun/Hono/React/Vite | Same core stack | Already established | EXISTS | Keep Bantuin |
| Typography/colors/sidebar | Plus Jakarta, amber, compact 240px rail | Already close | EXISTS | Match remaining spacing/navigation behavior |
| Routed dashboard pages | React Router | Single workspace component | NEW | Add only when real pages exist |
| Query cache | TanStack Query | Direct fetch/state | NEW | Defer until cache invalidation becomes painful |
| Icon system | Lucide | Text/inline symbols | NEW | Add only with routed navigation work |
| Markdown/code renderer | Streamdown plus plugins | Plain text | NEW | Add a focused renderer when rich responses are required |
| Multiple profiles | Profile/admin platform | One assistant profile | CONFLICT | Keep single profile for v1 |
| Durable chat | SQLite messages | SQLite messages | EXISTS | Keep Bantuin contract |
| Memory/knowledge | Profile files/documents | Explicit memory plus FTS5 provenance | CONFLICT | Keep Bantuin's inspectable model |
| Tools/MCP | Broad runtime, including powerful tools | Planned approval-first boundary | HIGH RISK | Adapt behavior, never transplant execution policy |
| Automations/tasks | Full services and pages | Planned Sprint 4 | NEW | Adapt after approved safety contract |
| Telegram/WhatsApp | Both available | Planned staged rollout | NEW | Telegram first; WhatsApp remains a decision gate |
| Organizations/roles | Multi-tenant platform | Single owner | CONFLICT | Do not clone |
| Upstream dependencies | Large UI/runtime dependency graph | Minimal dependencies | CONFLICT | Do not copy package manifests wholesale |

## 5. Challenge Questions

| # | Question | Source answer | Bantuin answer | Risk if wrong |
| --- | --- | --- | --- | --- |
| 1 | Does “same” require identical code? | Source can be forked under MIT | No; visual/behavior parity provides the value | A fork inherits unrelated complexity and future merge burden |
| 2 | Should Bantuin replace its backend? | TinyClaw has org-scoped services and broader runtime | No; current owner/auth/message/memory contracts are verified | Data loss and regression across Sprints 1–3 |
| 3 | Is multi-tenancy part of a personal assistant? | Central to current TinyClaw architecture | Explicit non-goal for Bantuin v1 | Large auth/schema expansion with no user value |
| 4 | Should the full frontend dependency set be copied? | Uses router, query cache, shadcn/Base UI, Tailwind, Streamdown, DnD, AI SDK | Current UI needs only React and CSS | Bundle and maintenance bloat before features exist |
| 5 | Can tools/bash/MCP be copied directly? | Powerful tools are profile-scoped | Tools require explicit approval, timeout, audit, and default deny | Host compromise or secret exposure |
| 6 | Should all sidebar pages appear immediately? | Pages have working services behind them | Only Chat, History, Memory/Knowledge, and Settings exist today | Dead navigation and misleading UI |
| 7 | Can design tokens and layout be reused safely? | MIT permits modification and reuse with notice | Yes; current design already uses the same font/palette | Low risk if branding and attribution remain clear |
| 8 | Should Bantuin track upstream continuously? | TinyClaw is actively changing | No automatic merges; pin studied commits | Unreviewed upstream changes could bypass local security contracts |

## 6. Decision Matrix

| # | Decision | Source transplant | Keep current | Independent product clone | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Repository ownership | Replace Bantuin with a fork | No product parity | Keep Bantuin ownership and pin TinyClaw as reference | High | Independent clone |
| 2 | Architecture | Import multi-tenant hub-and-spoke services | Preserve current code only | Single-owner, durable-state, capability-oriented modular monolith | High | Independent clone |
| 3 | Visual design | Copy components and dependency graph | Keep approximation | Reproduce observable layout and flows in Bantuin React/CSS | Low | Independent clone |
| 4 | Feature breadth | Enable everything at once | Keep current subset | Deliver capability groups behind sequential verification gates | Medium | Independent clone |
| 5 | Auth/tenancy | Import organizations and platform roles | Single owner | Keep one owner; do not expose org concepts | High | Local architecture |
| 6 | Memory/chat | Adopt profile files and in-memory chat | Durable messages and explicit memory | Keep durable Bantuin contracts while matching UX | High | Local architecture |
| 7 | Tools/channels | Copy powerful runtime handlers | Defer forever | Rebuild behind default-deny approvals and channel adapters | High | Independent clone |
| 8 | Dependencies | Copy package manifests | Never add packages | Add only a dependency that replaces more code than it adds | Medium | Ponytail gate |
| 9 | Attribution | Copy without tracking | No source reuse | Preserve MIT notices for any substantial reused material | High | Track provenance |

## 7. Risk Summary

| Option | Risk | Reason |
| --- | --- | --- |
| Source transplant/fork | **High** | Violates the different-architecture requirement and replaces verified contracts |
| Independent product clone | **Medium** | Broad scope, but risk is bounded by capability phases and preserved data contracts |
| Visual reimplementation | **Low** | Observable UX can be matched without importing the source dependency graph |
| Powerful actions/channels | **High** | Requires explicit approval, audit, timeout, isolation, and rollback boundaries |

Critical blockers before implementation:

1. freeze and preserve the current Sprint 3 work before structural migration;
2. approve the feature inventory and the explicit exclusion of multi-tenancy;
3. approve a safety contract before shell, JavaScript, MCP, workers, or channels exist;
4. maintain a provenance inventory for any substantial copied material;
5. verify every migration against durable messages, memory, knowledge, and deletion contracts.

## 8. Recommendation and Handoff

Proceed with an **independent TinyClaw product clone**:

- clone and pin TinyClaw only as a behavioral/design reference;
- independently implement the visible product flows in Bantuin;
- retain Bantuin's single-owner, durable-message, explicit-memory, FTS5, OpenRouter, and deletion architecture;
- exclude organizations, invitations, platform administration, and automatic upstream merging;
- rebuild tools, MCP, automations, tasks, and channels behind Bantuin-specific safety contracts;
- use Ponytail gates: native platform first, existing dependency second, new dependency only after measured need;
- maintain MIT attribution when substantial source material is actually reused.

If you want to turn this into implementation work, use generate-plan with this research artifact.

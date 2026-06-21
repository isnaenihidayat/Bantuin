# TinyClaw Adaptation Study for Bantuin

Date: 21-06-26  
Mode: `xia --adapt`  
Status: Research complete; no TinyClaw code copied or executed.

## 1. Source Manifest

| Item | Value |
| --- | --- |
| Source | `https://github.com/ahmadrosid/tinyclaw.git` |
| Inspected branch | `main` |
| Inspected commit | `0a574b16c9c90b90785d509c5de0d6df664a6e11` |
| License | MIT; preserve attribution if substantial code is reused |
| Target | `https://github.com/isnaenihidayat/Bantuin.git` |
| Local target state | Empty directory; not yet a Git repository |
| Scope studied | Architecture, runtime, providers, chat, persistence, profiles/soul, tools, MCP, automations, channels, auth, tests, Docker/CI |

Primary source entrypoints: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, root/package manifests, `apps/server`, `apps/web`, `apps/platform`, `packages/agent`, `packages/core`, `packages/db`, and `.github/workflows`.

## 2. Source Map

TinyClaw is a Bun/TypeScript monorepo built around one server-side agent runtime and several thin clients.

| Layer | TinyClaw approach | Useful pattern |
| --- | --- | --- |
| Runtime | Hono server owns agent execution and SSE | Keep model credentials and tool execution server-side |
| Agent | Provider-neutral harness and tool loop | Isolate orchestration from HTTP and UI |
| Providers | OpenAI, Anthropic, Google, OpenRouter adapters | Stable provider contract with server-only adapters |
| Clients | React web, CLI, Telegram, WhatsApp use shared client | Hub-and-spoke; no duplicated agent logic |
| Persistence | SQLite for metadata and messages; repository adapters | Begin local-first and migration-friendly |
| Identity | Profile plus soul/user/memory files | Separate personality, user facts, and durable memory |
| Tools | Per-profile allowlist; MCP bridge | Default-deny tool access |
| Automation | Definitions, runs, tasks, scheduler | Add only after chat, history, and safety are proven |
| Security | Cookie/bearer auth, CSRF, role/org guards | Preserve boundary discipline but simplify tenancy |
| Delivery | Bun tests, Docker image, GitHub workflows | Reproducible local and container paths |

Important source caveats:

- The architecture document says chat history is in memory, while the current schema includes `session_messages`; behavior must be verified against code before borrowing it.
- Multi-tenancy, platform admin, org roles, and invites are platform concerns, not necessary for Bantuin's first personal-use release.
- Shell/JavaScript/MCP tools dramatically expand the attack surface.
- WhatsApp's unofficial client path is operationally fragile; Telegram is the safer first external channel.

## 3. Local Integration Map

The target repository has no application code, package manager configuration, context docs, tests, or Git metadata. Integration points therefore become initial architecture boundaries:

```text
apps/web -> packages/client -> apps/api -> packages/agent
                                      -> packages/providers
                                      -> packages/tools
                                      -> packages/db -> SQLite
channels/telegram --------------------^
worker/scheduler ---------------------^
```

Recommended initial stack, subject to Sprint 1 proof:

- Bun + TypeScript workspaces
- Hono API with OpenAPI contracts and SSE streaming
- React + Vite web app and TanStack Query
- SQLite with explicit migrations and repository interfaces
- OpenAI-compatible provider first; add Anthropic only after the contract is stable
- Bun test for unit/integration, Playwright for critical browser E2E
- Docker for deployment; GitHub Actions for quality and release checks

## 4. Dependency and Conflict Matrix

| Capability | Source | Bantuin | Status | Decision |
| --- | --- | --- | --- | --- |
| Monorepo/runtime | Bun workspaces | Empty | NEW | Adopt after toolchain spike |
| Server agent runtime | Central Hono runtime | Empty | NEW | Adopt pattern |
| Web chat | React/Vite | Empty | NEW | MVP requirement |
| Provider abstraction | Four providers | Empty | NEW | Start with one contract and one adapter |
| Durable session messages | Mixed docs/schema signals | Empty | CONFLICT | Make SQLite persistence explicit from Sprint 2 |
| Profiles/soul | File + DB concepts | Empty | NEW | Adapt to single-owner assistant profile |
| Multi-tenancy | Org/user/role model | Personal assistant goal | CONFLICT | Defer; retain future `owner_id` seam only |
| Tool execution | Builtins, code, bash, MCP | Empty | HIGH RISK | Default deny, approval gates, audit log |
| Automations | Draft/run/task scheduler | Empty | NEW | Deliver after tool safety |
| Telegram | Thin channel client | Empty | NEW | First channel |
| WhatsApp | Thin channel client | Empty | HIGH RISK | Optional beta after Telegram |
| Git delivery | CI and container publish | Empty/non-Git | NEW | Bootstrap remote, protected main, verified sprint pushes |

## 5. Challenge Questions

| # | Question | Source answer | Local answer | Risk if wrong |
| --- | --- | --- | --- | --- |
| 1 | Is multi-tenancy necessary? | Core architecture | No for personal MVP | Months of avoidable auth/schema work |
| 2 | Must all providers ship initially? | Multiple adapters | No; one OpenAI-compatible adapter proves the contract | Provider sprawl hides runtime defects |
| 3 | Can chat remain in memory? | Source docs imply yes, schema signals evolution | No; personal continuity requires durable messages | Lost conversations and broken trust |
| 4 | Can shell/MCP run automatically? | Super-bot supports powerful tools | No; require allowlist, risk class, approval, timeout, audit | Secret theft or host damage |
| 5 | Should WhatsApp be first? | Supported as a bridge | No; Telegram first, WhatsApp beta later | Pairing breakage and support burden |
| 6 | Should source code be copied wholesale? | MIT permits reuse | No; adapt architecture and selectively port with attribution | Unowned complexity and hidden vulnerabilities |
| 7 | Is automatic push always safe? | Not a product invariant | Only after tests, secret scan, clean diff, and user-approved execution scope | Bad code or secrets pushed remotely |

## 6. Decision Matrix

| # | Decision | Source's way | Local way | Hybrid option | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tenancy | Organization-scoped platform | Single owner | Future owner seam | Medium | Local |
| 2 | Providers | Four providers | One initial provider | Adapter contract from day one | Low | Hybrid |
| 3 | Memory | Soul files plus session state | Durable messages and curated memory | File export/import | Medium | Hybrid |
| 4 | Tools | Profile allowlist, powerful runtime tools | Risk-tiered tools with approvals | MCP after safe builtins | High | Local-first |
| 5 | Channels | Web, CLI, Telegram, WhatsApp | Web then Telegram | WhatsApp beta | Medium | Hybrid |
| 6 | Deployment | Local/Docker/GHCR | Local/Docker first | GHCR at release | Low | Hybrid |
| 7 | Git automation | CI workflows | Verified sprint checkpoint pushes | PR-based main promotion | Medium | Local |

## 7. Risk Summary

Overall adaptation risk: **Medium**.

Critical assumptions to resolve in Sprint 1:

1. Bun compatibility on developer and deployment targets.
2. Exact provider and model for the first release.
3. Local-only versus internet-accessible deployment and its auth requirement.
4. Secret-storage mechanism for API/channel credentials.
5. Whether source code will be selectively reused, which triggers attribution tracking.

The tool runtime remains **High risk** until its approval, audit, timeout, and isolation proof passes.

## 8. Recommendation and Handoff

Keep TinyClaw's central runtime, shared contracts, provider boundary, profile-based identity, thin channels, and tool allowlist. Adapt it to a single-owner, durable-history, Bahasa-Indonesia-first product. Avoid copying the full tenant/admin surface and avoid enabling shell, arbitrary JavaScript, remote MCP, or WhatsApp in the MVP foundation.

Use the accompanying `BANTUIN_PERSONAL_AI_ASSISTANT_PLAN_21-06-26.md` as the umbrella plan and execute only one sprint plan at a time.

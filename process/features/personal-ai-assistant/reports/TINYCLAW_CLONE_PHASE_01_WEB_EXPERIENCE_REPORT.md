# TinyClaw Clone Phase 01 — Web Experience Report

Date: 22-06-26
Source: TinyClaw `603d6cff6c06b9aeb5ad78a5cd71ec70795683aa`
Status: ✅ VERIFIED — user approved on 22-06-26

## Research Scope

Compared TinyClaw's shell, navigation, chat, history, theme tokens, page layout, and web dependency graph with Bantuin's current React/Vite implementation. The approved implementation was then rewritten against Bantuin's existing API and local state contracts; no TinyClaw application source was transplanted.

## Source Findings

Primary references:

- `apps/web/src/components/Layout.tsx`: 240px/56px rail, 56px header, grouped navigation, footer settings/logout, page-specific overflow.
- `apps/web/src/lib/navigation.ts`: Chat/History, Agent, System groups and route mapping.
- `apps/web/src/pages/ChatPage.tsx`: centered 768px chat, vertically centered welcome, sticky composer, profile/model controls.
- `apps/web/src/components/chat/chat-composer.tsx`: compact toolbar, model/profile controls, send/stop states.
- `apps/web/src/components/chat/chat-message-list.tsx`: grouped turns, copy/retry/branch actions, attachment and thinking surfaces.
- `apps/web/src/pages/HistoryPage.tsx`: profile filter, search, count, refresh, grouped sessions, delete confirmation.
- `apps/web/src/index.css`: Plus Jakarta Sans, 14px UI body, amber accent, off-black surfaces, 10px base radius, light/dark tokens.

Observable Phase 01 geometry:

| Surface | Reference contract |
| --- | --- |
| Sidebar | 240px expanded, 56px collapsed, 56px shell header |
| Navigation | 14px rows, 36px collapsed targets, 8px/12px internal spacing |
| Main header | 56px on non-chat pages |
| Chat column | 768px maximum with 24px horizontal padding |
| Empty chat | Vertically centered group, composer below greeting with 48px lower offset |
| Active chat | Scrollable messages plus sticky composer on the same 768px column |
| Type | Plus Jakarta Sans; 12/14/16/18/20px hierarchy |
| Color | `#0a0a0b`, `#111113`, `#18181b`, `#1f1f23`, `#27272a`, amber `#f59e0b` |

## Local Findings

- `apps/web/src/main.tsx` is 1,044 lines and mixes bootstrap, auth, API calls, chat, every page, and all mutations.
- `apps/web/src/styles.css` is 1,243 lines and contains three successive parity layers, making specificity and mobile behavior harder to reason about.
- The existing API already supports every page allowed in Phase 01: chat/history/profile/system/status/settings.
- The visual tokens are close, but page chrome, overflow ownership, empty-state placement, navigation density, and footer behavior are not consistently source-shaped.
- Bantuin's web package has only React, Vite, the client package, and Plus Jakarta Sans. This is sufficient for Phase 01.

## Delete or Replace

- Replace the current workspace JSX rather than stacking another shell around it.
- Replace navigation/page/chat CSS blocks as one coherent layer; preserve auth form styles only where still accurate.
- Remove the superseded drawer/page/parity selectors that become unused.
- Do not copy TinyClaw's Tailwind/shadcn/Base UI/TanStack Query/router/Streamdown/DnD dependency graph.
- Do not expose Profiles, Automations, or Tasks until their Phase 02/03 contracts exist.

## Approved Architecture Boundary

Bantuin will not mirror TinyClaw's component/hook/query hierarchy. Phase 01 uses a small capability-oriented web shape:

```text
apps/web/src/
├── main.tsx              # bootstrap and auth boundary
├── api.ts                # one shared HTTP helper
├── workspace.tsx         # existing functional workspace and local view state
├── workspace-state.ts    # tiny pure view/hash parser, only if deep-link state is implemented
└── styles.css            # one token and layout system
```

`workspace-state.ts` is created only if native hash deep links are implemented; otherwise it does not exist. No router or global cache is added.

## Exact Implementation Plan

1. Move the shared `api()` helper to `api.ts`; keep its error envelope behavior unchanged.
2. Move `Workspace` and its existing handlers to `workspace.tsx`; do not redesign API calls.
3. Keep setup/login/bootstrap in `main.tsx` and import the workspace.
4. Rebuild workspace JSX around the source geometry: rail, grouped nav, optional 56px page header, chat/content overflow boundary, footer actions.
5. Rebuild `styles.css` from one token layer and remove unused parity selectors.
6. Add native light/dark preference only through CSS class plus `localStorage`; no theme package.
7. Keep only Chat, History, Profile, System, Status, and Settings visible.
8. Add the smallest pure test only if view/hash parsing gains branching logic.
9. Run `bun run check && git diff --check`, then perform desktop/collapsed/tablet/320px, keyboard, reload, and failure verification.

## Ponytail Dependency Decision

| Candidate | Phase 01 decision | Reason |
| --- | --- | --- |
| React Router | Skip | Local view state already covers functional navigation; add only when reload-safe deep links are required |
| TanStack Query | Skip | Current data volume and invalidation are simple |
| Tailwind/shadcn/Base UI | Skip | Vanilla CSS can reproduce the shell with less owned machinery |
| Lucide | Skip | Existing symbols or small inline SVGs cover the limited active navigation |
| Streamdown | Defer to Phase 02 | Rich Markdown is not a Phase 01 contract |
| DnD | Defer to Phase 03 | Tasks do not exist yet |

## Risks and Checks

- Moving 1,000+ lines can create accidental behavior changes: use mechanical extraction first, visual replacement second.
- CSS replacement can regress auth/mobile: preserve auth selectors and test 320px before deleting old rules.
- Browser tooling was unavailable in the previous session: visual proof remains mandatory before verification.
- Current Sprint 3 and README changes remain unstaged and must not be overwritten.

## Implemented Delta

- Extracted the unchanged HTTP helper to `apps/web/src/api.ts`.
- Reduced `apps/web/src/main.tsx` to setup, login, and application bootstrap.
- Moved the functional workspace into `apps/web/src/workspace.tsx` without changing API, SSE, auth, profile, memory, knowledge, status, or export contracts.
- Replaced the layered workspace CSS with one light/dark token system and one responsive layout system.
- Added the approved 240px/56px rail, 56px content header, grouped navigation, 768px chat column, compact 12–14px UI type, sticky composer, native inline navigation icons, and local theme/rail persistence.
- Kept only implemented pages visible: Chat, Riwayat, Profil, Sistem, Status, and Pengaturan.
- Added no dependency and no router, global cache, UI kit, icon package, or styling framework.

## Automated Evidence

Command: `bun run check && git diff --check`

- Biome format: 49 files checked, no changes required.
- Biome lint: 50 files checked, no diagnostics.
- TypeScript: passed with no emit.
- Package boundary check: passed.
- Secret scan: passed for 87 files.
- Tests: 28 passed, 0 failed, 133 assertions.
- API production bundle: passed.
- Web Vite production build: passed; CSS 19.52 kB and JS 214.46 kB before gzip.
- Whitespace validation: passed.

## Visual Verification

The in-app automation browser was unavailable, so no automated screenshots were produced. The preview was served locally at `http://127.0.0.1:55431`; the user reviewed and approved the rendered result on 22-06-26. State and failure behavior remain covered by the passing integration suite.

## Ready For

Commit and push the approved Phase 01 work, then begin Phase 02 research only.

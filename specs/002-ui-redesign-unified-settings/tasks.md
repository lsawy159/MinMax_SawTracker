---

description: "Task list for: UI Redesign + Unified Settings Hub"
---

# Tasks: إعادة تصميم الواجهة وتوحيد مركز الإعدادات

**Input**: Design documents from `specs/002-ui-redesign-unified-settings/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: INCLUDED — SawTracker Constitution v1.0.0 Principle 2 mandates ≥70% test coverage on critical paths. axe-core accessibility tests required for WCAG AA compliance (FR-017..022).

**Organization**: Tasks grouped by user story (US1–US4 from spec.md). Setup + Foundational gate all stories. Polish phase last.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different files, no dependencies on incomplete tasks)
- **[Story]**: maps task to user story for traceability (US1, US2, US3, US4)

## Path Conventions

Single-project SPA per [plan.md](./plan.md). All paths relative to repo root: `d:\00_Main_Projects\MiniMax\SAW\sawtracker\`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies, prepare asset folders, configure tooling. No code changes yet.

- [x] T001 Add `@phosphor-icons/react` to dependencies and remove `lucide-react` from `package.json`; run `pnpm install`
- [x] T002 [P] Add `vitest-axe` and `@axe-core/react` to devDependencies in `package.json`; run `pnpm install`
- [x] T003 [P] Create `src/assets/fonts/` directory and drop subset WOFF2 files: IBM Plex Sans Arabic (300/400/500/700), IBM Plex Sans (400/500/700), Cairo (400/600/700/800)
- [x] T004 [P] Create empty file `src/styles/tokens.css` with placeholder header comment; this will be filled in Phase 2
- [x] T005 [P] Update `.gitignore` if needed to track `src/assets/fonts/*.woff2`; verify fonts are committed
- [x] T006 Verify build still passes after dependency swap: run `pnpm type-check && pnpm lint && pnpm build`

**Checkpoint**: dependencies installed, no functional change yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the design-system v2 foundation that all four user stories depend on. This phase MUST complete before any US-phase begins.

**⚠️ CRITICAL**: User stories cannot start until Phase 2 ends.

### Design Tokens & Typography

- [x] T007 Author full token system in `src/styles/tokens.css` per [contracts/design-tokens.md](./contracts/design-tokens.md): primary scale, neutral scale, semantic colors, typography sizes/weights/families, spacing, radius, shadow, motion. Light + dark variants
- [x] T008 Add `@font-face` declarations + `font-display: swap` for IBM Plex Sans Arabic, IBM Plex Sans, Cairo in `src/styles/index.css`; import `tokens.css` from `index.css`
- [x] T009 [P] Update `tailwind.config.js` to extend `theme.colors`, `fontFamily`, `spacing`, `borderRadius`, `boxShadow`, `transitionDuration` to reference `var(--*)` tokens per [contracts/design-tokens.md](./contracts/design-tokens.md)
- [x] T010 [P] Create `src/lib/tokens.ts` exporting `TOKEN` const + `ColorTokenName` type for autocomplete in components per data-model.md
- [x] T011 Add global `@media (prefers-reduced-motion: reduce)` rule in `src/styles/index.css` zeroing `transition-duration` and `animation-duration`

### Token Tests

- [x] T012 [P] Create `src/styles/__tests__/tokens.test.ts`: assert token names match between `tokens.css`, `lib/tokens.ts`, and `tailwind.config.js`; verify light/dark body-text contrast ≥ 4.5:1 (compute from HSL values)

### Restyled UI Primitives (shadcn `src/components/ui/*`)

- [x] T013 [P] Restyle `src/components/ui/button.tsx` to consume v2 tokens (primary/secondary/ghost/danger variants) with focus ring (≥2px outline, contrast ≥3:1)
- [x] T014 [P] Restyle `src/components/ui/card.tsx` with v2 surface tokens, radius, shadow
- [x] T015 [P] Restyle `src/components/ui/input.tsx` with v2 tokens, error/focus states
- [ ] T016 [P] Skip — No table.tsx UI primitive in codebase (tables/ contains page-specific components)
- [ ] T017 [P] Skip — No tabs.tsx UI primitive in codebase; Radix primitive only
- [x] T018 [P] Restyle `src/components/ui/sheet.tsx` — slide direction respects `dir=rtl`
- [x] T019 [P] Restyle `src/components/ui/dialog.tsx` with v2 tokens
- [x] T020 [P] Restyle `src/components/ui/badge.tsx` for semantic colors (alert.tsx, toast.tsx: check if exist)
- [ ] T021 [P] Create new `src/components/ui/empty-state.tsx` (icon + title + description + action button slot) using v2 tokens
- [ ] T022 [P] Create new `src/components/ui/loading-state.tsx` (skeleton variants + spinner) using v2 tokens
- [ ] T023 [P] Create new `src/components/ui/error-state.tsx` (icon + message + retry slot) using v2 tokens

### A11y Test Helper

- [ ] T024 Create `src/test/a11y.test-helpers.ts`: export `runAxe(html: HTMLElement)` wrapping `vitest-axe`'s `axe()` + `expect(html).toHaveNoViolations()` and configure rules to match WCAG 2.1 AA

### Icon Migration (sweep)

- [ ] T025 Sweep all `from 'lucide-react'` imports across `src/`; migrate each to equivalent `@phosphor-icons/react` per-icon import. Update icon prop usage (size, weight). Verify `grep -r "lucide-react" src/` returns zero matches

### Layout Skeleton

- [ ] T026 Create `src/components/layout/AppShell.tsx`: top-level layout with Sidebar + Header + main `<Outlet>` slot, responsive breakpoints (mobile collapses sidebar)
- [ ] T027 [P] Create `src/components/layout/Sidebar.tsx`: renders nav groups, role-filtered, mobile drawer toggle
- [ ] T028 [P] Create `src/components/layout/Header.tsx`: profile dropdown, notifications bell, theme toggle, advanced search trigger — placeholder content; final wiring in US2

**Checkpoint**: tokens live, primitives consume tokens, axe helper ready, icon library swapped, layout skeleton compiles. All user stories may begin.

---

## Phase 3: User Story 1 — مركز إعدادات بتبويبتين (Priority: P1) 🎯 MVP

**Goal**: Build `/settings` with two tabs (`users-permissions`, `backup`), URL state via `?tab=`, permission gating, unsaved-changes guard, drawer-based per-row permission editor.

**Independent Test**: visit `/settings`, switch between tabs, edit a user's permissions via drawer, save, refresh page, verify state persisted in URL and data persisted in DB.

### Tests for User Story 1

- [ ] T029 [P] [US1] Write `src/components/settings/__tests__/SettingsHub.test.tsx`: tab switching updates URL, default tab fallback, invalid tab fallback, permission-gated tab hidden, axe-core zero violations
- [ ] T030 [P] [US1] Write `src/components/settings/__tests__/UsersPermissionsTab.test.tsx`: list renders, "Permissions" button opens drawer, drawer save calls mutation, drawer cancel closes, dirty-state confirm, axe-core
- [ ] T031 [P] [US1] Write `src/components/settings/__tests__/PermissionDrawer.test.tsx`: focus trap (Tab cycle stays inside), Esc closes when clean, Esc with dirty triggers confirm, Save success closes + toast, Save error keeps drawer open + toast, axe-core
- [ ] T032 [P] [US1] Write `src/components/settings/__tests__/BackupTab.test.tsx`: schedule controls render, manual backup button triggers existing mutation, history list renders, axe-core

### Implementation for User Story 1

- [x] T033 [P] [US1] Create `src/components/settings/useSettingsTabState.ts`: hook that reads `?tab=` searchParam, validates against `SettingsTabId` union, returns `{ activeTab, setActiveTab }`. Default fallback to `users-permissions`. Replace URL on invalid value
- [x] T034 [P] [US1] Create `src/hooks/useUnsavedChangesGuard.ts`: registers a `beforeunload` listener + provides `promptOnNavigate(): Promise<boolean>` for in-app navigation gating
- [x] T035 [US1] Create `src/components/settings/SettingsHub.tsx`: registers `SETTINGS_TABS` array per data-model.md, renders Radix `<Tabs>` with `dir="rtl"`, role-filtered tab list, lazy-loads each tab via `React.lazy` + `Suspense`, integrates `useSettingsTabState` and `useUnsavedChangesGuard` (depends T033, T034)
- [x] T036 [P] [US1] Create `src/components/settings/tabs/PermissionDrawer.tsx` per [contracts/permission-editor.md](./contracts/permission-editor.md): Radix Sheet, RHF + Zod `permissionUpdateSchema`, role select, permission checkboxes, footer Save/Cancel, focus trap, dirty-aware close, mutation via existing `useUpdateUserRole` + `useUpdateUserPermissions` hooks
- [x] T037 [US1] Create `src/components/settings/tabs/UsersPermissionsTab.tsx`: render users table (port logic from `pages/Users.tsx` + `pages/Permissions.tsx`), each row has "Permissions" button opening `PermissionDrawer` for `userId`, secondary "Manage Roles" button opens `RolesManagementSheet` (FR-007c) (depends T036)
- [x] T038 [P] [US1] Create `src/components/settings/tabs/RolesManagementSheet.tsx`: separate Sheet for managing role templates (CRUD on roles); accessed from UsersPermissionsTab header
- [x] T039 [P] [US1] Create `src/components/settings/tabs/BackupTab.tsx`: port logic from `pages/BackupSettings.tsx` (schedule, run-now, history); preserve all existing functionality (FR-007)
- [x] T040 [US1] Refactor `src/pages/Settings.tsx` to render `<SettingsHub />` only — remove old content
- [x] T041 [US1] Add ARIA attributes pass on Tabs primitive + Drawer per FR-021 (`role="tablist"`, `aria-selected`, `aria-expanded`, `aria-label` for unnamed buttons)
- [~] T042 [US1] Verify all US1 tests pass: `pnpm test src/components/settings` — DEFERRED: Test suite to be implemented in dedicated test task

**Checkpoint**: `/settings` is fully functional with both tabs. MVP scope complete. Can demo end-to-end.

---

## Phase 4: User Story 2 — تخطيط وقائمة جانبية معاد تنظيمها (Priority: P1)

**Goal**: Sidebar grouped (Operational + Admin), Header polished, AppShell wraps all routes, responsive collapse on mobile.

**Independent Test**: log in as operational-only user → see only Operational group; log in as admin → see both groups; resize to mobile → sidebar collapses to drawer.

### Tests for User Story 2

- [ ] T043 [P] [US2] Write `src/components/layout/__tests__/Sidebar.test.tsx`: groups render in correct order, role-based filtering hides admin items for non-admin, mobile breakpoint collapses, active route highlighted, axe-core
- [ ] T044 [P] [US2] Write `src/components/layout/__tests__/Header.test.tsx`: profile dropdown opens, notifications bell shows count, theme toggle switches `data-theme` attr, advanced search opens dialog, axe-core
- [ ] T045 [P] [US2] Write `src/components/layout/__tests__/AppShell.test.tsx`: shell renders, Sidebar + Header + Outlet present, mobile menu toggle works

### Implementation for User Story 2

- [ ] T046 [P] [US2] Create `src/components/layout/nav-config.ts` exporting `NAV_GROUPS: NavGroup[]` per data-model.md: Operational group (Dashboard, Employees, Companies, Projects, TransferProcedures, AdvancedSearch, Alerts, Reports, PayrollDeductions, ActivityLogs, ImportExport, Notifications) + Admin group (Settings, AlertSettings, AdminSettings/GeneralSettings, SecurityManagement) with `requiredPermission` keys
- [ ] T047 [US2] Wire `Sidebar.tsx` to consume `NAV_GROUPS` from T046; render visual divider between groups; filter items by user permissions via `useAuth()` (depends T027, T046)
- [ ] T048 [US2] Implement mobile responsive behavior in `Sidebar.tsx`: collapse to off-canvas drawer below 768px, hamburger trigger in `Header.tsx`, focus trap when open
- [ ] T049 [US2] Wire `Header.tsx` final content: profile dropdown (avatar, name, role, logout), notifications bell with unread count from existing `useNotifications`, theme toggle from `useThemeMode`, advanced search button opening existing AdvancedSearch route or modal
- [ ] T050 [US2] Modify `src/App.tsx`: wrap protected routes with `<AppShell>` so Sidebar+Header render once at app level. Remove per-page Sidebar usage if any. Verify Login page does NOT render AppShell
- [ ] T051 [US2] Verify Sidebar items hide based on permission: test with mock admin and mock operational user via `useAuth` mock in tests
- [ ] T052 [US2] Verify all US2 tests pass: `pnpm test src/components/layout`

**Checkpoint**: New shell live across the app; sidebar groups operational vs admin; mobile responsive.

---

## Phase 5: User Story 3 — تنسيق بصري موحَّد (Priority: P2)

**Goal**: Apply Design System v2 to 100% of production pages. Update Style Guide page (FR-016).

**Independent Test**: walk through every page (Dashboard, Employees, Companies, Projects, …) in light + dark; verify v2 tokens applied, no leftover legacy colors/fonts/icons.

### Tests for User Story 3

- [ ] T053 [P] [US3] Write `src/pages/__tests__/DesignSystem.test.tsx`: Style Guide v2 page renders all primitive examples (Button variants, Cards, Tables, Forms, Empty/Loading/Error states, Tokens display); axe-core zero violations
- [ ] T054 [P] [US3] Write smoke test `src/__tests__/visual-consistency.test.tsx`: render each page lazily; assert all use Tailwind classes that resolve to v2 token CSS vars (regex check on rendered HTML)

### Implementation for User Story 3 (page restyle pass)

Each task = full visual pass using v2 tokens; no logic changes. Verify light + dark.

- [ ] T055 [P] [US3] Restyle `src/pages/Dashboard.tsx` to v2 tokens
- [ ] T056 [P] [US3] Restyle `src/pages/Employees.tsx` (and `src/components/employees/*`) to v2 tokens
- [ ] T057 [P] [US3] Restyle `src/pages/Companies.tsx` to v2 tokens
- [ ] T058 [P] [US3] Restyle `src/pages/Projects.tsx` to v2 tokens
- [ ] T059 [P] [US3] Restyle `src/pages/Reports.tsx` and chart components to v2 tokens (chart.js + recharts color from CSS vars)
- [ ] T060 [P] [US3] Restyle `src/pages/Alerts.tsx` to v2 tokens
- [ ] T061 [P] [US3] Restyle `src/pages/ActivityLogs.tsx` to v2 tokens
- [ ] T062 [P] [US3] Restyle `src/pages/ImportExport.tsx` to v2 tokens
- [ ] T063 [P] [US3] Restyle `src/pages/Notifications.tsx` to v2 tokens
- [ ] T064 [P] [US3] Restyle `src/pages/PayrollDeductions.tsx` to v2 tokens
- [ ] T065 [P] [US3] Restyle `src/pages/TransferProcedures.tsx` to v2 tokens
- [ ] T066 [P] [US3] Restyle `src/pages/AdvancedSearch.tsx` to v2 tokens
- [ ] T067 [P] [US3] Restyle standalone settings pages: `src/pages/AlertSettings.tsx`, `src/pages/AdminSettings.tsx`, `src/pages/GeneralSettings.tsx`, `src/pages/SecurityManagement.tsx` to v2 tokens
- [ ] T068 [P] [US3] Restyle `src/pages/Login.tsx` to v2 tokens (auth flow surface)
- [ ] T069 [US3] Update `src/pages/DesignSystem.tsx` as comprehensive Style Guide v2: token reference, primitive showcase, RTL examples, dark mode toggle preview (FR-016)
- [ ] T070 [US3] Run `pnpm dev` and walk every page in light + dark; visual sweep checklist; capture screenshots into `specs/002-ui-redesign-unified-settings/screenshots/` (optional but recommended)
- [ ] T071 [US3] Verify US3 tests pass + axe-core clean on all restyled pages

**Checkpoint**: 100% of production pages on v2.

---

## Phase 6: User Story 4 — Backwards Compatibility Redirects (Priority: P2)

**Goal**: Old URLs (`/users`, `/permissions`, `/backup-settings`) redirect to corresponding hub tabs without UX break.

**Independent Test**: visit each legacy URL directly; verify redirect to correct `/settings?tab=...` and content rendered.

### Tests for User Story 4

- [ ] T072 [P] [US4] Write `src/__tests__/redirects.test.tsx` per [contracts/settings-hub-routing.md](./contracts/settings-hub-routing.md) test contract: `/users` → `/settings?tab=users-permissions`, `/permissions` → same, `/backup-settings` → `/settings?tab=backup`. Verify content of target tab renders. Verify other settings routes (`/alert-settings`, `/admin-settings`, `/security-management`) still render their standalone pages

### Implementation for User Story 4

- [ ] T073 [P] [US4] Create `src/lib/redirects.ts` exporting `SETTINGS_REDIRECTS: RedirectRule[]` per data-model.md
- [ ] T074 [US4] Modify `src/App.tsx`: replace existing `<Route path="/users" …>` with `<Route path="/users" element={<Navigate to="/settings?tab=users-permissions" replace />} />`; same for `/permissions` and `/backup-settings`. Delete the now-orphaned imports of old `Users`, `Permissions`, `BackupSettings` page components
- [ ] T075 [US4] Delete `src/pages/Users.tsx`, `src/pages/Permissions.tsx`, `src/pages/BackupSettings.tsx`, `src/pages/BackupSettings_OLD.tsx`. Verify build still passes
- [ ] T076 [US4] Run grep for stray references to deleted pages: `grep -r "from '../pages/Users'" src/`, etc.; remove leftovers
- [ ] T077 [US4] Verify US4 tests pass: `pnpm test src/__tests__/redirects.test.tsx`

**Checkpoint**: legacy URLs redirect cleanly; orphaned files removed; tests green.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: pre-release hardening before big-bang deploy.

- [ ] T078 [P] Run `pnpm validate` (type-check + lint + test) — fix any failures
- [ ] T079 [P] Run `pnpm build && pnpm analyze`; assert bundle delta ≤ +200 KB gzipped vs main baseline. If exceeded, investigate per R7 mitigation list
- [ ] T080 [P] Run Lighthouse Accessibility audit on staging URL for: `/dashboard`, `/settings`, `/employees`, `/login`. Assert ≥ 95/100. Fix violations
- [ ] T081 [P] Manual NVDA/JAWS pass on three flows: login → dashboard, dashboard → settings → users-permissions tab → edit a user → save, dashboard → reports
- [ ] T082 Manual keyboard-only flow: ensure SC-011 — login, navigate, open settings, switch tabs, edit a user's role, save, logout — all without mouse
- [ ] T083 Verify FR-005 redirect map by visiting each old URL in production-mode preview
- [ ] T084 Update `CLAUDE.md` Tech Stack section if any new core dependency added (Phosphor, axe-core, IBM Plex font)
- [ ] T085 [P] Add migration note to `README.md` (or create one) describing big-bang rollout and rollback steps from quickstart.md
- [ ] T086 [P] Run `pnpm format` to apply Prettier across all touched files
- [ ] T087 Smoke-test rollback procedure: locally `git revert <feature-merge-sha>` on a throwaway branch, verify app still builds + runs on legacy state. Document any issues
- [ ] T088 Final pre-merge QA pass following [quickstart.md](./quickstart.md) "Definition of Done" checklist

**Checkpoint**: ready to merge → big-bang release.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: no dependencies; start immediately
- **Phase 2 Foundational**: depends on Phase 1; **BLOCKS all user-story phases**
- **Phase 3 (US1)**: depends on Phase 2; can run in parallel with Phase 4 / 5 / 6 if team capacity
- **Phase 4 (US2)**: depends on Phase 2 (Layout skeleton T026–T028); can run parallel with Phase 3
- **Phase 5 (US3)**: depends on Phase 2 (tokens, primitives); can run parallel with Phase 3 + 4 (different files)
- **Phase 6 (US4)**: depends on Phase 3 (US1 tabs must exist before redirects target them)
- **Phase 7 Polish**: depends on Phases 3, 4, 5, 6 complete

### User Story Dependencies

- **US1 (Settings Hub)** — independent of US2/US3/US4 implementation-wise, but US4 redirects target US1 tab IDs
- **US2 (Sidebar/Layout)** — independent; uses primitives from Phase 2
- **US3 (Visual consistency)** — independent; restyles existing pages with no logic change
- **US4 (Redirects)** — depends on US1 (target paths must exist)

### Within Each Story

- Tests written **before or alongside** implementation per Constitution Principle 2
- Models/types before services before UI components
- Component before integration into parent
- Each story closes only when its tests + axe-core pass

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005 in parallel
- **Phase 2 primitives**: T013–T023 all parallel (different files)
- **Phase 2 tokens vs primitives**: T007–T011 must finish before T013–T023
- **Phase 5 page restyles**: T055–T068 all parallel (different files)
- **Phase 7 polish**: T078–T086 mostly parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# After T007–T011 (tokens + fonts) complete, launch primitive restyles in parallel:
Task: "Restyle src/components/ui/button.tsx to v2 tokens"
Task: "Restyle src/components/ui/card.tsx to v2 tokens"
Task: "Restyle src/components/ui/input.tsx, textarea.tsx, select.tsx"
Task: "Restyle src/components/ui/table.tsx"
Task: "Restyle src/components/ui/tabs.tsx"
Task: "Restyle src/components/ui/sheet.tsx"
Task: "Create src/components/ui/empty-state.tsx"
Task: "Create src/components/ui/loading-state.tsx"
Task: "Create src/components/ui/error-state.tsx"
```

## Parallel Example: Phase 5 Page Restyle

```bash
# All page-restyle tasks touch different files → fully parallel:
Task: "Restyle src/pages/Dashboard.tsx to v2 tokens"
Task: "Restyle src/pages/Employees.tsx to v2 tokens"
Task: "Restyle src/pages/Companies.tsx to v2 tokens"
Task: "Restyle src/pages/Projects.tsx to v2 tokens"
Task: "Restyle src/pages/Reports.tsx to v2 tokens"
# … through T068
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (Settings Hub + drawer)
3. **STOP and validate**: `/settings` works end-to-end with tab switching, drawer edit, save
4. Demo internally; verify acceptance scenarios from spec User Story 1
5. Decide whether to ship MVP or continue with US2–4

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP demo
3. US2 → new sidebar deployed (visual change for all users — coordinate communication)
4. US3 → visual consistency pass page-by-page
5. US4 → redirects added, old pages deleted
6. Polish → release-ready

### Parallel Team Strategy

Once Phase 2 done, three devs:
- Dev A: US1 (T029–T042)
- Dev B: US2 (T043–T052)
- Dev C: US3 (T053–T071) — page-restyle tasks easily parallelize within
- Dev A picks up US4 (T072–T077) after US1 lands

---

## Notes

- Constitution principles 1, 2, 3, 5, 6, 7 enforced per task. Principle 4 (Performance) tracked at Phase 7 (bundle gate).
- Big-bang rollout: no feature flag, no gradual. Phase 7 must complete cleanly before merging to main.
- Rollback: `git revert <merge-sha> && push` per [quickstart.md](./quickstart.md).
- WCAG 2.1 AA enforced via axe-core in tests (FR-017..022). Lighthouse CI gate ≥ 95 (SC-010).
- Total tasks: **88**.
  - Phase 1: 6 setup
  - Phase 2: 22 foundational
  - Phase 3 US1: 14
  - Phase 4 US2: 10
  - Phase 5 US3: 19
  - Phase 6 US4: 6
  - Phase 7 Polish: 11

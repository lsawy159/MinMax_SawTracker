# Implementation Plan: إعادة تصميم الواجهة وتوحيد مركز الإعدادات

**Branch**: `002-ui-redesign-unified-settings` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-ui-redesign-unified-settings/spec.md`

## Summary

تحديث شامل للواجهة على ثلاثة محاور (مدفوع بـ 5 قرارات Clarify session 2026-04-25):

1. **Design System v2** كامل — لوحة ألوان جديدة، خطوط جديدة (عربي + إنجليزي)، أيقونات جديدة، إعادة بناء مكونات shadcn/ui الحالية بألوان وأنماط v2 مع الحفاظ على Radix primitives.
2. **Settings Hub مُركَّز** — صفحة `/settings` بتبويبتين فقط: `users-permissions` (دمج `Users.tsx` + `Permissions.tsx`) و `backup` (نقل `BackupSettings.tsx`). باقي صفحات الإعدادات (`AlertSettings`, `AdminSettings`/`GeneralSettings`, `SecurityManagement`) تبقى صفحات مستقلة.
3. **Sidebar معاد تنظيمه** بمجموعتين: تشغيل (12 بند) + إدارة (4 بنود للأدمن). Header موحَّد. Redirects للروابط القديمة المنقولة (`/users`, `/permissions`, `/backup-settings`).

**Approach التقني**: Big-bang رولاوت، استبدال `src/components/ui/*` skin بـ v2، إنشاء `src/components/layout/AppShell.tsx` + `Sidebar.tsx` + `Header.tsx`، إعادة بناء `Settings.tsx` كـ tab container مع routing عبر query param. WCAG 2.1 AA يفرض focus trap في drawers + ARIA roles + contrast tokens.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React 18, ECMAScript 2022 target
**Primary Dependencies**:
- React Router v6 (routing + redirects)
- TanStack Query v5 (data fetching, mutations)
- shadcn/ui (Radix primitives wrapped) — existing, restyled to v2
- Tailwind CSS 3.x (utility classes + design tokens via CSS vars)
- React Hook Form + Zod (forms + validation)
- next-themes (light/dark)
- sonner (toasts)
- lucide-react (current icons) → potentially replaced with new set per FR-013
- @radix-ui/react-tabs (Settings hub tabs, accessible by default)
- @radix-ui/react-dialog (Drawer/Sheet for permission editor)

**Storage**: Supabase (PostgreSQL) — **no schema changes** in this feature; reuse existing `users`, `roles`, `permissions`, `backup_*` tables and RLS policies as-is.

**Testing**: Vitest + happy-dom + @testing-library/react + @testing-library/user-event. axe-core for a11y. Existing test setup in `src/test/setup-tests.ts`.

**Target Platform**: Modern browsers (last 2 versions of Chrome, Edge, Firefox, Safari). Mobile (≤768px), tablet (769–1024px), desktop (>1024px). Vercel deploy. Arabic-first RTL.

**Project Type**: Single-page web application (frontend SPA) — `src/` only; no backend changes.

**Performance Goals**:
- Tab switch in `/settings` < 500ms (SC-005)
- Lighthouse Accessibility audit ≥ 95/100 (SC-010)
- Bundle size still < 5 MB total (constitution)
- Initial Settings page render (P50) < 800ms on mid-tier mobile

**Constraints**:
- WCAG 2.1 AA mandatory (FR-017..022, SC-010, SC-011)
- RTL must remain pixel-correct after redesign
- No backend/migration changes (keep Supabase RLS untouched)
- Big-bang rollout — no feature flag, requires staging QA + git-revert rollback plan
- No regression in existing Users/Permissions/BackupSettings functionality (FR-007)

**Scale/Scope**:
- 25 production pages affected by Design System v2 application
- 3 pages collapsed into Settings hub (Users, Permissions, BackupSettings)
- 9 redirect rules to add/update
- ~150 component refactors estimated (buttons, cards, tables, forms, empty/loading/error states)
- Single tenant per deployment, ~50 admin users active

## Constitution Check

*GATE 1: Pre-Phase 0 evaluation against `.specify/memory/constitution.md` v1.0.0.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| 1 | **Type Safety (Strict TS)** | ✅ Pass | All new components in TS strict. Tab IDs as union type `'users-permissions' \| 'backup'`. Permission editor schema via Zod. No `any` introduced. |
| 2 | **Testing Discipline** | ✅ Pass | New tests required: tab routing, redirect resolver, permission-edit drawer (open/save/close + focus trap), sidebar grouping by role, axe-core a11y smoke per page. ≥70% coverage of `Settings.tsx`, `Sidebar.tsx`, `redirects.ts`. |
| 3 | **Code Clarity** | ✅ Pass | Each tab extracted to its own file (`UsersPermissionsTab.tsx`, `BackupTab.tsx`). Shell components composed (`AppShell` > `Sidebar` + `Header` + `Outlet`). No function > 50 LOC after refactor. |
| 4 | **Performance** | ⚠ Watch | Risk: new icon set + font files may increase bundle. **Mitigation**: tree-shake icons (per-icon imports only), self-host fonts with `font-display: swap`, code-split tabs via lazy + Suspense. Budget: bundle delta ≤ +200 KB gzipped. Verified post-build. |
| 5 | **Security** | ✅ Pass | Permission gate per tab uses existing role check (`useAuth().user.role`). Direct URL `/settings?tab=backup` re-validates server-side via existing RLS on `backup_*` tables. No new attack surface. |
| 6 | **Documentation** | ✅ Pass | `DesignSystem.tsx` updated as Style Guide (FR-016). JSDoc on `AppShell`, `Sidebar`, `Header`, `useTabState`. README sidebar grouping diagram. |
| 7 | **CI/CD** | ✅ Pass | Conventional commits: `feat(ui)`, `feat(settings)`, `refactor(layout)`, `test(a11y)`. Bundle gate enforced. ESLint/type-check/Vitest in CI. |

**Verdict**: PASS. One watch item (bundle size) tracked in Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-redesign-unified-settings/
├── plan.md                  # this file
├── spec.md                  # feature spec (frozen post-Clarify)
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 — UI/state entities (no DB schema)
├── quickstart.md            # Phase 1 — dev quick-start for design system v2
├── contracts/
│   ├── settings-hub-routing.md       # tab IDs + URL contract
│   ├── permission-editor.md          # drawer open/save/cancel contract
│   └── design-tokens.md              # color/typography/spacing tokens
├── checklists/
│   └── requirements.md      # spec quality checklist (already passing)
└── tasks.md                 # Phase 2 — generated by /speckit-tasks (not now)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/                          # shadcn primitives — restyled to v2 tokens
│   │   ├── button.tsx               # restyled
│   │   ├── card.tsx                 # restyled
│   │   ├── table.tsx                # restyled
│   │   ├── input.tsx                # restyled
│   │   ├── tabs.tsx                 # restyled
│   │   ├── sheet.tsx                # restyled (used as Drawer)
│   │   ├── empty-state.tsx          # NEW unified empty state
│   │   ├── error-state.tsx          # NEW unified error state
│   │   └── loading-state.tsx        # NEW unified loading state
│   ├── layout/                      # NEW directory
│   │   ├── AppShell.tsx             # NEW — wraps Sidebar + Header + main outlet
│   │   ├── Sidebar.tsx              # NEW — grouped nav (operational + admin)
│   │   ├── Header.tsx               # NEW — user, notifications, theme, search
│   │   └── nav-config.ts            # NEW — single source for sidebar items
│   └── settings/                    # NEW directory
│       ├── SettingsHub.tsx          # NEW — Tabs container, query-param sync
│       ├── tabs/
│       │   ├── UsersPermissionsTab.tsx     # NEW — merged Users + Permissions
│       │   ├── PermissionDrawer.tsx        # NEW — per-row drawer
│       │   └── BackupTab.tsx               # NEW — wraps existing BackupSettings logic
│       └── useSettingsTabState.ts   # NEW — query-param ↔ active tab hook
├── pages/
│   ├── Settings.tsx                 # REFACTORED — renders <SettingsHub />
│   ├── Users.tsx                    # DELETED (logic absorbed into UsersPermissionsTab)
│   ├── Permissions.tsx              # DELETED (logic absorbed into UsersPermissionsTab)
│   ├── BackupSettings.tsx           # DELETED (logic moved into BackupTab)
│   ├── Dashboard.tsx                # restyled to v2 (no logic change)
│   ├── Employees.tsx                # restyled to v2 (no logic change)
│   ├── Companies.tsx                # restyled to v2 (no logic change)
│   ├── Projects.tsx                 # restyled to v2 (no logic change)
│   ├── Reports.tsx                  # restyled to v2
│   ├── Alerts.tsx                   # restyled to v2
│   ├── ActivityLogs.tsx             # restyled to v2
│   ├── ImportExport.tsx             # restyled to v2
│   ├── Notifications.tsx            # restyled to v2
│   ├── PayrollDeductions.tsx        # restyled to v2
│   ├── TransferProcedures.tsx       # restyled to v2
│   ├── AdvancedSearch.tsx           # restyled to v2
│   ├── AlertSettings.tsx            # restyled to v2 (stays standalone)
│   ├── AdminSettings.tsx            # restyled to v2 (stays standalone)
│   ├── GeneralSettings.tsx          # restyled to v2 (stays standalone)
│   ├── SecurityManagement.tsx       # restyled to v2 (stays standalone)
│   ├── DesignSystem.tsx             # UPDATED — Style Guide v2 (FR-016)
│   └── Login.tsx                    # restyled to v2
├── App.tsx                          # MODIFIED — new routing, redirects, AppShell wrap
├── styles/
│   ├── tokens.css                   # NEW — CSS vars for v2 colors/typography/spacing
│   └── index.css                    # MODIFIED — import tokens.css, font-face declarations
├── hooks/                           # existing hooks; useUiPreferences extended for new tokens
├── lib/                             # unchanged
├── utils/                           # unchanged
├── services/                        # unchanged
├── constants/                       # unchanged
└── test/
    ├── setup-tests.ts               # MODIFIED — install axe-core matchers
    └── a11y.test-helpers.ts         # NEW — runAxe(component) helper

src/components/settings/__tests__/
├── SettingsHub.test.tsx             # NEW — tab switching, URL sync, perm gating
├── UsersPermissionsTab.test.tsx     # NEW — list, drawer open/save, focus trap
└── BackupTab.test.tsx               # NEW — wrapped existing logic still works

src/components/layout/__tests__/
├── Sidebar.test.tsx                 # NEW — grouping, role-based visibility
└── AppShell.test.tsx                # NEW — render, redirect handling

src/__tests__/
└── redirects.test.tsx               # NEW — /users → /settings?tab=users-permissions, etc.

supabase/                            # UNCHANGED — no schema or function changes
```

**Structure Decision**: Single-project SPA (existing). All changes confined to `src/`. Three new directories created (`components/layout/`, `components/settings/`, `styles/tokens.css`). Three legacy pages deleted (`Users.tsx`, `Permissions.tsx`, `BackupSettings.tsx`) — their content absorbed into `components/settings/tabs/*.tsx`. No backend changes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Big-bang rollout (no feature flag) | User explicitly chose Option A in Clarify Q5 | Feature-flag (B) was recommended for risk reduction; rejected by user. Mitigation: staging QA + git-revert plan documented in spec Assumptions. |
| Net-new icon library | Spec FR-013 mandates new iconography as part of full visual redesign | Keeping lucide-react (current) was rejected per user's Q1 = Option A (full visual). Mitigation: tree-shake imports + per-icon dynamic where possible. |

No constitution violations requiring justification. Both items above are user-mandated, not constitutional.

---

## Phase 0: Outline & Research

See [research.md](./research.md). Resolves:

- R1: New color palette source (custom vs prebuilt theme like Tailwind UI / Untitled UI)
- R2: Arabic + Latin font pairing for SawTracker (display + body)
- R3: Icon library choice (Phosphor vs Lucide-restyled vs custom)
- R4: Tabs URL strategy (query param vs nested route)
- R5: Permission editor pattern (drawer vs modal vs inline expansion)
- R6: WCAG 2.1 AA testing tooling (axe-core integration in Vitest)
- R7: Bundle-size mitigation strategy

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) — UI/state entities only (Settings Tab, Nav Item, Theme Token, Drawer State)
- [contracts/settings-hub-routing.md](./contracts/settings-hub-routing.md) — tab IDs, URL shape, redirect map
- [contracts/permission-editor.md](./contracts/permission-editor.md) — drawer lifecycle + accessibility
- [contracts/design-tokens.md](./contracts/design-tokens.md) — token names, light/dark values, Tailwind binding
- [quickstart.md](./quickstart.md) — dev guide for picking up Design System v2

Agent context update: `CLAUDE.md` SPECKIT block updated to reference this plan.

## Constitution Re-Check (Post-Design)

After Phase 1 design produced, re-evaluate:

| Principle | Re-check Result |
|-----------|-----------------|
| Type Safety | ✅ Tab IDs typed as union; permission payload via Zod schema in `permission-editor.md`. |
| Testing | ✅ Test files mapped above. axe-core helper isolated in `test/a11y.test-helpers.ts`. |
| Code Clarity | ✅ Each tab + drawer + shell component its own file. No file > 250 LOC expected. |
| Performance | ✅ Bundle delta budget set (+200 KB gz). Lazy-load tabs. Token CSS vars (no runtime theme JS overhead). |
| Security | ✅ Tab gating uses existing `useAuth` role check + RLS unchanged. |
| Documentation | ✅ Style Guide (DesignSystem.tsx) + JSDoc + design-tokens.md contract. |
| CI/CD | ✅ Conventional commits scoped (`feat(ui)`, `feat(settings)`, `refactor(layout)`, `test(a11y)`). Bundle gate retained. |

**Final verdict**: PASS. No new violations introduced by design.

---

## Stop & Report

Plan complete through Phase 2 design. Artifacts to be generated next (this plan command produces them):

- ✅ plan.md (this file)
- ⏭ research.md
- ⏭ data-model.md
- ⏭ contracts/settings-hub-routing.md
- ⏭ contracts/permission-editor.md
- ⏭ contracts/design-tokens.md
- ⏭ quickstart.md
- ⏭ CLAUDE.md SPECKIT block update

Tasks generation deferred to `/speckit-tasks` command (Phase 3, not in this run).

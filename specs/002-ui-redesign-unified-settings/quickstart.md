# Quickstart — UI Redesign + Unified Settings

For developers picking up implementation tasks.

---

## Prerequisites

- Node ≥ 20, pnpm ≥ 8 (per CLAUDE.md).
- Familiar with: React 18, TanStack Query v5, shadcn/ui, Tailwind, Vitest.
- Read first:
  - [spec.md](./spec.md) — what we're building + why
  - [plan.md](./plan.md) — high-level structure
  - [contracts/design-tokens.md](./contracts/design-tokens.md) — visual system
  - [contracts/settings-hub-routing.md](./contracts/settings-hub-routing.md) — routing contract
  - [contracts/permission-editor.md](./contracts/permission-editor.md) — drawer contract

---

## Setup

```bash
pnpm install
pnpm dev          # http://localhost:5174
```

---

## Where to start

Work order matches dependency chain:

1. **Tokens** — author `src/styles/tokens.css` per `contracts/design-tokens.md`. Wire `tailwind.config.js`. Verify Style Guide page renders new colors.
2. **Fonts** — drop subset font files in `src/assets/fonts/`. Update `src/styles/index.css` with `@font-face`. Verify on `/dashboard`.
3. **Icons** — add `@phosphor-icons/react`, remove `lucide-react`. Migrate icon imports per file (search `from 'lucide-react'`).
4. **Primitives** — restyle each `src/components/ui/*` component to consume new tokens. Add `EmptyState`, `LoadingState`, `ErrorState` if not yet present.
5. **Layout** — build `src/components/layout/{AppShell,Sidebar,Header}.tsx` + `nav-config.ts`. Wrap `App.tsx` routes in `<AppShell>`.
6. **Settings hub** — create `src/components/settings/SettingsHub.tsx` + tab files. Refactor `pages/Settings.tsx` to render `<SettingsHub />`.
7. **Tab content** — port `pages/Users.tsx` + `pages/Permissions.tsx` into `UsersPermissionsTab.tsx`. Build `PermissionDrawer.tsx`. Port `pages/BackupSettings.tsx` into `BackupTab.tsx`.
8. **Redirects** — update `App.tsx` route table per `contracts/settings-hub-routing.md`. Delete legacy page files.
9. **Restyle remaining pages** — apply new tokens to all listed pages in `plan.md`.
10. **A11y pass** — install `vitest-axe`, run `pnpm test`, fix violations. Manual NVDA pass on 3 key flows.
11. **Bundle check** — `pnpm build && pnpm analyze`. Verify total ≤ existing baseline + 200 KB gz.
12. **Style Guide** — update `pages/DesignSystem.tsx` with v2 component examples (FR-016).

---

## Useful commands

```bash
pnpm dev               # dev server
pnpm test              # one-shot vitest
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage
pnpm lint              # ESLint
pnpm type-check        # TS check, no build
pnpm validate          # type + lint + test
pnpm build             # prod build
pnpm analyze           # bundle visualizer
```

---

## Definition of Done (per task)

- [ ] Code follows constitution (TS strict, no `any`, function ≤ 50 LOC)
- [ ] Tests pass: `pnpm test`
- [ ] No new ESLint warnings: `pnpm lint`
- [ ] Type-check clean: `pnpm type-check`
- [ ] axe-core: zero violations on changed components
- [ ] Bundle delta ≤ +200 KB gzipped (cumulative)
- [ ] Manual smoke on `/dashboard`, `/settings`, `/employees` in light + dark
- [ ] Conventional commit message: `feat(ui)`, `feat(settings)`, `refactor(layout)`, etc.

---

## Common pitfalls

- **RTL drawer direction**: Radix Sheet defaults to LTR; pass `dir="rtl"` or rely on `<html dir="rtl">`. Test both directions.
- **Token naming drift**: do NOT hard-code colors in components. Always reference Tailwind classes that map to CSS vars.
- **Tab unmount data loss**: TanStack Query cache survives unmount; form state does not. Use `useUnsavedChangesGuard` before allowing tab switch.
- **Permission gate bypass**: server RLS still validates; UI gate is UX-only. Never trust UI alone for security.
- **Old page references**: after deleting `Users.tsx` etc., `grep` for stray imports. CI will catch but local search saves time.
- **Lighthouse accessibility ≠ axe-core**: both must pass. Lighthouse runs in production-like mode; run on Vercel preview.

---

## Rollback plan (Big-Bang Rollout)

If production breaks:

```bash
git revert <merge-commit-sha>
git push origin main
# Vercel auto-redeploys previous state.
```

Pre-merge checklist (must hold before main merge):
- [ ] Staging URL passes manual QA on all 25 pages.
- [ ] Lighthouse a11y ≥ 95 on /dashboard, /settings, /employees.
- [ ] No console errors in browser dev tools.
- [ ] Smoke test: login → dashboard → settings → users-permissions tab → edit a user's role → save → confirm.
- [ ] All redirect URLs land correctly.

---

## Questions / blockers

Open in repo, tag `feature:002-ui-redesign-unified-settings`. Refer back to spec/plan before adding scope.

# Phase 0 Research — UI Redesign + Unified Settings

**Date**: 2026-04-25
**Plan**: [plan.md](./plan.md)

Resolves all NEEDS CLARIFICATION + best-practice questions raised in Technical Context.

---

## R1 — Color palette source

**Decision**: Custom token system layered over Tailwind CSS, defined in `src/styles/tokens.css` as CSS custom properties (`--color-primary-500`, `--color-neutral-100`, ...). Light/dark variants on `:root` + `[data-theme="dark"]`. Wired to Tailwind via `tailwind.config.js` `theme.extend.colors` referencing `var(--color-...)`.

**Rationale**:
- Spec FR-013 demands new palette, but consistent with existing shadcn/ui theming convention (HSL CSS vars).
- CSS-var approach lets `next-themes` toggle without bundle penalty (vs Tailwind class-based dark mode duplication).
- Tokens decouple design from implementation — designer can iterate values without touching component code.
- Aligns with FR-014 (light/dark parity) and accessibility contrast requirements (FR-020).

**Alternatives rejected**:
- Pre-built theme (e.g. Tailwind UI Catalyst, Untitled UI palette): faster but locks visual language and licensing concerns.
- Hard-coded Tailwind classes per component: violates FR-014 (forces duplicated dark variants), inflates bundle.
- CSS-in-JS (styled-components/emotion): runtime cost, conflicts with current Tailwind setup, no benefit here.

---

## R2 — Arabic + Latin font pairing

**Decision**:
- **Body (Arabic + Latin)**: `IBM Plex Sans Arabic` + `IBM Plex Sans` — open source (OFL), excellent Arabic shaping, matched Latin metrics, 4 weights bundled (300/400/500/700).
- **Display (headings)**: `Cairo` (Arabic-first display, 400/600/700/800).
- **Monospace (codes/IDs)**: keep `ui-monospace` system stack (no need to ship a custom mono).

Self-hosted via `@font-face` in `src/styles/index.css` with `font-display: swap`. Subset to Arabic + Latin Basic.

**Rationale**:
- IBM Plex Sans Arabic has the best harmony with its Latin counterpart for mixed RTL/LTR strings (employee Arabic name + EN ID).
- Cairo as display gives modern Arabic-first character. Both are Google-Fonts-friendly and OFL-licensed.
- `font-display: swap` prevents FOIT, important on slower mobile connections (constitution principle 4).
- Self-hosting eliminates third-party network hop and CSP complexity.

**Alternatives rejected**:
- `Tajawal` only: weaker Latin counterpart, mismatched x-heights.
- Google Fonts CDN: extra DNS/TLS hop, harder CSP, privacy concerns.
- System fonts only (`Segoe UI`/`SF Arabic`): platform-dependent appearance, defeats redesign uniformity.

**Bundle impact estimate**: ~120 KB gzipped (4 weights × 2 families subset). Within +200 KB budget.

---

## R3 — Icon library

**Decision**: Replace `lucide-react` with `phosphor-react` (`@phosphor-icons/react`).

**Rationale**:
- 6 weights (thin/light/regular/bold/fill/duotone) — gives the redesign a clear visual signature without custom SVGs.
- Tree-shakeable per-icon imports (`import { House } from '@phosphor-icons/react'`).
- Larger catalog (~9000 icons) — covers all current Lucide usages plus settings-specific (Drawer, Toggle, ShieldCheck variants).
- Permissive MIT license.

**Migration path**: Map current Lucide imports to Phosphor equivalents in a single PR. Keep `lucide-react` removed from `package.json` to prevent dual-bundle.

**Alternatives rejected**:
- Keep Lucide restyled (color tweaks only): violates user's full-redesign requirement (Clarify Q1 = A).
- Hand-drawn SVG set: high effort, inconsistent.
- Heroicons: smaller catalog, less weight variation.
- Iconoir: smaller adoption, fewer eyes-on-quality issues.

**Bundle impact**: per-icon imports, ~25 icons × 1 KB ≈ 25 KB. Net change vs Lucide ≈ neutral.

---

## R4 — Tabs URL strategy (query param vs nested route)

**Decision**: Query parameter `?tab=<id>` on `/settings`.

**Rationale**:
- Simpler routing — no need to register `/settings/users-permissions`, `/settings/backup` separately.
- Matches existing app convention (`/admin-settings?tab=permissions` already used in `App.tsx:248`).
- Easier deep-link sharing and bookmark restoration.
- Trivial backwards-compat: redirects from `/users` map to `/settings?tab=users-permissions`.
- Acceptance Scenario 3 already specifies this shape.

**Alternatives rejected**:
- Nested routes `/settings/:tab`: requires React Router child route + Outlet wiring; more code; benefit (cleaner URL aesthetics) doesn't justify migration cost.
- Hash fragment `/settings#backup`: doesn't trigger React Router updates without manual listener; SEO N/A but worse for analytics.
- Path-based with default `/settings` redirecting to `/settings/users-permissions`: extra redirect hop, breaks copy-paste of root URL.

---

## R5 — Permission editor pattern

**Decision**: Side **Drawer (Sheet)** opening from the inline (right side in RTL) edge, anchored to the row click. Implemented via `@radix-ui/react-dialog` (existing in shadcn `sheet.tsx`).

**Rationale**:
- Spec FR-007a/b mandates per-row "Permissions" button without leaving the tab.
- Drawer keeps user spatial context (table stays visible underneath) — better than full-screen modal for "look at user, edit permissions" flow.
- Radix Dialog gives us focus trap + Esc-to-close + ARIA roles for free → satisfies FR-021/022 directly.
- RTL-friendly: Radix supports `dir="rtl"`; drawer slides from logical inline-start.
- Reusable for future settings tabs (e.g. backup detail).

**Alternatives rejected**:
- **Modal dialog**: covers the table, loses context, often misused for non-blocking edits.
- **Inline row expansion**: works for ≤5 short fields, but permission matrix per user can be 20+ checkboxes; row would balloon and break table rhythm.
- **Navigate to subroute** (e.g. `/settings/users-permissions/:userId`): violates "no full-page navigation" principle; extra routing complexity.

**Acceptance fit**: Drawer state in `useState` local to `UsersPermissionsTab`; query param NOT used for drawer (avoids stale-link issues for transient state).

---

## R6 — WCAG 2.1 AA testing tooling

**Decision**: `vitest-axe` package (wraps `axe-core` for Vitest). Run `expect(html).toHaveNoViolations()` in component tests for high-risk surfaces (Settings hub, drawer, sidebar, dashboard). Manual audit via Lighthouse CI on staging URL pre-release.

**Rationale**:
- Catches the bulk of automated-detectable WCAG issues at unit-test level (label association, contrast, ARIA misuse, focus order).
- Existing Vitest infra — no new test runner.
- ~70% of WCAG AA failures are automated-detectable per axe-core docs; remaining 30% (focus order subtleties, screen-reader semantics) covered by manual NVDA pass before release.
- Lighthouse a11y score gate ≥ 95 directly maps to SC-010.

**Alternatives rejected**:
- **Cypress + axe**: heavyweight for a frontend-only test, longer feedback loop.
- **Manual audit only**: doesn't scale, regresses easily.
- **Pa11y**: separate runner, dup work.

**Bundle impact**: zero (devDep).

---

## R7 — Bundle-size mitigation strategy

**Decision**:
- Tree-shake icons via per-icon imports.
- Self-host fonts subset to Arabic + Latin Basic only (drop Greek/Cyrillic).
- Code-split Settings tabs via `React.lazy(() => import('./tabs/UsersPermissionsTab'))` + Suspense.
- Continue route-level lazy-loading already in `App.tsx`.
- After full integration, run `pnpm analyze` and verify `vendor` chunk ≤ existing baseline + 200 KB gz delta.

**Rationale**:
- Constitution principle 4 enforces ≤ 5 MB total bundle. Current baseline ~3.2 MB (per recent build artifacts referenced in CLAUDE.md). Headroom is comfortable but new fonts + design system additions need monitoring.
- Code-split tabs reduce TTI on the most-common Dashboard entry path.

**Alternatives rejected**:
- **No mitigation**: risks bundle creep + Lighthouse perf regression.
- **Inline SVGs for icons**: no central registry, harder to update.
- **Bundle all tabs together**: simpler but unused tabs ship to all users.

**Verification**: post-merge Vercel preview build prints bundle sizes; Constitution Principle 4 enforced via existing CI bundle gate.

---

## Summary of Decisions

| ID | Decision | Bundle Δ | Risk |
|----|----------|----------|------|
| R1 | Custom CSS-var token system | 0 KB | Low |
| R2 | IBM Plex Sans Arabic + Cairo, self-hosted | +120 KB | Low (FOUT mitigated by `swap`) |
| R3 | Phosphor Icons (per-icon imports) | ~0 KB | Low |
| R4 | Query param `?tab=` | 0 KB | None |
| R5 | Drawer (Radix Sheet) for permissions | 0 KB | None |
| R6 | vitest-axe + Lighthouse CI | 0 KB (dev) | None |
| R7 | Lazy tabs + subset fonts + per-icon | -10 KB | Mitigates R2 |

**Net bundle estimate**: +110 KB gzipped — within +200 KB budget. PASS.

All NEEDS CLARIFICATION resolved. Ready for Phase 1 design.

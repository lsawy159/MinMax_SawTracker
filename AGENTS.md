# AGENTS.md — SawTracker Quick Reference

## What Makes This Repo Tricky

- **pnpm only** — npm/yarn will break lockfile and hoisting. Always `pnpm install`.
- **Vite + React Router 6 (lazy)** — All pages are `lazy()` loaded; route changes create new component instances (`key={location.pathname}` in `App.tsx`).
- **Supabase + RLS** — Database lives in `supabase/`. Row-level security is always on; test with real anon key or mocks.
- **happy-dom only** — jsdom causes `webidl-conversion` errors. Vitest uses `happy-dom` (see `vitest.config.ts`).
- **Arabic-first UI with RTL support** — Default labels in Arabic, `date-fns` hijri converter, EGP currency, `next-themes` class-based dark mode.
- **xlsx is vulnerable** — Known CVEs, no patched npm version (per `ci.yml`). Use with caution.
- **TypeScript strict via `tsc --noEmit`** — `pnpm type-check` must pass before commits (enforced by pre-commit and CI).
- **No barrel exports in `components/`** — Explicit imports required; avoids circular deps and HMR issues.

## High-Value Commands

```bash
# Dev (port 5174, CORS enabled, HMR on localhost:5174)
pnpm dev

# Type check only (no emit)
pnpm type-check

# Lint (fails on any warning)
pnpm lint
pnpm lint:fix

# Format (Prettier + Tailwind plugin)
pnpm format
pnpm format:check

# Test (Vitest, happy-dom, no workers)
pnpm test              # run once
pnpm test:watch       # watch mode
pnpm test:ui          # UI dashboard
pnpm test:coverage    # coverage report

# Full pre-commit validation
pnpm validate         # type-check + lint + test

# Build (TS + Vite, chunked)
pnpm build            # type-check + vite build
pnpm build:prod       # BUILD_MODE=prod
pnpm preview          # preview production build

# Clean / reset
pnpm clean            # removes node_modules, dist, coverage, .turbo
pnpm clean:cache      # removes Vite caches
pnpm reinstall        # clean + install
```

Pre-commit (Husky) runs: `pnpm lint` → `pnpm exec tsc --noEmit` → `pnpm test --run`.

## Testing — Watch Outs

- **Use happy-dom** — Tests configured with `environment: 'happy-dom'` and `threads: false`. Do not switch to jsdom; it breaks on webidl.
- **No console in src (except warn/error)** — ESLint allows `console.warn`/`console.error` only in `src/`. `off` for tests and Edge Functions.
- **Supabase client must be mocked** — Use `vi.mock('./lib/supabase')` in tests. Real credentials via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env in CI.
- **Setup files** — `src/test/setup-tests.ts` (jest-dom matchers) runs before each test. Add global helpers there.
- **Test files** — `*.test.tsx` or `*.spec.ts` in `src/`. Use `@testing-library/react` + `happy-dom`. `jsdom` will error.
- **Coverage** — Reports to `coverage/`. CI uploads to Codecov.

## Architecture / Entrypoints

```
src/
  main.tsx        — React root, StrictMode, ErrorBoundary, global handlers, HMR cleanup
  App.tsx         — Routes, AuthProvider, QueryClientProvider, lazy pages, AuthLoading
  index.css       — Tailwind + custom CSS
  contexts/       — AuthContext (Supabase session + user)
  hooks/          — Custom hooks (useAuth, useCompanies, useEmployees, useConfirmation, etc.)
  lib/            — queryClient, supabase client, services (emailQueue, backup, logger)
  components/     — Reusable UI (no barrel exports), pages under src/pages/
  utils/          — dateFormatter, alerts, logger, securityLogger, auditService
  types/          — TypeScript interfaces
  styles/         — index.css (Tailwind + RTL)
```

**Routing**: React Router v6. `/login` public (redirects to `/dashboard` if authenticated). All else protected via `ProtectedRoute`. Pages lazy-loaded with `PageLoader` fallback.

**State**:
- Auth: `AuthContext` (Supabase session).
- Data: TanStack Query v5 (`queryClient` in `lib/queryClient.ts`). Custom hooks in `src/hooks/`.
- No Redux/Zustand — rely on RQ + Context.

**Supabase**:
- Client: `src/lib/supabase.ts`.
- Migrations: `supabase/migrations/`.
- Edge Functions: `supabase/functions/` (Deno). Deploy via Vercel or `supabase functions deploy`.
- RLS enforced on all tables.

## Build & Chunking (Vite)

`vite.config.ts` manualChunks splits vendor bundles to avoid circular deps and HMR issues:

- `vendor-react` — React, ReactDOM, scheduler (must load first)
- `vendor-router` — React Router
- `radix-ui` — Radix primitives
- `charts` — Chart.js, Recharts
- `excel-export` — xlsx, file-saver
- `supabase` — Supabase client
- `utils` — fuse.js, date-fns, hijri-converter
- `forms` — react-hook-form, @hookform
- `ui-libs` — lucide-react, sonner, cmdk
- `zod`, `styling` — respective libs
- `vendor-other` — remaining node_modules

Max bundle size CI check: 5MB (`pr-checks.yml`).

## Code Conventions (Gotchas)

- **`@` alias** — `@/` maps to `src/` (see `tsconfig.json` and `vite.config.ts`). Use it.
- **No barrel exports in `components/`** — Import directly from file paths to avoid HMR glitches and circular deps.
- **Arabic defaults** — RTL layout support via `next-themes`. Hijri dates (`dd/MM/yyyy`), EGP currency.
- **Forms** — React Hook Form + Zod. Display errors via `<ErrorMessage>`.
- **No inline styles** — Tailwind `className` only.
- **Component props** — `ComponentNameProps` interface.
- **Imports order** — React > externals > relative. Group and sort.
- **Error boundary** — `src/components/ErrorBoundary.tsx`. Global handlers in `main.tsx`.
- **Logging** — `src/utils/logger.ts` for debug, `securityLogger.ts` for security events, `auditService.ts` for audit logs.
- **Confirmation dialogs** — Use `useConfirmation()` hook.

## Supabase & Backend Notes

- **Migrations** live in `supabase/migrations/`. Apply via Supabase CLI or Studio.
- **Edge Functions** are Deno. Run/test separately. Deploy via Vercel or `supabase functions deploy`.
- **Local testing** — Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to point to your Supabase project (or use mocks).
- **RLS** is always on. Write policies in `supabase/`. Test permissions with real user roles.
- **Security logging** — `src/utils/securityLogger.ts` + `auditService.ts` → Supabase `audit_logs`.

## CI / PR Checks (What Fails)

- **`ci.yml`** — Lint, type-check, tests (coverage), build, security audit (xlsx warning).
- **`pr-checks.yml`** — Conventional commit title validation, TODO/FIXME scan (warns), bundle size < 5MB.
- **Husky pre-commit** — `lint` → `tsc --noEmit` → `test --run`. Must all pass.
- **Husky commit-msg** — `commitlint` enforces conventional commits.
- **Commit format**: `<type>(<scope>): <subject>` — scopes: auth, companies, employees, dashboard, alerts, ui, api, deps, config, test.

## VS Code & Tooling

- `.vscode/settings.json` — Tailwind IntelliSense friendly. `chat.tools.terminal.autoApprove` enables pnpm/git via chat.
- `.vscode/tasks.json` — Type-check and lint tasks available.
- `.specify/` — Specify workflows for constitution/spec/tasks/implement/analyze/checklist. Hooks auto-commit at each stage (optional prompts).

## When Agents Work in This Repo

- Always run `pnpm type-check` and `pnpm lint` before marking TS/formatting changes "done".
- If you touch `src/lib/supabase.ts` or `supabase/` migrations, verify RLS policies and that tests mock Supabase appropriately.
- If you add page components, add route in `App.tsx` (lazy + ProtectedRoute), and confirm chunk strategy doesn’t regress bundle size.
- When editing `main.tsx` or `App.tsx`, respect HMR cleanup and global handlers (reloading listeners must be cleaned on dispose).
- For new tests, prefer happy-dom and add mocks for Supabase and services. Do not rely on real credentials in tests.
- If adding heavy libs, consider which manualChunks group they belong to and whether they should be lazy-imported (e.g., xlsx).

## References

- CLAUDE.md — Full team conventions, commands, architecture details (RTL, date/currency, dark mode, chunk strategy).
- .specify/ — Workflow automation (constitution → specify → plan → tasks → implement → checklist → analyze).
- .husky/ — Git hooks (pre-commit, commit-msg).
- .github/workflows/ci.yml, pr-checks.yml — CI checks and bundle size limits.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

**Frontend:** React 18 + TypeScript + Vite
**Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives) + Design System v2 tokens
**Icons:** Phosphor Icons (v2.1.10) — migrated from lucide-react
**Typography:** IBM Plex Sans Arabic, IBM Plex Sans, Cairo (WOFF2 subset fonts)
**Forms:** React Hook Form + Zod validation
**State:** TanStack Query v5 (data fetching) + React Context (auth)
**Backend:** Supabase (PostgreSQL + Edge Functions)
**Hosting:** Vercel
**Analytics:** Vercel Analytics + Speed Insights
**Charts:** Chart.js, Recharts
**Testing:** Vitest (happy-dom) + vitest-axe (WCAG 2.1 AA accessibility testing)

## Common Commands

```bash
# Development
pnpm dev              # Start dev server on port 5174

# Building
pnpm build            # TypeScript check + Vite build
pnpm build:prod       # Production build with BUILD_MODE=prod
pnpm preview          # Preview production build locally

# Code Quality
pnpm lint             # Run ESLint (fails on warnings)
pnpm lint:fix         # Auto-fix ESLint issues
pnpm format           # Prettier format src/
pnpm format:check     # Check formatting without changes
pnpm type-check       # TypeScript check without build
pnpm validate         # type-check + lint + test

# Testing
pnpm test             # Run Vitest once
pnpm test:watch       # Watch mode (live reload)
pnpm test:ui          # UI dashboard for tests
pnpm test:coverage    # Coverage report (happy-dom env)

# Utilities
pnpm clean            # Remove node_modules, dist, coverage
pnpm reinstall        # Clean + install fresh
pnpm analyze          # Vite bundle visualizer
```

## Architecture & Structure

### Routing (React Router v6)
- **Public routes:** `/login` (redirects to dashboard if authenticated)
- **Protected routes:** All others require valid Supabase session
- **Lazy loading:** All pages use `lazy()` for code splitting

Pages: Dashboard, Companies, Employees, Projects, Users, Reports, Alerts, Settings, ActivityLogs, ImportExport, and more.

### State Management

**Authentication:** `AuthContext` (session + user from Supabase)
- Provider wraps entire app in `main.tsx`
- Guards routes via `ProtectedRoute` wrapper
- Query loading managed via `AuthLoading` component

**Data Fetching:** TanStack Query v5 (React Query)
- Config in `src/lib/queryClient.ts`
- Custom hooks in `src/hooks/` (e.g., `useCompanies`, `useEmployees`)
- Automatic cache + refetch on mount

### Database (Supabase)
- Migrations in `supabase/migrations/`
- Edge Functions in `supabase/functions/` (Deno-based)
- Tables: companies, employees, projects, users, audit_logs, etc.
- RLS policies enforce row-level security

### Directory Layout

```
src/
  components/       # Reusable UI (buttons, modals, tables)
  pages/           # Full-page components (route targets)
  hooks/           # Custom React hooks (useCompanies, useAuth, etc.)
  contexts/        # React Context providers (AuthContext)
  lib/             # Utilities (queryClient, backupService, etc.)
  utils/           # Standalone functions (dateFormatter, alerts, logger, etc.)
  services/        # Data access layer / integrations
  constants/       # Enums, strings, status names
  types/           # TypeScript interfaces
  styles/          # index.css (Tailwind + custom CSS)
  test/            # Test setup, utilities, fixtures
supabase/
  migrations/      # SQL migrations (timestamped)
  functions/       # Deno edge functions
```

## Code Conventions

### TypeScript
- `@` path alias points to `src/`
- Enable strict mode. Run `pnpm type-check` before commits.
- Use `interface` for object shapes, `type` for unions/tuples.

### Components
- Functional components only (hooks-based).
- Props interface as `ComponentNameProps`.
- Shadcn UI for buttons, modals, forms (in `src/components/ui/`).
- Arabic labels default. Use `dd/MM/yyyy` dates, EGP currency.

### Forms
- React Hook Form + Zod schema.
- Validation errors display via `<ErrorMessage>`.

### Styling
- Tailwind CSS first.
- No inline styles (use `className`).
- Dark mode via `next-themes` (class-based).
- RTL layout support (Arabic UI).

### Imports/Organization
- Group imports: React > external libs > relative imports.
- Avoid `index.ts` barrel exports in `components/` (explicit imports).
- Lazy-load heavy libraries (e.g., `xlsx` via `useEffect`).

### Error Handling
- Global error boundary in `App.tsx`.
- Logger in `src/utils/logger.ts` for debugging.
- Security logging in `src/utils/securityLogger.ts`.
- Custom hook: `useConfirmation()` for confirmation dialogs.

### Testing
- Files: `*.test.tsx` or `*.spec.ts`.
- Framework: Vitest (happy-dom environment).
- Setup: `src/test/setup-tests.ts` (jest-dom matchers).
- Avoid jsdom (causes webidl-conversion errors; use happy-dom).
- Mocks: `vi.mock()` for services, Supabase client.

## Git & Commits

**Commit Format:** Conventional Commits (enforced by commitlint)
```
<type>(<scope>): <subject>

<optional body>
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

**Scopes:** auth, companies, employees, dashboard, alerts, notifications, reports, ui, api, deps, config, test

**Example:**
```bash
git commit -m "feat(companies): add bulk export to Excel"
git commit -m "fix(alerts): resolve date comparison in expiry check"
```

**PR Checks:** Automated validation (semantic PR title, TODO/FIXME scan, bundle size < 5MB).

## Build Optimization

**Vite Chunk Strategy:**
- `vendor-react` – React + ReactDOM + scheduler (first bundle)
- `vendor-router` – React Router
- `radix-ui` – Radix UI components
- `charts` – Chart.js, Recharts
- `excel-export` – XLSX, file-saver
- `supabase` – Supabase client
- Others split as needed

**Max Bundle Size:** 5 MB (CI check).

## Development Tips

1. **HMR Issues?** Check vite.config.ts `hmr` block (port 5174 for TestSprite/docker).

2. **Fast Compilation:** Import only what you need. Avoid barrel exports in components/.

3. **Database Issues?** Check `supabase/migrations/` for schema. Use Supabase studio to test queries.

4. **Performance:** Use `React.memo()`, `useMemo()`, `useCallback()` for expensive renders. TanStack Query handles data caching.

5. **Testing:** Run `pnpm test:watch` during development. Happy-dom faster than jsdom; jsdom causes webidl errors.

6. **Prettier + ESLint:** Hooks handle auto-format on commit. Manual: `pnpm format` and `pnpm lint:fix`.

## Supabase Edge Functions

Located in `supabase/functions/`:
- `send-daily-digest` – Email reports (Deno runtime)
- `send-daily-excel-digest` – Excel export via email
- `trigger-backup` – Database backups

Deploy via Vercel (auto on merge) or CLI: `supabase functions deploy <name>`.

## Analytics & Monitoring

- **Vercel Analytics:** Auto-tracked (speed metrics, page views).
- **Speed Insights:** Real User Metrics (RUM) dashboard.
- **Audit Logs:** Logged via `src/utils/auditService.ts` (Supabase table).

## Security Notes

- **Session Management:** Supabase JWT + secure storage.
- **RLS:** All tables have row-level security policies.
- **Secrets:** Environment variables only (never commit `.env`).
- **CORS:** Configured in vite.config.ts for HTTPS/localhost.

---

**Node:** ≥ 20.0.0 | **pnpm:** ≥ 8.0.0

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

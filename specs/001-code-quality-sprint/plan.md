# Implementation Plan: Code Quality & Performance Sprint

**Branch**: `001-code-quality-sprint` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature spec — 5 code quality initiatives from system health audit

## Summary

Fix 58 SELECT * query violations (constitution-critical), implement 3 missing activity_log audit paths in emailQueueService, consolidate 4 duplicate `calculateDaysRemaining` / `getStatusColor` definitions into shared `statusHelpers.ts`, audit + remove unused DB columns, and split EmployeeCard into sub-components (≤50 lines each).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 18, TanStack Query v5, Supabase JS v2, Vitest, shadcn/ui, Zod
**Storage**: PostgreSQL via Supabase (RLS enforced)
**Testing**: Vitest with happy-dom
**Target Platform**: Web (Vercel) — mobile-first, Arabic RTL
**Project Type**: Web application (frontend SPA + Supabase backend)
**Performance Goals**: Bundle < 5 MB, queries return in < 1s on 3G
**Constraints**: Arabic UI (RTL), EGP currency, Supabase RLS on all tables
**Scale/Scope**: ~34 files with SELECT * violations, 4 duplicate utility definitions, 1 EmployeeCard component to split

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Type Safety | ⚠️ VIOLATION | 58 SELECT * violate explicit column rule. `calculateDaysRemaining` in EmployeeCard returns `number \| null` (inconsistent). Fix required. |
| 2. Testing | ⚠️ GAP | emailQueueService TODOs (lines 80, 85, 91) have no tests. New activity_log paths need integration tests. |
| 3. Code Clarity | ✅ IMPROVING | Extracting status helpers + splitting EmployeeCard directly addresses this principle. |
| 4. Performance | ❌ CRITICAL VIOLATION | Constitution Principle 4: "Supabase: all queries must specify columns (SELECT *, denied; explicit columns required)." 58 violations must be fixed. |
| 5. Security | ⚠️ GAP | emailQueueService audit trail commented out — email operations not logged. Uncomment is mandatory. |
| 6. Documentation | ⚠️ REQUIRED | New `statusHelpers.ts` requires JSDoc on all exported functions. |
| 7. CI/CD | ✅ | All changes verified via `pnpm validate` (type-check + lint + test + build). |

**Gate result**: VIOLATIONS present — implementation MUST address Principles 1, 4, 5 as primary work. Others are improvements.

## Project Structure

### Documentation (this feature)

```text
specs/001-code-quality-sprint/
├── plan.md              ← this file
├── research.md          ← Phase 0 output (SELECT * audit, helper analysis)
├── data-model.md        ← Phase 1 output (statusHelpers types, ActivityLog)
├── quickstart.md        ← Phase 1 output (execution guide)
└── tasks.md             ← Phase 2 output (/speckit-tasks command)
```

### Source Code (affected paths)

```text
src/
├── utils/
│   └── statusHelpers.ts          ← NEW: canonical calculateDaysRemaining + getStatusColor
├── lib/
│   └── emailQueueService.ts      ← MODIFY: uncomment 3 activity_log TODOs
├── hooks/
│   ├── usePayroll.ts             ← MODIFY: fix 7 SELECT *
│   ├── useEmployeeObligations.ts ← MODIFY: fix 3 SELECT *
│   ├── useCompanies.ts           ← MODIFY: fix 1 SELECT *
│   └── useProjects.ts            ← MODIFY: fix 1 SELECT *
├── components/
│   └── employees/
│       └── EmployeeCard.tsx      ← MODIFY: remove local helpers, extract sub-components
├── utils/
│   ├── autoCompanyStatus.ts      ← MODIFY: import from statusHelpers
│   └── commercialRegistration.ts ← MODIFY: import from statusHelpers
└── pages/
    └── [34 files]                ← MODIFY: fix remaining SELECT *

supabase/
└── migrations/
    └── TIMESTAMP_remove_unused_columns.sql  ← NEW: (after audit)
```

## Complexity Tracking

No constitution violations that require justification — all changes are reductions in complexity, not additions.

## Phase 0 Research Summary

See [research.md](research.md) for full findings. Key decisions:

1. **Canonical `calculateDaysRemaining`**: Use `autoCompanyStatus.ts` version (handles `string | Date | null | undefined`) as base for new `statusHelpers.ts`.
2. **Canonical `getStatusColor`**: Extends `lib/utils.ts` version with null-safe handling and 4-level status (expired/critical/warning/ok).
3. **emailQueueService**: TODOs confirmed at lines 80, 85, 91 — implementation already drafted in comments, just needs uncomment + verify RLS.
4. **SELECT * scope**: 58 occurrences / 34 files. `backupService.ts` is intentional exception (document with comment).
5. **DB column cleanup**: Audit-first approach — no destructive migrations without full column-usage mapping.

## Phase 1 Design

See [data-model.md](data-model.md) for full type definitions.

### statusHelpers.ts Contract

```typescript
// src/utils/statusHelpers.ts
export const calculateDaysRemaining = (date: string | Date | null | undefined): number
export const getStatusColor = (days: number | null | undefined): string
export type StatusColorLevel = 'expired' | 'critical' | 'warning' | 'ok'
export const getStatusColorLevel = (days: number | null | undefined): StatusColorLevel
```

### EmployeeCard Decomposition

```
EmployeeCard
├── EmployeeExpirySection
│   └── ExpiryStatusRow (reusable)
├── EmployeeBasicInfo
└── EmployeeActionButtons
```

### Implementation Sequence

Per [quickstart.md](quickstart.md):
1. Create `statusHelpers.ts` → migrate all callers → run type-check
2. Uncomment emailQueueService TODOs → add integration tests
3. Fix SELECT * in hooks (priority: usePayroll 7x, useEmployeeObligations 3x)
4. Fix SELECT * in pages/utils (34 files total, batch by page)
5. Refactor EmployeeCard into sub-components
6. Database column audit → migration

## Post-Design Constitution Re-check

| Principle | Post-Design Status |
|-----------|-------------------|
| 1. Type Safety | ✅ RESOLVED — `statusHelpers.ts` has explicit types; `calculateDaysRemaining` returns `number` (no null ambiguity) |
| 2. Testing | ✅ PLANNED — emailQueueService integration test in Step 2; hook refactor tests in Step 3 |
| 4. Performance | ✅ RESOLVED — all 58 SELECT * replaced with explicit columns |
| 5. Security | ✅ RESOLVED — 3 activity_log paths implemented |
| 6. Documentation | ✅ PLANNED — JSDoc on all exports in statusHelpers.ts |

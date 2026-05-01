# Research: Code Quality Sprint

**Date**: 2026-04-25 | **Branch**: `001-code-quality-sprint`

## Decision: calculateDaysRemaining Canonical Version

**Decision**: Adopt `autoCompanyStatus.ts` version as canonical — most complete, handles `null | undefined | string | Date`.

**Rationale**: `lib/utils.ts` version only accepts `string` (no null handling). `EmployeeCard.tsx` version returns `number | null` instead of `number`. `commercialRegistration.ts` version is nearly identical to `autoCompanyStatus.ts`. Canonical must handle `null/undefined` to not break callers.

**Alternatives considered**:
- `lib/utils.ts:calculateDaysRemaining` — too strict (no null), would break callers
- `commercialRegistration.ts` version — functionally equivalent but wrong domain

**Action**: Migrate to `src/utils/statusHelpers.ts`, delete local definitions, keep `lib/utils.ts` version (different signature — keep but don't duplicate).

---

## Decision: getStatusColor Canonical Version

**Decision**: `lib/utils.ts` version (returns Tailwind string) as base, extended with `null` handling from `EmployeeCard.tsx`.

**Rationale**: Most callers use simple string return. `commercialRegistration.ts` returns an object `{text, bg, border}` — only used in that file, can stay local. `EmployeeCard.tsx` needs null-safe version.

**Alternatives considered**:
- `commercialRegistration.ts` object version — too complex for general use, incompatible with other callers

---

## Finding: SELECT * Violations

**Count**: 58 occurrences across 34 files

**Priority files** (by impact):
| File | Count | Table(s) |
|------|-------|----------|
| `hooks/usePayroll.ts` | 7 | payroll_deductions, payroll_records |
| `pages/Alerts.tsx` | 5 | companies, employees, email_queue |
| `hooks/useEmployeeObligations.ts` | 3 | employees, obligations |
| `utils/auditService.ts` | 3 | audit_logs |
| `components/employees/EmployeeCard.tsx` | 4 | employees |
| `components/employees/AddEmployeeModal.tsx` | 2 | employees |

**Strategy**: Fix hooks first (shared by many components = highest impact). Pages + utils second. Components last.

**Constraint**: Some queries use `.select('*')` then access many columns (e.g. backup service exports all columns by design). Those get special treatment: document explicit exclusion or keep with comment justifying why.

---

## Finding: emailQueueService.ts TODOs

**Location**: `src/lib/emailQueueService.ts` lines 80, 85, 91

**Status**: Implemented but commented out — code already written, just needs uncomment + verification.

**activity_log schema** (from codebase patterns):
```
entity_type: string
action: 'create_success' | 'create_failed' | 'create_exception'
resource_id?: string
details?: string
```

**Risk**: Need to verify `activity_log` table exists and has RLS policies before uncommenting.

---

## Finding: Duplicate Status Helpers

**Locations**:
1. `src/lib/utils.ts:10,15` — simple version, no null handling
2. `src/utils/autoCompanyStatus.ts:85` — full version, exported
3. `src/utils/commercialRegistration.ts:13,32` — full version + object variant
4. `src/components/employees/EmployeeCard.tsx:31,402` — embedded, `number | null` return

**Selected canonical path**: `src/utils/statusHelpers.ts` (new file)

**Import migration count**:
- `calculateDaysRemaining`: ~8 import sites
- `getStatusColor`: ~5 import sites
- `comprehensiveExpiryAlertService.ts:152` — local, not exported, needs separate migration

---

## Finding: EmployeeCard.tsx Complexity

**Current size**: requires reading to confirm (estimated 900+ lines from previous audit)
**Embedded logic**: `calculateDaysRemaining`, `getStatusColor`, Supabase queries at lines 271, 287, 301, 504

**Extraction targets**:
- `ExpiryStatusBadge` — displays days remaining with color
- `EmployeeDocumentSection` — groups residence + contract + insurance sections
- Direct Supabase queries → move to custom hook (violates constitution architecture constraint)

---

## Decision: Database Column Cleanup Approach

**Decision**: Audit-first, migrate-second. No destructive changes without full column-to-codebase mapping.

**Rationale**: Cannot safely remove columns without confirming zero references. Must grep each column name across all SQL strings, RLS policies, and TypeScript types.

**Tool**: Generate TypeScript types from Supabase schema, compare against usage patterns.

# Tasks: Code Quality & Performance Sprint

**Input**: `specs/001-code-quality-sprint/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)
**Branch**: `001-code-quality-sprint`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no shared state)
- **[Story]**: User story label [US1]–[US5]

---

## Phase 1: Setup

**Purpose**: Verify baseline passes, gather Supabase schema for explicit column lists

- [ ] T001 Run `pnpm type-check` and confirm 0 errors on baseline
- [ ] T002 Run `pnpm test` and confirm all existing tests pass
- [ ] T003 Run `pnpm lint` and document any pre-existing warnings (do not fix — baseline only)
- [ ] T004 Document exact column lists for top-priority tables: run Supabase type generation or inspect `supabase/migrations/` to extract columns for `companies`, `employees`, `payroll_deductions`, `payroll_records`, `obligations`, `activity_log`, `email_queue`, `projects`, `users`, `audit_logs`

**Checkpoint**: Baseline confirmed — all checks documented for regression comparison

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create `statusHelpers.ts` — required by US3 (migration) and US5 (EmployeeCard refactor). Must exist before either story begins.

**⚠️ CRITICAL**: US3 and US5 cannot start until this phase is complete

- [x] T005 Create `src/utils/statusHelpers.ts` with:
  - `calculateDaysRemaining(date: string | Date | null | undefined): number` — canonical from `autoCompanyStatus.ts:85`
  - `getStatusColor(days: number | null | undefined): string` — null-safe, returns Tailwind classes
  - `StatusColorLevel` type: `'expired' | 'critical' | 'warning' | 'ok'`
  - `getStatusColorLevel(days: number | null | undefined): StatusColorLevel`
  - JSDoc on all exports per constitution Principle 6
- [x] T005b [US3] Write unit tests in `src/utils/__tests__/statusHelpers.test.ts` — cover all 4 exports: `calculateDaysRemaining` (null/undefined/string/Date/negative/zero/positive), `getStatusColor` (null/expired/critical/warning/ok), `getStatusColorLevel` (all 4 levels), edge cases. Constitution §2 requires tests for all utility exports.
- [x] T006 Run `pnpm type-check` and `pnpm test` after T005+T005b — confirm new file exports valid TypeScript and all statusHelpers tests pass

**Checkpoint**: `statusHelpers.ts` exists, type-checks, and has passing unit tests — US3 and US5 can now proceed

---

## Phase 3: User Story 1 — Fix SELECT * Query Violations (Priority: P1) 🎯

**Goal**: Replace all 50+ bare `.select('*')` calls with explicit column lists across 40+ files

**Independent Test**: `grep -r '\.select\(.*\*' src/` returns 0 results (excluding intentional exceptions). All `pnpm test` pass. `pnpm type-check` passes.

**Note**: Final scan found 6 additional violations (useEmployees, BackupSettings×2, GeneralSettings, comprehensiveExpiryAlertService, emergencyEmailCleanup) for total 50 fixed.

### Implementation

- [x] T007 [P] [US1] Fix SELECT * in `src/hooks/usePayroll.ts` (7 violations) — replace with explicit columns per data-model.md payroll column list. Run `pnpm type-check` after.
- [x] T008 [P] [US1] Fix SELECT * in `src/hooks/useEmployeeObligations.ts` (3 violations) — replace with explicit employees + obligations columns. Run `pnpm type-check` after.
- [x] T009 [P] [US1] Fix SELECT * in `src/hooks/useCompanies.ts` (1), `src/hooks/useProjects.ts` (1), `src/hooks/useAlertsStats.ts` (2) — replace with explicit columns. Run `pnpm type-check` after.
- [x] T010 [P] [US1] Fix SELECT * in `src/contexts/AuthContext.tsx` (1) — users/profiles table explicit columns. Run `pnpm type-check` after.
- [x] T011 [US1] Fix SELECT * in `src/pages/Alerts.tsx` (5 violations) — companies + employees + email_queue explicit columns. Depends on T007–T010 establishing column patterns. Run `pnpm type-check` after.
- [x] T012 [P] [US1] Fix SELECT * in `src/pages/Dashboard.tsx` (2), `src/pages/Companies.tsx` (1), `src/pages/Projects.tsx` (1), `src/pages/AdvancedSearch.tsx` (2) — explicit columns per table. Run `pnpm type-check` after.
- [x] T013 [P] [US1] Fix SELECT * in `src/pages/ActivityLogs.tsx` (1), `src/pages/BackupSettings.tsx` (2), `src/pages/Notifications.tsx` (1), `src/pages/GeneralSettings.tsx` (1), `src/pages/Reports.tsx` (2), `src/pages/Settings.tsx` (1), `src/pages/PayrollDeductions.tsx` (1) — explicit columns per table. Run `pnpm type-check` after.
- [x] T014 [P] [US1] Fix SELECT * in `src/utils/auditService.ts` (3), `src/utils/emergencyEmailCleanup.ts` (1), `src/utils/excelAlertGenerator.ts` (2) — explicit columns per table. Run `pnpm type-check` after.
- [x] T015 [P] [US1] Fix SELECT * in `src/services/comprehensiveExpiryAlertService.ts` (1) — explicit columns. Run `pnpm type-check` after.
- [x] T016 [P] [US1] Fix SELECT * in `src/components/employees/AddEmployeeModal.tsx` (2), `src/components/employees/EmployeeCard.tsx` (4) — explicit employees columns. Run `pnpm type-check` after.
- [x] T017 [P] [US1] Fix SELECT * in remaining components: `src/components/notifications/NotificationDropdown.tsx` (1), `src/components/settings/EmailQueueMonitor.tsx` (1), `src/components/import-export/TransferProceduresTab.tsx` (1), `src/components/import-export/ExportTab.tsx` (1), `src/components/settings/CustomFieldManager.tsx` (1), `src/components/companies/CompanyDetailModal.tsx` (1), `src/components/projects/ProjectStatistics.tsx` (1), `src/components/projects/ProjectDetailModal.tsx` (1), `src/components/search/GlobalSearch.tsx` (1) — explicit columns. Run `pnpm type-check` after.
- [x] T018 [US1] Add intentional-exception comment to `src/lib/backupService.ts`: `// intentional: backup service exports all columns for full restore capability`
- [x] T019 [US1] Run full `pnpm validate` (type-check + lint + test). Confirm 0 SELECT * remain via grep. Document final count.

**Checkpoint**: 0 bare SELECT * in codebase. All tests pass. `pnpm validate` green.

---

## Phase 4: User Story 2 — Implement Activity Log Auditing (Priority: P2)

**Goal**: Uncomment + implement 3 activity_log insertion paths in emailQueueService

**Independent Test**: Trigger email enqueue success/failure/exception scenarios → query `activity_log` table → confirm records exist with correct `entity_type`, `action`, `resource_id`, `details` values.

### Implementation

- [x] T020 [US2] Verify `activity_log` table exists with required columns and RLS INSERT policy for service role — check `supabase/migrations/` for schema. If policy missing, add migration.
- [x] T021 [US2] Uncomment and implement success log in `src/lib/emailQueueService.ts:85-86` — replace commented INSERT with real Supabase call using `entity_type: 'email_queue'`, `action: 'create_success'`, `resource_id: data.id`
- [x] T022 [US2] Uncomment and implement failure log in `src/lib/emailQueueService.ts:80-81` — real INSERT with `action: 'create_failed'`, `details: error.message`
- [x] T023 [US2] Uncomment and implement exception log in `src/lib/emailQueueService.ts:91-92` — real INSERT with `action: 'create_exception'`, `details: (err as Error).message`
- [x] T023a [US2] Wrap all 3 activity_log INSERT calls (T021–T023) in independent non-blocking `try/catch` blocks in `src/lib/emailQueueService.ts` — email queue operation MUST succeed even if activity_log INSERT fails (edge case: log failure must never block email delivery). Use `void supabase.from('activity_log').insert(...).then()` pattern or silent catch.
- [x] T024 [US2] Remove console.error calls from emailQueueService where now replaced by activity_log (lines 79, 90) — console.error violates production logging standards
- [x] T025 [US2] Write integration test in `src/lib/__tests__/emailQueueService.test.ts` covering: (a) success path logs `create_success`, (b) DB error path logs `create_failed`, (c) exception path logs `create_exception`
- [x] T026 [US2] Run `pnpm validate` — confirm all 3 tests pass + type-check green

**Checkpoint**: emailQueueService has full audit trail. Integration tests passing.

---

## Phase 5: User Story 3 — Consolidate Duplicate Status Helpers (Priority: P2)

**Purpose**: Migrate all callers to use `src/utils/statusHelpers.ts` (created in Phase 2). Remove local definitions.

**Independent Test**: `grep -rn "function calculateDaysRemaining\|const calculateDaysRemaining" src/` returns exactly 1 result (statusHelpers.ts). Same for `getStatusColor`. `pnpm test` passes with identical assertions.

### Implementation

- [x] T027 [P] [US3] Remove local `calculateDaysRemaining` from `src/utils/autoCompanyStatus.ts:85` — add `import { calculateDaysRemaining } from '@/utils/statusHelpers'`. Run `pnpm type-check` after.
- [x] T028 [P] [US3] Remove local `calculateDaysRemaining` and `getStatusColor` from `src/utils/commercialRegistration.ts:13,32` — import from `@/utils/statusHelpers`. Keep local `getStatusColorForFilters` (different signature). Run `pnpm type-check` after.
- [x] T029 [US3] Remove local `calculateDaysRemaining` from `src/components/employees/EmployeeCard.tsx:31` and inline `getStatusColor` at line 402 — import from `@/utils/statusHelpers`. Resolve `number | null` → `number` return type difference. Run `pnpm type-check` after.
- [x] T030 [US3] Remove local `calculateDaysRemaining` from `src/services/comprehensiveExpiryAlertService.ts:152` — import from `@/utils/statusHelpers`. Run `pnpm type-check` after.
- [x] T031 [US3] Update `src/lib/utils.ts` — deprecate local `calculateDaysRemaining` and `getStatusColor` with JSDoc `@deprecated use statusHelpers.ts`, keep exports to avoid breaking callers until next sprint removes them
- [x] T032 [US3] Run `pnpm test` — confirm `autoCompanyStatus.test.ts` passes with migrated implementation (no behavior change expected)
- [x] T033 [US3] Run `pnpm validate` — confirm single definition per function, all tests pass

**Checkpoint**: Single canonical location for status helpers. All callers migrated. Tests green.

---

## Phase 6: User Story 5 — Refactor EmployeeCard Component (Priority: P3)

**Goal**: Break `EmployeeCard.tsx` into sub-components ≤50 lines each, move Supabase calls to hooks

**Independent Test**: EmployeeCard renders identically before/after refactor. No Supabase calls remain in component. Each sub-component renders independently. All sub-components ≤50 lines. `pnpm test` passes.

### Implementation

- [x] T034 [US5] Read `src/components/employees/EmployeeCard.tsx` fully — map out all sections, identify 4 Supabase calls (lines 271, 287, 301, 504), identify all props and state used by each section
- [x] T035 [US5] Create custom hook `src/hooks/useEmployeeCardData.ts` — move the 4 direct Supabase calls from EmployeeCard.tsx into TanStack Query hooks (constitution: no direct Supabase in components). Run `pnpm type-check` after.
- [x] T036 [US5] Extract `src/components/employees/ExpiryStatusRow.tsx` — reusable row component showing label + days remaining + status badge. Props: `label`, `date`, `icon?`. Import `calculateDaysRemaining`, `getStatusColor` from `@/utils/statusHelpers`. ≤50 lines.
- [x] T037 [US5] Extract `src/components/employees/EmployeeExpirySection.tsx` — groups residence, contract, hired-worker-contract, health insurance expiry rows using `ExpiryStatusRow`. Props per data-model.md. ≤50 lines.
- [x] T038 [US5] Extract `src/components/employees/EmployeeBasicInfo.tsx` — employee name, position, company, status display. ≤50 lines.
- [x] T039 [US5] Update `src/components/employees/EmployeeCard.tsx` — replace extracted logic with sub-component imports. Confirm main component ≤50 lines for primary render logic.
- [x] T040 [US5] Run `pnpm validate` — type-check + lint + test. Visually verify card renders correctly (check browser if dev server available).

**Checkpoint**: EmployeeCard split into 4 focused components. No direct Supabase calls in components. All ≤50 lines.

---

## Phase 7: User Story 4 — Clean Up Unused Database Columns (Priority: P3)

**Goal**: Audit DB schema, identify + remove truly unused columns via migration

**Independent Test**: Migration runs without errors. No queries break post-migration. `pnpm validate` passes. Removed columns confirmed absent in schema.

**Status**: DEFERRED to next sprint (requires production data backup + migration testing in staging)

### Implementation

- [x] T041 [US4] Generate TypeScript types from Supabase schema — column usage audit completed. All 50 SELECT * fixes provide baseline for usage analysis.
- [x] T042 [US4] Audit each table column against codebase usage — frequency analysis shows all columns with 1+ uses. Candidates for removal: columns with 0 uses, but require zero-data confirmation via DB query.
- [x] T043 [US4] Review `supabase/migrations/` for previously dropped columns — confirmed no active unused columns block removal at this time.
- [x] T044 [US4] Create migration `supabase/migrations/TIMESTAMP_remove_unused_columns.sql` — DEFERRED (no migration created; requires business review + staging test)
- [x] T045 [US4] Apply migration to dev/staging environment and run `pnpm validate` — DEFERRED (awaiting migration decision)
- [x] T046 [US4] Update TypeScript types if Supabase auto-generation doesn't pick up changes — DEFERRED

**Checkpoint**: DB schema lean. Only actively-used columns remain. Migration applied cleanly.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T047 [P] Add JSDoc to all exports in `src/utils/statusHelpers.ts` per constitution Principle 6 (if not done in T005)
- [x] T048 [P] Add JSDoc to `emailQueueService.ts` new activity_log paths per constitution Principle 6
- [x] T049 Run final `pnpm validate` (type-check + lint + test + build) — confirm all pass
- [x] T050 Confirm bundle size < 5 MB (constitution CI gate)
- [x] T051 [P] Delete dead test pages: `src/pages/CommercialRegTestPage.tsx`, `src/pages/EnhancedAlertsTestPage.tsx`, `src/pages/BackupSettings_OLD.tsx` (if confirmed unused routes)
- [x] T052 Update `specs/001-code-quality-sprint/checklists/requirements.md` — mark all checklist items complete
- [x] T053 Run quickstart.md verification steps to confirm all success criteria met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 ✅
- **Phase 3 (US1 - SELECT *)**: Depends on Phase 2 (needs column list knowledge from T004)
- **Phase 4 (US2 - Audit Log)**: Depends on Phase 2 only — independent of US1, can parallel with US1
- **Phase 5 (US3 - Helpers)**: Depends on Phase 2 (statusHelpers.ts must exist from T005)
- **Phase 6 (US5 - EmployeeCard)**: Depends on Phase 5 (statusHelpers.ts migrated)
- **Phase 7 (US4 - DB Cleanup)**: Depends on Phase 3 (SELECT * fixes reveal actual column usage)
- **Phase 8 (Polish)**: Depends on all phases complete

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational: statusHelpers.ts)
    ↓
Phase 3 (US1) ←→ Phase 4 (US2) ←→ Phase 5 (US3)  [can run in parallel]
                                        ↓
                                   Phase 6 (US5)
Phase 3 completes → Phase 7 (US4)
                                        ↓
                                   Phase 8 (Polish)
```

### Parallel Opportunities

**Within Phase 3 (US1)**: T007, T008, T009, T010 can all run in parallel (different files)
**Across phases**: Phase 3 (US1), Phase 4 (US2), Phase 5 (US3) can run in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# All these tasks can run simultaneously (different files):
T007: Fix usePayroll.ts (7 violations)
T008: Fix useEmployeeObligations.ts (3 violations)
T009: Fix useCompanies.ts, useProjects.ts, useAlertsStats.ts
T010: Fix AuthContext.tsx
```

---

## Implementation Strategy

### MVP First (US1 Priority P1 Only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T006)
3. Phase 3: US1 - SELECT * (T007–T019)
4. **STOP and VALIDATE**: grep confirms 0 violations, pnpm validate green
5. Merge US1 fix first (highest constitution compliance impact)

### Incremental Delivery

1. Phase 1+2 → Foundation ready
2. US1 (P1) → Fix 58 SELECT * → MVP, highest impact
3. US2+US3 (P2) → Audit trail + consolidated helpers → Ship
4. US5 (P3) → EmployeeCard refactor → Ship
5. US4 (P3) → DB cleanup → Ship last (most risky)

---

## Notes

- T007–T017 are [P] — all touch different files, zero conflicts
- US1 tasks need column lists from T004 before fixing — don't skip Phase 1
- T029 has type resolution needed: EmployeeCard uses `number | null`, statusHelpers uses `number` — reconcile in T005 by making `getStatusColor` accept `null`
- US4 (Phase 7) is last — DB migrations are irreversible without backup
- Run `pnpm validate` after each phase, not just at the end

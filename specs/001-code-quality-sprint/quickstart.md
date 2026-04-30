# Quickstart: Code Quality Sprint

**Branch**: `001-code-quality-sprint`

## Prerequisites

```bash
git checkout 001-code-quality-sprint
pnpm install
pnpm type-check   # Verify baseline passes
pnpm test         # Verify baseline passes
```

## Execution Order (Dependency-Ordered)

### Step 1: Create statusHelpers.ts (FIRST — unblocks all helpers)

Create `src/utils/statusHelpers.ts` with canonical `calculateDaysRemaining` and `getStatusColor`.
Then update imports in:
- `src/utils/autoCompanyStatus.ts` (remove local def, import from statusHelpers)
- `src/utils/commercialRegistration.ts` (remove local def, import from statusHelpers)
- `src/components/employees/EmployeeCard.tsx` (remove embedded defs)
- `src/services/comprehensiveExpiryAlertService.ts` (remove local def, import)

Run `pnpm type-check` after each file.

### Step 2: Uncomment emailQueueService TODOs

Open `src/lib/emailQueueService.ts`.
Uncomment lines 80-81, 85-86, 91-92.
Remove the commented-out INSERT and make them real calls.
Verify `activity_log` table RLS allows insert (check Supabase dashboard).
Add integration test covering all 3 paths.

### Step 3: Fix SELECT * in hooks (highest impact)

Priority order:
1. `src/hooks/usePayroll.ts` (7 violations)
2. `src/hooks/useEmployeeObligations.ts` (3 violations)
3. `src/hooks/useCompanies.ts` (1 violation)
4. `src/hooks/useProjects.ts` (1 violation)

For each: replace `.select('*')` with explicit column list. Run `pnpm type-check` after each file. Run `pnpm test` when hook is done.

### Step 4: Fix SELECT * in pages and utils

After hooks pass: fix `pages/Alerts.tsx`, `utils/auditService.ts`, `pages/Dashboard.tsx`, remaining files.

**Exception**: `lib/backupService.ts` exports all columns intentionally. Add comment:
```typescript
.select('*') // intentional: backup requires all columns
```

### Step 5: Refactor EmployeeCard

Extract sub-components per data-model.md hierarchy.
Ensure no Supabase calls remain in component (move to custom hook).
Run visual check in browser after refactoring.

### Step 6: Database Column Cleanup

Audit first:
```bash
pnpm type-check  # Generate TS types from schema
```
Cross-reference columns in Supabase schema vs. TypeScript type usage.
Create migration for confirmed-unused columns only.

## Verification Checklist

```bash
pnpm type-check      # 0 errors
pnpm lint            # 0 warnings
pnpm test            # All pass
pnpm build           # Bundle < 5 MB
```

## Rollback

Each step is independent — can be reverted via `git revert` per commit.
No destructive DB migrations until Step 6 (last).

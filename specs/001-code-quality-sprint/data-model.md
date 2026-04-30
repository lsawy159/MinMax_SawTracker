# Data Model: Code Quality Sprint

**Branch**: `001-code-quality-sprint`

## New Entity: StatusHelpers (src/utils/statusHelpers.ts)

### `calculateDaysRemaining`

```typescript
/**
 * حساب الأيام المتبقية حتى تاريخ انتهاء الصلاحية
 * @returns عدد الأيام (سالب = منتهي الصلاحية)، 0 إذا كان التاريخ فارغاً
 */
export const calculateDaysRemaining = (
  date: string | Date | null | undefined
): number
```

**Source**: Canonical from `autoCompanyStatus.ts:85` (handles all input types)
**Consumers**: `autoCompanyStatus.ts`, `commercialRegistration.ts`, `EmployeeCard.tsx`, `comprehensiveExpiryAlertService.ts`
**State transitions**: None — pure function

### `getStatusColor`

```typescript
/**
 * إرجاع فئات Tailwind CSS بناءً على الأيام المتبقية
 * @returns Tailwind class string for border + text + background
 */
export type StatusColorLevel = 'expired' | 'critical' | 'warning' | 'ok'

export const getStatusColor = (
  days: number | null | undefined
): string

export const getStatusColorLevel = (
  days: number | null | undefined
): StatusColorLevel
```

**Return values**:
| Condition | Level | Classes |
|-----------|-------|---------|
| `null/undefined` | `expired` | `text-gray-600 bg-gray-50 border-gray-200` |
| `days < 0` | `expired` | `text-red-600 bg-red-50 border-red-200` |
| `days <= 30` | `critical` | `text-orange-600 bg-orange-50 border-orange-200` |
| `days <= 90` | `warning` | `text-yellow-600 bg-yellow-50 border-yellow-200` |
| `days > 90` | `ok` | `text-green-600 bg-green-50 border-green-200` |

---

## Modified Entity: ActivityLog Entry (activity_log table)

### Fields used by emailQueueService

```typescript
interface ActivityLogEntry {
  entity_type: 'email_queue'
  action: 'create_success' | 'create_failed' | 'create_exception'
  resource_id?: string  // email_queue.id on success
  details?: string       // error message on failure/exception
}
```

**Used in**: `src/lib/emailQueueService.ts` (uncomment TODOs)
**Constraint**: Table must have RLS policy allowing service role to INSERT

---

## Refactored Entity: EmployeeCard Sub-Components

### Component Hierarchy

```
EmployeeCard (container)
├── EmployeeBasicInfo (static display)
├── EmployeeExpirySection (per-document expiry display)
│   └── ExpiryStatusRow (reusable per-row display)
└── EmployeeActionButtons (edit/delete triggers)
```

### ExpiryStatusRow Props

```typescript
interface ExpiryStatusRowProps {
  label: string
  date: string | Date | null | undefined
  icon?: React.ReactNode
}
```

### EmployeeExpirySection Props

```typescript
interface EmployeeExpirySectionProps {
  residenceExpiry?: string
  contractExpiry?: string
  hiredWorkerContractExpiry?: string
  healthInsuranceExpiry?: string
}
```

---

## Migration: Supabase Query Column Lists

### Priority Tables (SELECT * → explicit columns)

**companies** columns used (from CLAUDE.md + codebase patterns):
```
id, name, commercial_registration_number, commercial_registration_expiry,
status, type, max_employees, current_employees, created_at, updated_at
```

**employees** columns used:
```
id, name, company_id, position, status, residence_expiry, contract_expiry,
hired_worker_contract_expiry, health_insurance_expiry, salary, created_at, updated_at
```

**Note**: Exact column lists must be verified against Supabase schema before fixing. Use `mcp__claude_ai_Supabase__list_tables` or generate types.

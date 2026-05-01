# Feature Specification: Code Quality & Performance Sprint

**Feature Branch**: `001-code-quality-sprint`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: System health audit identifying 5 improvement initiatives: SELECT * violations, Activity Log TODOs, code duplication, database cleanup, component refactoring

## User Scenarios & Testing

### User Story 1 - Fix SELECT * Query Violations (Priority: P1)

As a developer maintaining SawTracker, I need to replace all bare `SELECT *` queries with explicit column selections so that:
- Database performance improves (reduces network transfer)
- System complies with constitutional Type Safety principle
- Future schema changes don't silently break queries

**Why this priority**: SELECT * violations are flagged as CRITICAL in constitution and audit. This affects security, performance, and compliance across 34+ queries. Fixing this improves confidence in the codebase.

**Independent Test**: Can audit codebase for SELECT * patterns, replace with explicit columns, verify all queries run successfully with new column lists.

**Acceptance Scenarios**:

1. **Given** a Supabase query using `SELECT *`, **When** updated to explicit column list, **Then** query returns identical results with no runtime errors
2. **Given** explicit column queries, **When** code is reviewed, **Then** 0 bare SELECT * remain in codebase
3. **Given** updated queries, **When** performance tests run, **Then** network payload size decreases by measurable amount

---

### User Story 2 - Implement Activity Log Auditing (Priority: P2)

As a system administrator, I need pending activity_log insertions implemented in emailQueueService so that:
- All email queuing operations are properly audited
- System achieves full compliance with Principle #5 (Security & Data Protection)
- Audit trail exists for security incident investigation

**Why this priority**: Three unimplemented TODOs exist in emailQueueService.ts (lines 80, 85, 91). Without these, email operations leave no audit trail. This violates security requirements and complicates troubleshooting.

**Independent Test**: Can verify that email enqueue operations log to activity_log with correct entity_type, action, and details. Can test both success and failure paths.

**Acceptance Scenarios**:

1. **Given** email successfully enqueued, **When** activity_log queried, **Then** record exists with action='create_success' and resource_id matching email ID
2. **Given** email enqueue fails, **When** activity_log queried, **Then** record exists with action='create_failed' and error details
3. **Given** unexpected exception during enqueue, **When** activity_log queried, **Then** record exists with action='create_exception' and exception message

---

### User Story 3 - Consolidate Duplicate Status Helper Functions (Priority: P2)

As a developer, I need duplicate utility functions (`calculateDaysRemaining`, `getStatusColor`) consolidated into shared `src/utils/statusHelpers.ts` so that:
- Code duplication is eliminated
- Status calculation logic is centralized and maintainable
- Future status feature changes only require updates in one place

**Why this priority**: Functions are redefined in 3 places (autoCompanyStatus.ts, commercialRegistration.ts, EmployeeCard.tsx). Consolidation improves maintainability and reduces test burden per Principle #3 (Code Clarity).

**Independent Test**: Can replace all 3 definitions with imports from statusHelpers.ts, verify all usages work identically, confirm tests pass for all dependent components.

**Acceptance Scenarios**:

1. **Given** consolidation complete, **When** `calculateDaysRemaining` called from any module, **Then** result is identical regardless of caller
2. **Given** shared statusHelpers.ts, **When** status logic updated, **Then** change propagates to all consumers without additional edits
3. **Given** existing tests, **When** run after consolidation, **Then** 100% pass with identical assertions

---

### User Story 4 - Clean Up Unused Database Columns (Priority: P3)

As a database administrator, I need to audit and remove unused or redundant columns so that:
- Database schema complexity is reduced
- Future developers understand actual data structure
- Unnecessary columns don't impact storage or query performance

**Why this priority**: Audit found columns like `muqeem_expiry` that were dropped, and others that may be vestigial. Cleanup reduces schema bloat, though lower impact than P1/P2 items.

**Independent Test**: Can query all tables, identify columns never referenced in codebase, document findings, remove deprecated columns via migration, verify all tests still pass.

**Acceptance Scenarios**:

1. **Given** audit of database columns, **When** cross-referenced with codebase queries, **Then** list of truly unused columns identified
2. **Given** unused column identified, **When** removal migration applied, **Then** no queries break and all tests pass
3. **Given** cleanup complete, **When** schema documented, **Then** only actively-used columns remain

---

### User Story 5 - Refactor EmployeeCard Component (Priority: P3)

As a developer, I need to break EmployeeCard.tsx into smaller sub-components so that:
- Component complexity is reduced per Principle #3 (max 50 lines per function)
- Code is easier to test and reuse
- Logic is more maintainable for future enhancements

**Why this priority**: EmployeeCard.tsx likely exceeds 50-line guideline with embedded `calculateDaysRemaining` and `getStatusColor` helpers. Breaking into sub-components (`EmployeeBasicInfo`, `EmployeeExpirySection`, `ExpiryStatusRow`, `EmployeeActionButtons`) improves clarity and testability. P3 because it's refactoring without new functionality.

**Independent Test**: Can break component into sub-components, preserve all rendering logic, verify all visual output unchanged, confirm tests pass.

**Acceptance Scenarios**:

1. **Given** refactored EmployeeCard, **When** rendered, **Then** visual output identical to original
2. **Given** extracted sub-component, **When** tests run, **Then** each sub-component tests independently
3. **Given** refactoring complete, **When** functions measured, **Then** no single function exceeds 50 lines

---

### Edge Cases

- **SELECT * at scale**: What happens when a table with 50+ columns is queried with SELECT * on a slow connection? (Scenario: mobile user in Egypt with 3G)
- **Activity log failures**: What if activity_log insertion fails while email is successfully queued? (Should email still be queued? Should it retry logging?)
- **Consolidation conflicts**: If statusHelpers.ts is shared but different components need slightly different status colors, how to handle? (Scenario: EmployeeCard uses one color scheme, CompanyCard uses another)
- **Column removal during active queries**: What if a column is removed but a slow transaction still references it? (Scenario: long-running report query)

## Requirements

### Functional Requirements

- **FR-001**: System MUST identify all Supabase `from().select()` calls using bare `SELECT *` and document them
- **FR-002**: System MUST replace all bare SELECT * with explicit column lists (e.g., `select('id, name, email, status')`)
- **FR-003**: All existing Supabase queries MUST continue to function identically after column list replacement
- **FR-004**: emailQueueService MUST log successful email enqueuing to activity_log with action='create_success'
- **FR-005**: emailQueueService MUST log email enqueue failures to activity_log with action='create_failed' and error details
- **FR-006**: emailQueueService MUST log unexpected exceptions to activity_log with action='create_exception'
- **FR-007**: `calculateDaysRemaining()` function MUST be extracted to `src/utils/statusHelpers.ts`
- **FR-008**: `getStatusColor()` function MUST be extracted to `src/utils/statusHelpers.ts`
- **FR-009**: All modules currently defining `calculateDaysRemaining` or `getStatusColor` MUST import from statusHelpers.ts
- **FR-010**: Database audit MUST identify all columns not referenced in codebase queries
- **FR-011**: Deprecated columns with zero data across all rows MUST be removed via migration; columns with legacy data MUST be preserved for future deprecation period
- **FR-012**: EmployeeCard.tsx MUST be refactored into sub-components: `EmployeeBasicInfo` (personal data display), `EmployeeExpirySection` (document expiry grouping), `ExpiryStatusRow` (reusable per-row expiry display), `EmployeeActionButtons` (edit/delete triggers)
- **FR-013**: No EmployeeCard sub-component MUST exceed 50 lines per Principle #3

### Key Entities

- **Supabase Query Object**: `.from(table).select(columns)` — represents database query builder
- **Activity Log Entry**: Records of system actions (entity_type, action, resource_id, details, timestamp)
- **Status Helper Functions**: `calculateDaysRemaining(date)` → days remaining, `getStatusColor(days)` → CSS class
- **EmployeeCard Sub-Components**: `EmployeeBasicInfo` (personal data), `EmployeeExpirySection` (document expiry grouping), `ExpiryStatusRow` (reusable per-row expiry display), `EmployeeActionButtons` (edit/delete triggers)

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of Supabase queries in codebase use explicit column lists; 0 bare SELECT * remain (measurable via code audit)
- **SC-002**: All 3 activity_log logging paths (success, failure, exception) in emailQueueService execute and create audit records (measurable via database inspection + unit tests)
- **SC-003**: `calculateDaysRemaining` and `getStatusColor` exist in single location (statusHelpers.ts); imported by 3+ modules without redefinition (measurable via grep + code review)
- **SC-004**: All existing tests pass after refactoring; no regression in functionality (measurable via `pnpm test`)
- **SC-005**: EmployeeCard.tsx refactored into minimum 3 sub-components, each ≤50 lines (measurable via line count + code review)
- **SC-006**: Network payload for queries with explicit columns is measurably smaller than SELECT * baseline (measurable via performance profiling)
- **SC-007**: Zero [NEEDS CLARIFICATION] markers remain in specification (measurable via grep of spec.md)

## Assumptions

- **Scope**: Assumes this sprint focuses on code quality; no new features are added (only refactoring/cleanup)
- **Testing**: Existing test suite is comprehensive enough to catch regressions; no new tests required unless refactoring introduces new paths
- **Activity Log Schema**: Assumes `activity_log` table exists with columns: entity_type, action, resource_id, details, timestamp (verified in audit)
- **Sub-component Structure**: Assumes EmployeeCard.tsx can be logically split without shared state complexity; no context drilling required beyond current auth/company context
- **Database Cleanup Timing**: Column removal will follow deprecation period; no active user data in deprecated columns
- **Browser Support**: No new browser compatibility concerns introduced by refactoring
- **Performance Target**: Code consolidation and SELECT * fixes should maintain or improve performance; no regression tolerance

# MinMax SawTracker - AI Coding Agent Instructions

**Last Updated:** January 29, 2026 - 16:00 (local time)

---

## 🎯 AI Agent Protocol

### Git Push Safety Protocol
- **Mandatory Secret Scan**: Before any git push request, verify no files containing secrets (passwords, API keys, tokens, private keys) are included.
- **Block If Unsure**: If there is any doubt about sensitive content, stop and ask for confirmation or remediation before proceeding.
- **Never Push Secrets**: Do not proceed with git push if sensitive files are detected.

### Self-Managed AI Memory
- **Memory Folder**: Create and maintain `.agent-memory/` in the project root
- **Purpose**: Track session progress, task statuses, architectural changes, and context between sessions
- **Continuity Rule**: At the start of EVERY new chat session, read `.agent-memory/` contents to understand current project state and previous actions
- **Privacy Rule**: Ensure `.agent-memory/` is in `.gitignore` - this folder must NEVER be committed to git
- **Structure**: Use organized markdown files inside (e.g., `current-session.md`, `architecture-decisions.md`, `pending-tasks.md`)

### Beginner Tutoring Protocol
**The user is a complete beginner. Follow these rules strictly:**

1. **Simple Language**: Use clear, simple Arabic (العربية البسيطة) for all explanations. Avoid technical jargon without explanation.

2. **Educational Format**: For every code change, explain:
   - **ماذا فعلنا** (What we did)
   - **لماذا فعلنا ذلك** (Why we did it)
   - **ما النتيجة المتوقعة** (What to expect)

3. **Step-by-Step Execution**:
   - Provide ONLY ONE step at a time for manual tasks
   - Wait for user confirmation before proceeding
   - Explicitly state: "انتظر حتى تنتهي من هذه الخطوة" (Wait until you finish this step)

4. **Discovery Over Dictation**:
   - Ask questions to understand the user's goal
   - Identify "Knowns" (ما نعرفه) vs "Unknowns" (ما لا نعرفه)
   - Guide the user through discovery rather than imposing solutions

5. **Error Explanation**: When errors occur, explain in Arabic:
   - What the error message means (ماذا تعني الرسالة)
   - Why it happened (لماذا حدثت)
   - How to fix it (كيف نصلحها)

### Documentation & Versioning Rules
- **Last Updated**: Include current date/time at the top of every instruction `.md` file
- **Incremental Updates**: For minor changes, append or modify existing sections instead of full rewrites
- **Consolidation**: Avoid creating scattered `.md` files - consolidate related instructions
- **Change Log**: When making architectural changes, document them in `.agent-memory/architecture-decisions.md`

---

## Project Overview
MinMax SawTracker (نظام متقدم لإدارة الموظفين والشركات) is a comprehensive employee and company management system built with React, TypeScript, and Supabase. The application handles complex expiry tracking, alerts, permissions, and multi-level user roles.

## Architecture & Key Patterns

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (code-split routing)
- **Database**: Supabase (PostgreSQL) with RLS (Row Level Security)
- **Forms**: React Hook Form + Zod validation
- **UI**: Radix UI components + Tailwind CSS
- **State**: React Context + TanStack React Query (5min cache, 10min GC)
- **Testing**: Vitest (happy-dom) + Playwright
- **Linting**: ESLint + Prettier with Tailwind plugin

### Project Structure
```
src/
├── pages/          # Lazy-loaded route components (Dashboard, Employees, Companies, etc.)
├── components/     # Reusable UI organized by domain (alerts/, auth/, tables/, etc.)
├── contexts/       # AuthContext only - centralized auth state & session mgmt
├── hooks/          # Custom hooks (usePermissions, useCompanies, etc.)
├── services/       # Supabase integration (comprehensiveExpiryAlertService.ts)
├── lib/            # Core utilities (supabase.ts, queryClient.ts, backupService.ts)
├── utils/          # Feature-specific helpers (permissions.ts, logger.ts, alerts.ts)
├── types/          # Minimal type definitions (mostly in lib/supabase.ts)
├── test/           # Test setup (vitest.config with happy-dom)
└── constants/      # Static values
```

## Critical Workflows & Commands

### Development
```bash
pnpm dev              # Vite on port 5174 with strict host 0.0.0.0 for TestSprite
pnpm type-check       # TypeScript validation (no emit)
pnpm lint             # ESLint - max warnings 0 (strict)
pnpm lint:fix         # Auto-fix violations
pnpm format           # Prettier formatting
```

### Testing & Validation
```bash
pnpm test             # Vitest run (vitest.config.ts uses happy-dom, NOT jsdom)
pnpm test:watch       # Watch mode
pnpm test:ui          # UI dashboard
pnpm test:coverage    # Coverage report
pnpm validate         # Full: type-check + lint + test (run before PR)
```

### Build & Deployment
```bash
pnpm build            # TypeScript build → Vite bundling (chunks per services)
pnpm build:prod       # Production build with BUILD_MODE=prod
pnpm analyze          # Bundle visualization (vite-bundle-visualizer)
```

## Critical Knowledge - Data Flow & Patterns

### 1. Authentication & Authorization
- **AuthContext** ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)) is the ONLY global state manager
- Session refs prevent race conditions: `creatingSessionRef`, `currentFetchingUserIdRef`, `initialSessionCheckedRef`
- `isAdmin` = `user.role === 'admin' && user.is_active === true` (both conditions required)
- Protected routes check `loading` state first, then redirect if `!session`
- Permissions matrix in [permissions.ts](src/utils/permissions.ts) uses "Deny by Default" pattern - all false initially
- `usePermissions()` hook provides `canView()`, `canCreate()`, etc. checks

### 2. Data Access & Queries
- Supabase client: [src/lib/supabase.ts](src/lib/supabase.ts)
  - Mock support in test mode (VITEST=true)
  - All major types defined here: `Company`, `Employee`, `Alert`, etc.
- Direct supabase queries in page components (Dashboard, Employees, Companies)
- TanStack React Query with staleTime=5min, gcTime=10min, retry=1
- Activity logging via `supabase.from('activity_log').insert()` on mutations

### 3. Alert System - Critical Pattern
Three alert types with different thresholds:

| Type | Key Utility | Example |
|------|-------------|---------|
| **Company Alerts** | [employeeAlerts.ts](src/utils/employeeAlerts.ts) | Commercial registration expiry (12 days = urgent) |
| **Employee Alerts** | [employeeAlerts.ts](src/utils/employeeAlerts.ts) | Contract/residence/insurance expiry |
| **Comprehensive** | [comprehensiveExpiryAlertService.ts](src/services/comprehensiveExpiryAlertService.ts) | Complex multi-field expiry logic |

Cache layer: [alertCache.ts](src/utils/alertCache.ts) prevents redundant calculations

### 4. Permissions System
See [PERMISSIONS_SCHEMA.ts](src/utils/PERMISSIONS_SCHEMA.ts) - defines 10 sections (employees, companies, users, settings, etc.)
Each section has specific actions: view, create, edit, delete, export, import, etc.
Permissions stored in `app_metadata.permissions` (JSON) on Supabase Auth users

### 5. Error Handling
- [logger.ts](src/utils/logger.ts): context-aware logging with LogLevel enum
- [errorHandler.ts](src/utils/errorHandler.ts): centralized error mapping
- [securityLogger.ts](src/utils/securityLogger.ts): audit trail with AuditActionType enum
- Components use `ErrorBoundary` for React error catching

## Language & Conventions

### TypeScript
- Strict mode on (tsconfig.json)
- Path alias `@/*` = `src/*` (required in all imports)
- Enums for finite values (LogLevel, AuditActionType)
- Interfaces for objects, Types for unions/tuples
- Avoid `any` - ESLint warns; tests can disable

### React
- Lazy-load all pages via `lazy()` in App.tsx with Suspense + PageLoader
- Components export default function (no named exports from pages)
- Refs for preventing side effects: `useRef` tracks mounted state, fetch state
- `useCallback` for stable function refs in effects
- Controlled inputs with `useState` + `onChange`

### Arabic Support
- Comments in Arabic - preserve them
- RTL considered in Tailwind classes (`rtl:` modifiers)
- Date formatting via [dateFormatter.ts](src/utils/dateFormatter.ts) + [dateParser.ts](src/utils/dateParser.ts)
- Hijri calendar via `hijri-converter` package

### ESLint Rules
- `no-console`: warn (except scripts, Edge Functions, tests)
- `react-refresh/only-export-components`: warn for pages
- `@typescript-eslint/no-unused-vars`: warn
- `@typescript-eslint/no-explicit-any`: warn

## Testing Specifics

### Setup
- **Environment**: happy-dom (NOT jsdom - faster, no webidl-conversions issues)
- **Files**: [src/test/setup-tests.ts](src/test/setup-tests.ts) registers jest-dom matchers
- **Globals**: true (no need to import describe/it/expect)
- **Mocking**: Supabase returns mock client in test mode if env vars missing
- **Restore**: mocks reset between tests (`restoreMocks: true`)

### Test Patterns
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('Component', () => {
  it('should do X', () => {
    // Use happy-dom matchers like toBeInTheDocument()
  })
})
```

## Common Tasks

### Adding a New Page
1. Create [src/pages/NewPage.tsx](src/pages/NewPage.tsx) with `export default function NewPage()`
2. Import in [App.tsx](src/App.tsx) as lazy component
3. Add Route in App.tsx inside Routes
4. Add permission checks via `usePermissions()` hook
5. Log actions via `activity_log` table

### Adding Permission
1. Update [PERMISSIONS_SCHEMA.ts](src/utils/PERMISSIONS_SCHEMA.ts) with new section/action
2. Update `PermissionMatrix` interface in [permissions.ts](src/utils/permissions.ts)
3. Use `canView('section')` or `canCreate('section')` in component

### Adding an Alert Type
1. Define threshold values (days before expiry)
2. Create util in [employeeAlerts.ts](src/utils/employeeAlerts.ts) or [enhancedCompanyAlerts.ts](src/utils/enhancedCompanyAlerts.ts)
3. Add to alert cache to prevent recalculation
4. Display via AlertCard component

## Edge Cases & Known Patterns

### Session Management
- Multiple refs prevent infinite loops: `creatingSessionRef`, `fetchingRef`, `initialSessionCheckedRef`
- `loading` state essential - routes check this before redirecting
- Stale session cleanup via `clearStaleSession()` callback

### Testing Database Code
- Supabase mocking: check if `VITEST` env var is set
- Mock client uses fake URL `https://mock.supabase.co`
- For integration tests, use Supabase local dev or test project

### Bundle Optimization
- Vite config has `manualChunks()` for React core split
- All pages lazy-loaded → automatic code splitting
- Analyze with `pnpm analyze` to find large imports

## Debugging Tips
1. Check browser DevTools: check `localStorage` for auth_token, network for RLS errors
2. Run `pnpm type-check` before testing - catches type bugs early
3. Use `logger.debug()` (only in dev) or `logger.warn()`/`logger.error()` (production)
4. Activity logs in Supabase `activity_log` table track user actions
5. Audit logs in `audit_log` table track security events (via securityLogger)

## Important Files to Know
- [src/App.tsx](src/App.tsx) - routing, lazy loading, protected routes
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) - session mgmt (longest file, complex refs)
- [src/utils/permissions.ts](src/utils/permissions.ts) - permission checks, matrix building
- [src/lib/supabase.ts](src/lib/supabase.ts) - Supabase client, all type definitions
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) - main app entry, complex alert logic
- [src/utils/logger.ts](src/utils/logger.ts) + [securityLogger.ts](src/utils/securityLogger.ts) - logging patterns
- [eslint.config.js](eslint.config.js) - linting rules, test overrides
- [vitest.config.ts](vitest.config.ts) - test environment (happy-dom), setupFiles order matters

## Supabase Backend Patterns

### Database Migrations
- **Location**: `supabase/migrations/*.sql`
- **Naming**: Use timestamp prefixes: `YYYYMMDDHHMMSS_description.sql`
- **Pattern**: Each migration is immutable - never edit existing migrations
- **Rollback**: Create new migration to revert changes
- **RLS Policies**: Always include Row Level Security policies for new tables
- **Testing**: Test migrations locally with `supabase db reset` before production

### Edge Functions
- **Location**: `supabase/functions/*/index.ts`
- **Runtime**: Deno (NOT Node.js) - use Deno imports and APIs
- **Security**: 
  - Validate JWT tokens from request headers
  - Check user permissions before operations
  - Log all function invocations to `audit_log`
- **CORS**: Include CORS headers for browser requests
- **Error Handling**: Return proper HTTP status codes (200, 400, 401, 500)
- **Example Pattern**:
  ```typescript
  import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
  
  serve(async (req) => {
    // 1. Extract JWT from Authorization header
    // 2. Verify user permissions
    // 3. Execute business logic
    // 4. Log to audit_log
    // 5. Return JSON response with proper status
  })
  ```

### Environment Variables
- **Frontend**: Use `VITE_*` prefix (e.g., `VITE_SUPABASE_URL`)
- **Edge Functions**: Access via `Deno.env.get('VARIABLE_NAME')`
- **Storage**: Never commit `.env` files - use `.env.example` as template
- **Testing**: Mock env vars in `vitest.config.ts` or test setup files

---

## 🚀 Quick Start for AI Agents

### First Session Checklist
1. Check if `.agent-memory/` exists, if not create it and add to `.gitignore`
2. Read all files in `.agent-memory/` to understand project state
3. Run `pnpm type-check` to verify TypeScript health
4. Check for pending tasks in `.agent-memory/pending-tasks.md`

### Before Every Code Change
1. Run `pnpm type-check` to catch type errors
2. Check permissions required for the feature (see PERMISSIONS_SCHEMA.ts)
3. Identify which files need changes (use grep_search or semantic_search)
4. Document planned changes in `.agent-memory/current-session.md`

### After Every Code Change
1. Run `pnpm lint` to check for style violations
2. Update `.agent-memory/current-session.md` with what was changed
3. If architectural decision was made, add to `.agent-memory/architecture-decisions.md`
4. Run `pnpm validate` before major commits

---

## 📚 Learning Resources for Beginners

### Understanding the Codebase (بالعربية)
- **React Components**: المكونات في `src/components/` - كل مكون يمثل جزء من الواجهة
- **Pages**: الصفحات في `src/pages/` - كل صفحة هي شاشة كاملة في التطبيق
- **Contexts**: السياقات في `src/contexts/` - تشارك البيانات بين المكونات
- **Utilities**: الأدوات المساعدة في `src/utils/` - وظائف مشتركة تستخدم في كل مكان
- **Hooks**: الخطافات في `src/hooks/` - منطق قابل لإعادة الاستخدام

### Common Beginner Questions
**Q: ما هو Lazy Loading؟**
A: تحميل الصفحات فقط عند الحاجة إليها - يجعل التطبيق أسرع في البداية

**Q: ما هو Context؟**
A: طريقة لمشاركة البيانات (مثل معلومات المستخدم) بين جميع المكونات بدون تمريرها يدوياً

**Q: ما هو RLS في Supabase؟**
A: Row Level Security - قواعد تحدد من يمكنه رؤية أو تعديل كل صف في قاعدة البيانات

**Q: لماذا نستخدم TypeScript؟**
A: للتحقق من الأخطاء قبل تشغيل الكود - يكتشف المشاكل مبكراً

**Q: ما الفرق بين useState و useRef؟**
A: `useState` يعيد رسم المكون عند التغيير، `useRef` يحفظ قيمة بدون إعادة رسم

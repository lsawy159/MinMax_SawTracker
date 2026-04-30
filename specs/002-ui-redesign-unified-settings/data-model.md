# Phase 1 Data Model — UI/State Entities

**Date**: 2026-04-25
**Plan**: [plan.md](./plan.md)

This feature is purely frontend. No database schema changes. The "data model" below describes **client-side TypeScript state shapes and entities** that define the UI contract.

---

## Entity: `SettingsTabId`

```ts
type SettingsTabId = 'users-permissions' | 'backup'
```

**Validation**: query param `tab` parsed into this union; unknown values fall back to default (`users-permissions`).

**Source of truth**: URL search param `?tab=<id>` on `/settings`.

---

## Entity: `SettingsTabDescriptor`

```ts
interface SettingsTabDescriptor {
  id: SettingsTabId
  labelKey: string                  // i18n key, e.g. 'settings.tabs.usersPermissions'
  icon: ComponentType<IconProps>    // Phosphor icon component
  requiredPermission: PermissionKey // e.g. 'settings.users.read'
  component: ComponentType          // lazy-loaded tab component
}
```

**Constraints**:
- `id` must be unique across `SETTINGS_TABS`.
- `requiredPermission` checked via `useAuth()` before rendering.
- `component` wrapped in `React.lazy` for code-splitting (R7).

**Static registry** in `src/components/settings/SettingsHub.tsx`:

```ts
const SETTINGS_TABS: readonly SettingsTabDescriptor[] = [
  {
    id: 'users-permissions',
    labelKey: 'settings.tabs.usersPermissions',
    icon: UsersThree,
    requiredPermission: 'settings.users.read',
    component: lazy(() => import('./tabs/UsersPermissionsTab')),
  },
  {
    id: 'backup',
    labelKey: 'settings.tabs.backup',
    icon: CloudArrowUp,
    requiredPermission: 'settings.backup.read',
    component: lazy(() => import('./tabs/BackupTab')),
  },
] as const
```

---

## Entity: `NavGroup` and `NavItem`

```ts
type NavGroupId = 'operational' | 'admin'

interface NavItem {
  id: string                         // stable key, e.g. 'employees'
  labelKey: string
  icon: ComponentType<IconProps>
  to: string                         // route path
  requiredPermission?: PermissionKey // optional; absent = visible to all authenticated
  group: NavGroupId
  order: number                      // display order within group
}

interface NavGroup {
  id: NavGroupId
  labelKey: string                   // e.g. 'nav.groups.operational'
  items: NavItem[]
}
```

**Source of truth**: `src/components/layout/nav-config.ts` exports `NAV_GROUPS: NavGroup[]`.

**Operational group items** (12): Dashboard, Employees, Companies, Projects, TransferProcedures, AdvancedSearch, Alerts, Reports, PayrollDeductions, ActivityLogs, ImportExport, Notifications.

**Admin group items** (4): Settings (hub), AlertSettings, AdminSettings/GeneralSettings, SecurityManagement.

**Visibility rule**: `Sidebar` filters items where `requiredPermission` is set AND user lacks it.

---

## Entity: `PermissionDrawerState`

```ts
type PermissionDrawerState =
  | { kind: 'closed' }
  | { kind: 'open'; userId: string; dirty: boolean; saving: boolean }
```

**Lifecycle**:
- `closed` → `open` (kind='open', dirty=false, saving=false) when user clicks "Permissions" on a row.
- `open.dirty` → `true` when user toggles any permission/role.
- `open.saving` → `true` during mutation; back to `false` on success/error.
- `open` → `closed` on save success, on cancel, or on Esc (only if `dirty=false`; otherwise show unsaved-changes confirm).

**Constraint**: only ONE drawer instance per tab at a time (singleton pattern).

---

## Entity: `UnsavedChangesGuard`

```ts
interface UnsavedChangesGuard {
  hasUnsavedChanges: boolean
  promptOnNavigate: () => Promise<boolean>  // resolves true if user confirms leave
}
```

**Used by**:
- `SettingsHub` — blocks tab switch when active tab has dirty form.
- `PermissionDrawer` — blocks drawer close when permissions edited but not saved.

**Backed by**: React Hook Form `formState.isDirty` per form, exposed via custom hook `useUnsavedChangesGuard`.

---

## Entity: `DesignToken` (compile-time)

```ts
interface DesignToken {
  name: string             // e.g. '--color-primary-500'
  lightValue: string       // e.g. 'hsl(217 91% 60%)'
  darkValue: string        // e.g. 'hsl(217 91% 70%)'
  category: 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'motion'
}
```

**Source of truth**: `src/styles/tokens.css` (authoritative). TypeScript helper `src/lib/tokens.ts` re-exports token names as a const enum for autocomplete in component code.

**Categories**:
- **Color**: primary scale (50–950), neutral scale, semantic (success/warning/danger/info), surface, border.
- **Typography**: font family (display/body/mono), size scale (xs–4xl), weight, line-height.
- **Spacing**: 4-px base scale (1–24).
- **Radius**: sm/md/lg/xl/full.
- **Shadow**: sm/md/lg/xl.
- **Motion**: duration (fast 120ms / normal 200ms / slow 320ms), easing curves.

Full mapping in [contracts/design-tokens.md](./contracts/design-tokens.md).

---

## Entity: `RedirectRule`

```ts
interface RedirectRule {
  from: string                       // legacy path
  to: string                         // new path (may include query)
  reason: 'merged' | 'moved' | 'kept'
}
```

**Static config** in `src/lib/redirects.ts`:

```ts
const SETTINGS_REDIRECTS: RedirectRule[] = [
  { from: '/users', to: '/settings?tab=users-permissions', reason: 'merged' },
  { from: '/permissions', to: '/settings?tab=users-permissions', reason: 'merged' },
  { from: '/backup-settings', to: '/settings?tab=backup', reason: 'moved' },
  // /alert-settings, /admin-settings, /general-settings, /security-management → kept (no redirect)
]
```

**Implementation**: React Router `<Route element={<Navigate to=... replace />} />` per rule, replacing existing per-route `Navigate` placeholders in `App.tsx`.

---

## State Transitions: `SettingsHub`

```
   ┌───────────────────┐
   │ url has ?tab=ID? │
   └─────┬─────────────┘
         │
    yes  │  no
   ┌─────▼─────┐    ┌──────────────────────────────┐
   │ active =  │    │ active = first tab user has  │
   │   ID      │    │ permission to view (default  │
   │           │    │   = 'users-permissions')     │
   └─────┬─────┘    └──────┬───────────────────────┘
         │                 │
         └────────┬────────┘
                  ▼
            render tabs
            (filter by perm)
                  │
                  ▼
        user clicks tab T:
        ┌────────────────────────┐
        │ if dirty → confirm     │
        │ else → setSearchParam  │
        │   ('tab', T.id)        │
        └────────────────────────┘
```

---

## Validation Rules Summary

| Field | Rule | Source |
|-------|------|--------|
| `tab` query param | Must match `SettingsTabId` union; else fallback to default | URL parser |
| `requiredPermission` | Must be a known `PermissionKey` from existing constants | `useAuth` check |
| Permission drawer save payload | Validated via Zod schema `permissionUpdateSchema` (existing) | `react-hook-form` resolver |
| Tab switch | Blocked if `hasUnsavedChanges` until user confirms | `UnsavedChangesGuard` |
| Theme token names | Must match CSS var declarations in `tokens.css` | TS const enum |

No database, no migrations, no API additions. Backend RLS unchanged.

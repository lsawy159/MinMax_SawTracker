# Contract: Settings Hub Routing

**Owner**: `src/components/settings/SettingsHub.tsx`, `src/App.tsx`, `src/lib/redirects.ts`

## URL Shape

| URL | Meaning |
|-----|---------|
| `/settings` | Hub root — opens default tab (`users-permissions`). |
| `/settings?tab=users-permissions` | Users + Permissions tab active. |
| `/settings?tab=backup` | Backup settings tab active. |
| `/settings?tab=<unknown>` | Fall back to default tab; replace URL with valid `?tab=`. |

## Tab IDs (TypeScript Union — single source of truth)

```ts
type SettingsTabId = 'users-permissions' | 'backup'
```

## Redirect Map

| Legacy Path | Action | New Path |
|-------------|--------|----------|
| `/users` | `<Navigate replace />` | `/settings?tab=users-permissions` |
| `/permissions` | `<Navigate replace />` | `/settings?tab=users-permissions` |
| `/backup-settings` | `<Navigate replace />` | `/settings?tab=backup` |
| `/email-management` | `<Navigate replace />` | `/settings?tab=backup` *(existing redirect target)* |
| `/system-correspondence` | `<Navigate replace />` | `/settings?tab=backup` *(existing redirect target)* |
| `/centralized-settings` | `<Navigate replace />` | `/alert-settings` *(unchanged)* |
| `/alert-settings` | (no redirect) | renders `AlertSettings` page |
| `/admin-settings` | (no redirect) | renders `GeneralSettings` page |
| `/general-settings` | `<Navigate replace />` | `/admin-settings` *(unchanged)* |
| `/security-management` | (no redirect) | standalone `SecurityManagement` page |

## Permission Gate

| User permission state | Behavior |
|-----------------------|----------|
| Has permission for active tab | Render tab content. |
| Lacks permission for `?tab=X` | Replace URL with first tab user does have permission for. If none, render `<AccessDeniedState />`. |
| Lacks permission for any settings tab | `Settings` nav item hidden in sidebar. Direct `/settings` visit shows `<AccessDeniedState />`. |

## Tab Switch Lifecycle

```
user clicks Tab T:
  if currentTab.hasUnsavedChanges:
    confirm "تعديلات غير محفوظة، هل تريد الخروج؟"
      yes → setSearchParam('tab', T.id), discard form state
      no  → abort
  else:
    setSearchParam('tab', T.id, { replace: false })
```

## Browser History

- Forward/back across tab switches: each switch pushes a history entry → user can navigate back to previous tab.
- Initial visit to `/settings` (no `?tab=`) replaces (not pushes) URL with default — no extra back-button hop.

## Test Contract (`src/__tests__/redirects.test.tsx` and `SettingsHub.test.tsx`)

| Scenario | Expected |
|----------|----------|
| Visit `/users` | URL becomes `/settings?tab=users-permissions`, UsersPermissionsTab rendered. |
| Visit `/permissions` | Same as above (merged). |
| Visit `/backup-settings` | URL becomes `/settings?tab=backup`. |
| Visit `/settings` with no tab param | Default tab active, URL replaced with `?tab=users-permissions`. |
| Visit `/settings?tab=invalid` | Default tab active, URL replaced. |
| User without `settings.users.read` visits `/settings?tab=users-permissions` | Redirected to first allowed tab or AccessDeniedState. |
| User clicks tab while drawer dirty | Confirmation prompt shown; tab switch blocked until confirmed. |
| Browser back after tab switch | Returns to previous tab. |

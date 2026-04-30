# Contract: Permission Editor Drawer

**Owner**: `src/components/settings/tabs/PermissionDrawer.tsx`

Drawer component used inside `UsersPermissionsTab` to edit a single user's role and permission overrides without leaving the tab.

## Props

```ts
interface PermissionDrawerProps {
  userId: string | null            // null → drawer closed
  onClose: () => void              // called on Esc, overlay click, Cancel button
  onSaved: (userId: string) => void // called after successful mutation
}
```

`userId === null` ⇒ drawer hidden.
`userId === <id>` ⇒ drawer open, fetches user via `useUser(userId)`, fetches role/permissions via existing hooks.

## Layout (RTL-aware)

```
┌──────────────────────────────────────┐
│ ✕   صلاحيات: <اسم المستخدم>         │  ← Header (close button on inline-end)
├──────────────────────────────────────┤
│  الدور (Role)                       │
│  [▼ Select role]                    │
│                                      │
│  الصلاحيات الفردية                   │
│  ☑ settings.users.read              │
│  ☑ settings.users.write             │
│  ☐ settings.backup.write            │
│  …                                   │
│                                      │
│  [إعادة ضبط على الدور الافتراضي]    │
├──────────────────────────────────────┤
│        [إلغاء]    [حفظ]             │  ← Footer (sticky)
└──────────────────────────────────────┘
```

Drawer slides in from inline-start in RTL (logical right→left), inline-end in LTR.

## State Machine

```
        ┌────────┐
        │ closed │  (userId=null)
        └───┬────┘
            │ user clicks "Permissions" on row
            ▼
       ┌──────────────────────┐
       │ open · clean · idle  │ (userId set, dirty=false, saving=false)
       └────┬─────────────────┘
            │ user toggles any field
            ▼
       ┌──────────────────────┐
       │ open · dirty · idle  │
       └────┬─────────────┬───┘
            │             │
            │ Cancel/Esc  │ Save
            ▼             ▼
   confirm "تعديلات   ┌──────────────────────┐
   غير محفوظة؟"      │ open · dirty · saving │
            │         └────┬───────────┬─────┘
            ├─yes           │success    │error
            ▼               ▼           ▼
        closed          closed   open · dirty · idle
                                  + toast error
```

## Lifecycle Events

| Event | Source | Effect |
|-------|--------|--------|
| Open | row "Permissions" button click | set `userId` |
| Toggle field | checkbox/select | RHF marks dirty |
| Save click | footer button | runs mutation; on success → `onSaved`, close drawer |
| Cancel click | footer button | if dirty → confirm; else close |
| Esc key | keydown | same as Cancel |
| Overlay click | pointerdown outside drawer | same as Cancel |

## Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Radix `Dialog` provides — verified in tests with `userEvent.tab()` cycle. |
| Initial focus | First interactive element (Role select). |
| Return focus | On close, focus returns to the row's "Permissions" button. |
| Escape closes | Native Radix behavior; with dirty-confirmation gate. |
| ARIA roles | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing header title. |
| Screen reader announcement | Drawer open emits `aria-live="polite"` containing user name. |
| Keyboard save | `Ctrl+S` / `Cmd+S` while drawer focused → trigger Save (skipped if invalid). |
| Contrast | All text ≥ 4.5:1 against drawer surface token. |
| Motion | Slide animation 200ms; respects `prefers-reduced-motion: reduce` (instant show). |

## Validation

Form schema (Zod):

```ts
const permissionUpdateSchema = z.object({
  roleId: z.string().uuid().nullable(),
  permissions: z.record(z.string(), z.boolean()),
})
```

Submit blocked while `formState.isValid === false`.

## Mutation Contract

Reuses **existing** Supabase client + RLS-protected mutation hooks:
- `useUpdateUserRole(userId, roleId)`
- `useUpdateUserPermissions(userId, permissionsMap)`

Optimistic update via TanStack Query — invalidates `['users']` and `['users', userId]` keys on success.

## Test Contract

| Test | Assertion |
|------|-----------|
| Opens on row click | Drawer rendered, focus on Role select. |
| Esc closes when clean | Drawer hidden, no confirm. |
| Esc with dirty → confirm | Confirm dialog appears; "خروج" closes, "إلغاء" stays. |
| Save success | Mutation called, drawer closes, toast success. |
| Save error | Drawer stays open, error toast, dirty preserved. |
| Tab key cycle | Focus stays inside drawer (focus trap). |
| axe-core | Zero violations. |
| `prefers-reduced-motion` | No slide animation. |

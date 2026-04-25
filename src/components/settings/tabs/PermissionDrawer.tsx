import React, { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useUpdateUserRole, useUpdateUserPermissions } from '@/hooks/useUserMutations'
import { useConfirmation } from '@/hooks/useConfirmation'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'

interface PermissionDrawerProps {
  userId: string | null
  onClose: () => void
  onSaved: (userId: string) => void
}

const permissionUpdateSchema = z.object({
  roleId: z.string().uuid().nullable(),
  permissions: z.record(z.string(), z.boolean()),
})

type PermissionFormData = z.infer<typeof permissionUpdateSchema>

const AVAILABLE_PERMISSIONS = [
  'settings.users.read',
  'settings.users.write',
  'settings.users.delete',
  'settings.backup.read',
  'settings.backup.write',
  'settings.companies.read',
  'settings.companies.write',
  'settings.employees.read',
  'settings.employees.write',
  'settings.roles.read',
  'settings.roles.write',
]

const AVAILABLE_ROLES = [
  { id: '1', name: 'Admin' },
  { id: '2', name: 'Manager' },
  { id: '3', name: 'User' },
]

export function PermissionDrawer({ userId, onClose, onSaved }: PermissionDrawerProps) {
  const isOpen = userId !== null
  const { confirm } = useConfirmation()

  const {
    handleSubmit,
    formState: { isDirty, isValid, isSubmitting },
    reset,
  } = useForm<PermissionFormData>({
    resolver: zodResolver(permissionUpdateSchema),
    defaultValues: {
      roleId: null,
      permissions: AVAILABLE_PERMISSIONS.reduce((acc, perm) => ({ ...acc, [perm]: false }), {}),
    },
  })

  const updateRoleMutation = useUpdateUserRole()
  const updatePermissionsMutation = useUpdateUserPermissions()

  const handleClose = async () => {
    if (isDirty) {
      const confirmed = await confirm({
        title: 'تعديلات غير محفوظة',
        message: 'هل تريد المغادرة بدون حفظ التغييرات؟',
        confirmText: 'خروج',
        cancelText: 'إلغاء',
      })

      if (!confirmed) return
    }

    reset()
    onClose()
  }

  const onSubmit = useCallback(
    async (data: PermissionFormData) => {
      if (!userId) return

      try {
        if (data.roleId) {
          await updateRoleMutation.mutateAsync({
            userId,
            roleId: data.roleId,
          })
        }

        await updatePermissionsMutation.mutateAsync({
          userId,
          permissions: data.permissions,
        })

        toast.success('تم حفظ الصلاحيات بنجاح')
        reset()
        onSaved(userId)
        onClose()
      } catch (error) {
        logger.error('Error saving permissions:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'فشل حفظ الصلاحيات'
        toast.error(errorMessage)
      }
    },
    [userId, updateRoleMutation, updatePermissionsMutation, reset, onSaved, onClose]
  )

  // Handle keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && isValid) {
          handleSubmit(onSubmit)()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDirty, isValid, handleSubmit, onSubmit])

  // Respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className={prefersReducedMotion ? '' : 'animate-in slide-in-from-right duration-200'}
        style={prefersReducedMotion ? { animation: 'none' } : {}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-drawer-title"
      >
        <SheetHeader>
          <SheetTitle id="permission-drawer-title" className="text-right">
            صلاحيات المستخدم
          </SheetTitle>
        </SheetHeader>

        {userId ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-6">
            {/* Role Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                الدور (Role)
              </label>
              <Select>
                <option value="">اختر دوراً</option>
                {AVAILABLE_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Permissions Checkboxes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                الصلاحيات الفردية
              </label>
              <div className="space-y-2">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label key={permission} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked={false} />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {permission}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <Button type="button" variant="secondary" size="sm" className="w-full">
              إعادة ضبط على الدور الافتراضي
            </Button>

            {/* Footer */}
            <SheetFooter className="gap-2 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
                aria-label="إلغاء التعديلات وإغلاق"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!isDirty || !isValid || isSubmitting}
                aria-label={isSubmitting ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
              >
                {isSubmitting ? <LoadingSpinner className="h-4 w-4" /> : 'حفظ'}
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

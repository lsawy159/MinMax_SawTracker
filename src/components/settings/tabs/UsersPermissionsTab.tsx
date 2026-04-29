import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, User } from '@/lib/supabase'
import { PermissionDrawer } from './PermissionDrawer'
import { RolesManagementSheet } from './RolesManagementSheet'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { logger } from '@/utils/logger'
import { Shield, Settings, Users as UsersIcon } from 'lucide-react'

export function UsersPermissionsTab(): JSX.Element {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showRolesSheet, setShowRolesSheet] = useState(false)

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, email, role, is_active, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching users:', error)
        throw error
      }
      return (data as User[]) || []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 dark:border-danger-700/50 dark:bg-danger-900/20">
        <p className="text-sm text-danger-700 dark:text-danger-300">خطأ في تحميل المستخدمين</p>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon className="h-12 w-12 text-neutral-400" />}
        title="لا توجد مستخدمون"
        description="لم يتم العثور على مستخدمين في النظام"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            المستخدمون والصلاحيات
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            إدارة صلاحيات المستخدمين والأدوار
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowRolesSheet(true)}
          className="flex items-center gap-2"
          aria-label="فتح إدارة الأدوار"
        >
          <Settings className="h-4 w-4" />
          إدارة الأدوار
        </Button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                الاسم
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                البريد الإلكتروني
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                الدور
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                الحالة
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <td className="px-6 py-4 text-sm text-neutral-900 dark:text-neutral-50">
                  {user.full_name || user.username}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                  {user.email}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                    <Shield className="h-3 w-3" />
                    {user.role === 'admin' ? 'مدير' : user.role === 'manager' ? 'مسؤول' : 'مستخدم'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      user.is_active
                        ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                    }`}
                  >
                    {user.is_active ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedUserId(user.id)}
                      className="flex items-center gap-2"
                      aria-label={`إدارة صلاحيات ${user.full_name || user.username}`}
                    >
                      <Settings className="h-4 w-4" />
                      صلاحيات
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permission Drawer */}
      <PermissionDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onSaved={() => setSelectedUserId(null)}
      />

      {/* Roles Management Sheet */}
      <RolesManagementSheet isOpen={showRolesSheet} onOpenChange={setShowRolesSheet} />
    </div>
  )
}

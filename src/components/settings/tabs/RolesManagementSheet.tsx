import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'
import { Plus, Trash2 } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

interface RolesManagementSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function RolesManagementSheet({ isOpen, onOpenChange }: RolesManagementSheetProps) {
  const queryClient = useQueryClient()
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching roles:', error)
        throw error
      }
      return (data as Role[]) || []
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      if (!newRoleName.trim()) throw new Error('Role name is required')

      const { data, error } = await supabase
        .from('roles')
        .insert([{ name: newRoleName, description: newRoleDescription }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setNewRoleName('')
      setNewRoleDescription('')
      toast.success('تم إنشاء الدور بنجاح')
    },
    onError: (error) => {
      logger.error('Error creating role:', error)
      toast.error('فشل إنشاء الدور')
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', roleId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('تم حذف الدور بنجاح')
    },
    onError: (error) => {
      logger.error('Error deleting role:', error)
      toast.error('فشل حذف الدور')
    },
  })

  const handleCreateRole = async () => {
    await createRoleMutation.mutateAsync()
  }

  const handleDeleteRole = async (roleId: string) => {
    if (window.confirm('هل تريد حذف هذا الدور؟')) {
      await deleteRoleMutation.mutateAsync(roleId)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="text-right">إدارة الأدوار</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Create New Role Form */}
          <div className="space-y-4 border-b border-neutral-200 pb-6 dark:border-neutral-700">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              إنشاء دور جديد
            </h4>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                اسم الدور
              </label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="مثال: محرر محتوى"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                الوصف
              </label>
              <Input
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="الوصف (اختياري)"
              />
            </div>
            <Button
              onClick={handleCreateRole}
              disabled={createRoleMutation.isPending || !newRoleName.trim()}
              className="w-full flex items-center justify-center gap-2"
              aria-label={createRoleMutation.isPending ? 'جاري إنشاء الدور' : 'إنشاء دور جديد'}
            >
              {createRoleMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              إنشاء الدور
            </Button>
          </div>

          {/* Roles List */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              الأدوار الموجودة
            </h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">لا توجد أدوار</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                        {role.name}
                      </p>
                      {role.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {role.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deleteRoleMutation.isPending}
                        onClick={() => handleDeleteRole(role.id)}
                        aria-label={`حذف الدور ${role.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

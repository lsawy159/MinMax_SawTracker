import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  normalizePermissions,
  normalizePermissionsFlat,
  type PermissionMatrix,
} from '@/utils/permissions'

interface UsePermissionsResult {
  permissionMatrix: PermissionMatrix
  currentPermissions: string[]
  hasPermission: (permission: string) => boolean
  checkPermissions: (permissions: string[]) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  isAdmin: boolean
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth()

  const permissionMatrix = useMemo<PermissionMatrix>(() => {
    if (!user) {
      return normalizePermissions({}, 'user')
    }
    return normalizePermissions(user.permissions, user.role)
  }, [user])

  const currentPermissions = useMemo<string[]>(() => {
    if (!user) {
      return []
    }
    return normalizePermissionsFlat(user.permissions, user.role)
  }, [user])

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.is_active) {
      return false
    }

    if (user.role === 'admin') {
      return true
    }

    return currentPermissions.includes(permission)
  }

  const checkPermissions = (permissions: string[]): boolean => {
    if (!permissions.length) {
      return true
    }
    return permissions.every(hasPermission)
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!permissions.length) {
      return true
    }
    return permissions.some(hasPermission)
  }

  return {
    permissionMatrix,
    currentPermissions,
    hasPermission,
    checkPermissions,
    hasAnyPermission,
    isAdmin: user?.role === 'admin' && user?.is_active === true,
  }
}

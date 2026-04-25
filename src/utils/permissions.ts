import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  PERMISSION_SECTIONS,
  VALID_PERMISSION_SECTIONS,
  getActionsForSection,
} from './PERMISSIONS_SCHEMA'

// واجهة الصلاحيات الموسعة لجميع الصفحات
export interface PermissionMatrix {
  employees: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  settings: { view: boolean; edit: boolean }
  adminSettings: { view: boolean; edit: boolean }
  centralizedSettings: { view: boolean; edit: boolean }
  projects: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  transferProcedures: {
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
    import: boolean
    export: boolean
  }
  reports: { view: boolean; export: boolean }
  payroll: { view: boolean; export: boolean }
  alerts: { view: boolean }
  advancedSearch: { view: boolean }
  userGuide: { view: boolean }
  importExport: { view: boolean; import: boolean; export: boolean }
  activityLogs: { view: boolean }
  dashboard: { view: boolean }
}

/**
 * الصلاحيات الافتراضية للمستخدمين الجدد
 * بناءً على PERMISSION_SCHEMA - كل فعل يكون false (Deny by Default)
 */
function createEmptyPermissions(): PermissionMatrix {
  const empty = {} as Record<keyof PermissionMatrix, Record<string, boolean>>
  for (const section of VALID_PERMISSION_SECTIONS) {
    empty[section] = {}
    const actions = PERMISSION_SECTIONS[section].actions
    for (const action of actions) {
      empty[section][action] = false // ← Deny by Default
    }
  }
  return empty as unknown as PermissionMatrix
}

/**
 * إنشاء صلاحيات كاملة للمديرين (جميع الأفعال = true)
 */
function createFullAdminPermissions(): PermissionMatrix {
  const admin = {} as Record<keyof PermissionMatrix, Record<string, boolean>>
  for (const section of VALID_PERMISSION_SECTIONS) {
    admin[section] = {}
    const actions = getActionsForSection(section)
    for (const action of actions) {
      admin[section][action] = true // ← Master Key
    }
  }
  return admin as unknown as PermissionMatrix
}

// احتفظ بها للتوافق للخلف مع المكونات الموجودة
export const defaultPermissions = createEmptyPermissions()
export const adminPermissions = createFullAdminPermissions()

/**
 * تطبيع الصلاحيات مع سياسة "المنع افتراضاً" (Deny by Default)
 *
 * الآن يدعم النسختين:
 * 1. النسخة القديمة: Record<string, unknown> (JSONB من قاعدة البيانات)
 * 2. النسخة الجديدة: string[] (flat permissions: ['employees.view', 'companies.create'])
 *
 * السلوك:
 * 1. إذا كان المستخدم مدير: يحصل على جميع الصلاحيات (Master Key)
 * 2. إذا كانت البيانات string[]: تحويل إلى Matrix
 * 3. إذا كانت البيانات Record: معالجة كالسابق
 * 4. إذا كانت البيانات فارغة: إرجاع صلاحيات فارغة
 */
export const normalizePermissions = (
  permissions: unknown,
  role?: 'admin' | 'manager' | 'user'
): PermissionMatrix => {
  // إذا كان المستخدم مدير، إرجاع صلاحيات المدير الكاملة فوراً
  if (role === 'admin') {
    return createFullAdminPermissions()
  }

  // إذا كانت صيغة string[] جديدة، تحويل مباشر
  if (Array.isArray(permissions)) {
    return flatPermissionsToMatrix(permissions as string[])
  }

  // بدء بصلاحيات فارغة (كل شيء = false)
  const normalized = createEmptyPermissions()

  // إذا كانت البيانات فارغة أو غير صحيحة، أرجع الصلاحيات الفارغة (Deny by Default)
  if (!permissions || typeof permissions !== 'object') {
    return normalized
  }

  const perms = permissions as Record<string, unknown>

  // مرّ على كل قسم مسموح فقط (من المخطط المركزي)
  for (const section of VALID_PERMISSION_SECTIONS) {
    const sectionData = perms[section]

    // إذا كان القسم موجوداً وهو object، معالجة أفعاله
    if (sectionData && typeof sectionData === 'object') {
      const sectionObj = sectionData as Record<string, unknown>
      const actions = getActionsForSection(section)

      // مرّ على الأفعال المسموح بها للقسم
      for (const action of actions) {
        const value = sectionObj[action]

        // تطبيع إلى boolean مع دعم القيم القديمة (strings من قاعدة البيانات)
        if (value === true || value === 'true') {
          ;(normalized as unknown as Record<string, Record<string, boolean>>)[section][action] =
            true
        } else {
          ;(normalized as unknown as Record<string, Record<string, boolean>>)[section][action] =
            false // ← Deny by Default
        }
      }
    }
    // ملاحظة: إذا كان القسم غائباً أو ليس object، يبقى كل أفعاله false (من createEmptyPermissions)
  }

  return normalized
}

/**
 * تحويل من format string[] المسطح إلى PermissionMatrix
 * مثال: ['employees.view', 'companies.create'] → { employees: { view: true, create: false, ... }, ... }
 * هذا يدعم الترقية التدريجية من string[] إلى البنية الجديدة
 */
export function flatPermissionsToMatrix(flatPerms: string[]): PermissionMatrix {
  const matrix = createEmptyPermissions()

  if (!Array.isArray(flatPerms)) {
    return matrix
  }

  for (const perm of flatPerms) {
    const [section, action] = perm.split('.') as [keyof PermissionMatrix, string]

    if (section && action && section in matrix) {
      const sectionPermissions = matrix[section] as Record<string, boolean>
      if (action in sectionPermissions) {
        sectionPermissions[action] = true
      }
    }
  }

  return matrix
}

/**
 * تحويل من PermissionMatrix إلى format string[] المسطح
 * مثال: { employees: { view: true, create: true, ... }, ... } → ['employees.view', 'employees.create', ...]
 */
export function matrixToFlatPermissions(matrix: PermissionMatrix): string[] {
  const flat: string[] = []

  for (const section of VALID_PERMISSION_SECTIONS) {
    const sectionPerms = matrix[section] as Record<string, boolean>
    if (sectionPerms && typeof sectionPerms === 'object') {
      const actions = getActionsForSection(section)
      for (const action of actions) {
        if (sectionPerms[action] === true) {
          flat.push(`${section}.${action}`)
        }
      }
    }
  }

  return flat
}

/**
 * تطبيع صلاحيات مسطحة (string[]) مع نفس قواعد Deny by Default
 * تدعم النسخة الجديدة من البيانات
 */
export function normalizePermissionsFlat(
  permissions: unknown,
  role?: 'admin' | 'manager' | 'user'
): string[] {
  // المديرون لهم جميع الصلاحيات (فقط إذا كانوا نشطين)
  if (role === 'admin') {
    return matrixToFlatPermissions(createFullAdminPermissions())
  }

  if (!Array.isArray(permissions)) {
    return []
  }

  // تصفية وتحقق من صحة كل صلاحية
  return permissions.filter((perm) => {
    if (typeof perm !== 'string') return false

    const [section, action] = perm.split('.')
    return (
      section &&
      action &&
      VALID_PERMISSION_SECTIONS.includes(section as keyof PermissionMatrix) &&
      PERMISSION_SECTIONS[section as keyof PermissionMatrix].actions.includes(action as never)
    )
  })
}

/**
 * Hook للتحقق من الصلاحيات
 * يعيد object يحتوي على:
 * - permissions: الصلاحيات المطبعة للمستخدم الحالي
 * - hasPermission: دالة للتحقق من صلاحية محددة
 * - canView, canCreate, canEdit, canDelete: دوال مساعدة للتحقق من الصلاحيات الشائعة
 */
export function usePermissions() {
  const { user } = useAuth()

  // الحصول على الصلاحيات المطبعة (محسّنة بـ useMemo لتجنب الحسابات الزائدة)
  const permissions: PermissionMatrix = useMemo(
    () => (user ? normalizePermissions(user.permissions, user.role) : defaultPermissions),
    [user]
  )

  /**
   * التحقق من صلاحية محددة
   * @param section القسم (مثل 'employees', 'companies')
   * @param action الإجراء (مثل 'view', 'create', 'edit', 'delete')
   */
  const hasPermission = (section: keyof PermissionMatrix, action: string): boolean => {
    if (!user) {
      return false
    }

    // المديرون لهم جميع الصلاحيات (فقط إذا كانوا نشطين)
    if (user.role === 'admin' && user.is_active) {
      return true
    }

    // التحقق من الصلاحية المحددة
    const sectionPermissions = permissions[section]
    if (!sectionPermissions || typeof sectionPermissions !== 'object') {
      return false
    }

    // للصلاحيات البسيطة (view فقط)
    if (action === 'view' && 'view' in sectionPermissions) {
      return Boolean(sectionPermissions.view)
    }

    // للصلاحيات المعقدة (create, edit, delete)
    if (action in sectionPermissions) {
      const sectionPerms = sectionPermissions as Record<string, boolean>
      return Boolean(sectionPerms[action])
    }

    return false
  }

  /**
   * دوال مساعدة للتحقق من الصلاحيات الشائعة
   */
  const canView = (section: keyof PermissionMatrix) => hasPermission(section, 'view')

  const canCreate = (section: keyof PermissionMatrix) => hasPermission(section, 'create')

  const canEdit = (section: keyof PermissionMatrix) => hasPermission(section, 'edit')

  const canDelete = (section: keyof PermissionMatrix) => hasPermission(section, 'delete')

  const canExport = (section: keyof PermissionMatrix) => hasPermission(section, 'export')

  const canImport = (section: keyof PermissionMatrix) => hasPermission(section, 'import')

  return {
    permissions,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    isAdmin: user?.role === 'admin',
  }
}

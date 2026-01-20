import { useAuth } from '@/contexts/AuthContext'
import {
  PERMISSION_SECTIONS,
  VALID_PERMISSION_SECTIONS,
  getActionsForSection
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
  reports: { view: boolean; export: boolean }
  alerts: { view: boolean }
  advancedSearch: { view: boolean }
  importExport: { view: boolean; import: boolean; export: boolean }
  activityLogs: { view: boolean }
  dashboard: { view: boolean }
}

/**
 * الصلاحيات الافتراضية للمستخدمين الجدد
 * بناءً على PERMISSION_SCHEMA - كل فعل يكون false (Deny by Default)
 */
function createEmptyPermissions(): PermissionMatrix {
  const empty: Record<string, Record<string, boolean>> = {}
  for (const section of VALID_PERMISSION_SECTIONS) {
    empty[section] = {}
    const actions = PERMISSION_SECTIONS[section].actions
    for (const action of actions) {
      empty[section][action] = false // ← Deny by Default
    }
  }
  return empty as PermissionMatrix
}

/**
 * إنشاء صلاحيات كاملة للمديرين (جميع الأفعال = true)
 */
function createFullAdminPermissions(): PermissionMatrix {
  const admin: Record<string, Record<string, boolean>> = {}
  for (const section of VALID_PERMISSION_SECTIONS) {
    admin[section] = {}
    const actions = getActionsForSection(section)
    for (const action of actions) {
      admin[section][action] = true // ← Master Key
    }
  }
  return admin as PermissionMatrix
}

// احتفظ بها للتوافق للخلف مع المكونات الموجودة
export const defaultPermissions = createEmptyPermissions()
export const adminPermissions = createFullAdminPermissions()

/**
 * تطبيع الصلاحيات مع سياسة "المنع افتراضاً" (Deny by Default)
 * 
 * السلوك:
 * 1. إذا كان المستخدم مدير: يحصل على جميع الصلاحيات (Master Key)
 * 2. إذا كانت البيانات فارغة/غير صحيحة: إرجاع صلاحيات فارغة (كل فعل = false)
 * 3. إذا كان القسم مفقوداً: القسم كامل = false
 * 4. إذا كان الفعل مفقوداً: هذا الفعل = false
 * 
 * ملاحظة: لا نملأ البيانات الناقصة بقيم افتراضية متساهلة
 */
export const normalizePermissions = (
  permissions: unknown,
  role?: 'admin' | 'user'
): PermissionMatrix => {
  // إذا كان المستخدم مدير، إرجاع صلاحيات المدير الكاملة فوراً
  if (role === 'admin') {
    return createFullAdminPermissions()
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
          (normalized as Record<string, Record<string, boolean>>)[section][action] = true
        } else {
          (normalized as Record<string, Record<string, boolean>>)[section][action] = false // ← Deny by Default
        }
      }
    }
    // ملاحظة: إذا كان القسم غائباً أو ليس object، يبقى كل أفعاله false (من createEmptyPermissions)
  }

  return normalized
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

  // الحصول على الصلاحيات المطبعة
  const permissions: PermissionMatrix = user
    ? normalizePermissions(user.permissions, user.role)
    : defaultPermissions

  /**
   * التحقق من صلاحية محددة
   * @param section القسم (مثل 'employees', 'companies')
   * @param action الإجراء (مثل 'view', 'create', 'edit', 'delete')
   */
  const hasPermission = (
    section: keyof PermissionMatrix,
    action: string
  ): boolean => {
    if (!user) {
      return false
    }

    // المديرون لهم جميع الصلاحيات
    if (user.role === 'admin') {
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
  const canView = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'view')

  const canCreate = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'create')

  const canEdit = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'edit')

  const canDelete = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'delete')

  const canExport = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'export')

  const canImport = (section: keyof PermissionMatrix) =>
    hasPermission(section, 'import')

  return {
    permissions,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    isAdmin: user?.role === 'admin'
  }
}


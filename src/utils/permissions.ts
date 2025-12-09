import { useAuth } from '@/contexts/AuthContext'

// واجهة الصلاحيات الموسعة لجميع الصفحات
export interface PermissionMatrix {
  employees: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  settings: { view: boolean; edit: boolean }
  adminSettings: { view: boolean; edit: boolean }
  projects: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  reports: { view: boolean; export: boolean }
  alerts: { view: boolean }
  advancedSearch: { view: boolean }
  importExport: { view: boolean; import: boolean; export: boolean }
  activityLogs: { view: boolean }
  dashboard: { view: boolean }
}

// الصلاحيات الافتراضية للمستخدمين العاديين
export const defaultPermissions: PermissionMatrix = {
  employees: { view: true, create: false, edit: false, delete: false },
  companies: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  adminSettings: { view: false, edit: false },
  projects: { view: true, create: false, edit: false, delete: false },
  reports: { view: true, export: false },
  alerts: { view: true },
  advancedSearch: { view: true },
  importExport: { view: false, import: false, export: false },
  activityLogs: { view: false },
  dashboard: { view: true }
}

// الصلاحيات الكاملة للمديرين
export const adminPermissions: PermissionMatrix = {
  employees: { view: true, create: true, edit: true, delete: true },
  companies: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  settings: { view: true, edit: true },
  adminSettings: { view: true, edit: true },
  projects: { view: true, create: true, edit: true, delete: true },
  reports: { view: true, export: true },
  alerts: { view: true },
  advancedSearch: { view: true },
  importExport: { view: true, import: true, export: true },
  activityLogs: { view: true },
  dashboard: { view: true }
}

/**
 * تطبيع الصلاحيات وتأكد من وجود جميع الخصائص المطلوبة
 * إذا كان المستخدم مدير، يتم إرجاع صلاحيات المدير الكاملة تلقائياً
 */
export const normalizePermissions = (
  permissions: unknown,
  role?: 'admin' | 'user'
): PermissionMatrix => {
  // إذا كان المستخدم مدير، إرجاع صلاحيات المدير الكاملة تلقائيًا
  if (role === 'admin') {
    return adminPermissions
  }

  // إذا كانت الصلاحيات فارغة أو غير صحيحة، إرجاع الصلاحيات الافتراضية
  if (!permissions || typeof permissions !== 'object') {
    return defaultPermissions
  }

  const perms = permissions as Record<string, unknown>

  return {
    employees: {
      view: (perms.employees as Record<string, boolean>)?.view ?? defaultPermissions.employees.view,
      create: (perms.employees as Record<string, boolean>)?.create ?? defaultPermissions.employees.create,
      edit: (perms.employees as Record<string, boolean>)?.edit ?? defaultPermissions.employees.edit,
      delete: (perms.employees as Record<string, boolean>)?.delete ?? defaultPermissions.employees.delete
    },
    companies: {
      view: (perms.companies as Record<string, boolean>)?.view ?? defaultPermissions.companies.view,
      create: (perms.companies as Record<string, boolean>)?.create ?? defaultPermissions.companies.create,
      edit: (perms.companies as Record<string, boolean>)?.edit ?? defaultPermissions.companies.edit,
      delete: (perms.companies as Record<string, boolean>)?.delete ?? defaultPermissions.companies.delete
    },
    users: {
      view: (perms.users as Record<string, boolean>)?.view ?? defaultPermissions.users.view,
      create: (perms.users as Record<string, boolean>)?.create ?? defaultPermissions.users.create,
      edit: (perms.users as Record<string, boolean>)?.edit ?? defaultPermissions.users.edit,
      delete: (perms.users as Record<string, boolean>)?.delete ?? defaultPermissions.users.delete
    },
    settings: {
      view: (perms.settings as Record<string, boolean>)?.view ?? defaultPermissions.settings.view,
      edit: (perms.settings as Record<string, boolean>)?.edit ?? defaultPermissions.settings.edit
    },
    adminSettings: {
      view: (perms.adminSettings as Record<string, boolean>)?.view ?? defaultPermissions.adminSettings.view,
      edit: (perms.adminSettings as Record<string, boolean>)?.edit ?? defaultPermissions.adminSettings.edit
    },
    projects: {
      view: (perms.projects as Record<string, boolean>)?.view ?? defaultPermissions.projects.view,
      create: (perms.projects as Record<string, boolean>)?.create ?? defaultPermissions.projects.create,
      edit: (perms.projects as Record<string, boolean>)?.edit ?? defaultPermissions.projects.edit,
      delete: (perms.projects as Record<string, boolean>)?.delete ?? defaultPermissions.projects.delete
    },
    reports: {
      view: (perms.reports as Record<string, boolean>)?.view ?? defaultPermissions.reports.view,
      export: (perms.reports as Record<string, boolean>)?.export ?? defaultPermissions.reports.export
    },
    alerts: {
      view: (perms.alerts as Record<string, boolean>)?.view ?? defaultPermissions.alerts.view
    },
    advancedSearch: {
      view: (perms.advancedSearch as Record<string, boolean>)?.view ?? defaultPermissions.advancedSearch.view
    },
    importExport: {
      view: (perms.importExport as Record<string, boolean>)?.view ?? defaultPermissions.importExport.view,
      import: (perms.importExport as Record<string, boolean>)?.import ?? defaultPermissions.importExport.import,
      export: (perms.importExport as Record<string, boolean>)?.export ?? defaultPermissions.importExport.export
    },
    activityLogs: {
      view: (perms.activityLogs as Record<string, boolean>)?.view ?? defaultPermissions.activityLogs.view
    },
    dashboard: {
      view: (perms.dashboard as Record<string, boolean>)?.view ?? defaultPermissions.dashboard.view
    }
  }
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


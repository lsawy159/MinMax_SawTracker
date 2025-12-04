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
  permissions: any,
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

  return {
    employees: {
      view: permissions.employees?.view ?? defaultPermissions.employees.view,
      create: permissions.employees?.create ?? defaultPermissions.employees.create,
      edit: permissions.employees?.edit ?? defaultPermissions.employees.edit,
      delete: permissions.employees?.delete ?? defaultPermissions.employees.delete
    },
    companies: {
      view: permissions.companies?.view ?? defaultPermissions.companies.view,
      create: permissions.companies?.create ?? defaultPermissions.companies.create,
      edit: permissions.companies?.edit ?? defaultPermissions.companies.edit,
      delete: permissions.companies?.delete ?? defaultPermissions.companies.delete
    },
    users: {
      view: permissions.users?.view ?? defaultPermissions.users.view,
      create: permissions.users?.create ?? defaultPermissions.users.create,
      edit: permissions.users?.edit ?? defaultPermissions.users.edit,
      delete: permissions.users?.delete ?? defaultPermissions.users.delete
    },
    settings: {
      view: permissions.settings?.view ?? defaultPermissions.settings.view,
      edit: permissions.settings?.edit ?? defaultPermissions.settings.edit
    },
    adminSettings: {
      view: permissions.adminSettings?.view ?? defaultPermissions.adminSettings.view,
      edit: permissions.adminSettings?.edit ?? defaultPermissions.adminSettings.edit
    },
    projects: {
      view: permissions.projects?.view ?? defaultPermissions.projects.view,
      create: permissions.projects?.create ?? defaultPermissions.projects.create,
      edit: permissions.projects?.edit ?? defaultPermissions.projects.edit,
      delete: permissions.projects?.delete ?? defaultPermissions.projects.delete
    },
    reports: {
      view: permissions.reports?.view ?? defaultPermissions.reports.view,
      export: permissions.reports?.export ?? defaultPermissions.reports.export
    },
    alerts: {
      view: permissions.alerts?.view ?? defaultPermissions.alerts.view
    },
    advancedSearch: {
      view: permissions.advancedSearch?.view ?? defaultPermissions.advancedSearch.view
    },
    importExport: {
      view: permissions.importExport?.view ?? defaultPermissions.importExport.view,
      import: permissions.importExport?.import ?? defaultPermissions.importExport.import,
      export: permissions.importExport?.export ?? defaultPermissions.importExport.export
    },
    activityLogs: {
      view: permissions.activityLogs?.view ?? defaultPermissions.activityLogs.view
    },
    dashboard: {
      view: permissions.dashboard?.view ?? defaultPermissions.dashboard.view
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
      return Boolean((sectionPermissions as any)[action])
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


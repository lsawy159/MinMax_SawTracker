/**
 * PERMISSIONS_SCHEMA.ts
 * 
 * مصدر الحقيقة الوحيد لجميع أقسام الصلاحيات والأفعال
 * Single Source of Truth للنظام الذكي للصلاحيات
 * 
 * فوائد الاستخدام:
 * - إضافة قسم جديد: سطر واحد فقط → يظهر في الواجهة تلقائياً
 * - الأفعال الديناميكية: أي تغيير هنا ينعكس على كل مكان
 * - عدم تكرار الكود: لا محاكاة أو hardcoding
 */

/**
 * الأقسام والأفعال المسموح بها
 * كل قسم يحتوي على:
 * - label: الاسم المعروض بالعربية
 * - actions: مصفوفة الأفعال المتاحة للقسم
 */
export const PERMISSION_SECTIONS = {
  dashboard: {
    label: 'الرئيسية',
    description: 'عرض لوحة المؤشرات الرئيسية فقط.',
    actions: ['view'] as const
  },
  employees: {
    label: 'الموظفين',
    description: 'إدارة بيانات الموظفين وسجلاتهم الأساسية.',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  companies: {
    label: 'المؤسسات',
    description: 'إدارة المؤسسات والكيانات المرتبطة بالموظفين.',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  projects: {
    label: 'المشاريع',
    description: 'إدارة المشاريع وربط الموظفين وطلبات النقل بها.',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  transferProcedures: {
    label: 'إجراءات النقل',
    description: 'صفحة تشغيلية مستقلة لإدارة طلبات النقل، تحديث حالتها، ثم تحويل الطلب إلى موظف.',
    actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] as const
  },
  alerts: {
    label: 'التنبيهات',
    description: 'متابعة التنبيهات والإشعارات المهمة داخل النظام.',
    actions: ['view'] as const
  },
  advancedSearch: {
    label: 'البحث المتقدم',
    description: 'الوصول إلى شاشات البحث والتحليل المتقدم.',
    actions: ['view'] as const
  },
  userGuide: {
    label: 'دليل المستخدم',
    description: 'عرض دليل الاستخدام الداخلي.',
    actions: ['view'] as const
  },
  reports: {
    label: 'التقارير',
    description: 'عرض التقارير النظامية وتصديرها فقط، بدون منح صلاحيات الرواتب أو النقل تلقائياً.',
    actions: ['view', 'export'] as const
  },
  payroll: {
    label: 'الرواتب والاستقطاعات',
    description: 'صلاحية مستقلة لمسيرات الرواتب والاستقطاعات، منفصلة تماماً عن التقارير.',
    actions: ['view', 'export'] as const
  },
  activityLogs: {
    label: 'سجل النشاطات',
    description: 'عرض سجل العمليات والتغييرات داخل النظام.',
    actions: ['view'] as const
  },
  importExport: {
    label: 'استيراد/تصدير',
    description: 'صفحة ملفات Excel فقط. صلاحيتها لا تعني إدارة إجراءات النقل نفسها، بل استيرادها وتصديرها كملفات.',
    actions: ['view', 'import', 'export'] as const
  },
  users: {
    label: 'المستخدمين',
    description: 'الوصول إلى شاشة إدارة المستخدمين وصلاحياتهم.',
    actions: ['view'] as const
  },
  settings: {
    label: 'حدود الشركات',
    description: 'ضبط حدود المؤسسات والإعدادات المرتبطة بها.',
    actions: ['view', 'edit'] as const
  },
  adminSettings: {
    label: 'إعدادات النظام',
    description: 'إعدادات النظام الإدارية العامة.',
    actions: ['view', 'edit'] as const
  },
  centralizedSettings: {
    label: 'إعدادات التنبيهات',
    description: 'إعدادات التنبيهات والإشعارات المركزية.',
    actions: ['view', 'edit'] as const
  }
} as const

/**
 * قائمة تسميات الأفعال المترجمة
 */
export const ACTION_LABELS: Record<string, string> = {
  view: 'عرض',
  create: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
  import: 'استيراد',
  export: 'تصدير'
}

/**
 * قائمة أسماء الأقسام الصحيحة (للتحقق والتطبيع)
 */
export const VALID_PERMISSION_SECTIONS = Object.keys(PERMISSION_SECTIONS) as (keyof typeof PERMISSION_SECTIONS)[]

/**
 * نسخة المخطط (للمتابعة والترقيات المستقبلية)
 */
export const PERMISSION_SCHEMA_VERSION = '2.0'

/**
 * Helper: الحصول على الأفعال المسموح بها لقسم معين
 */
export function getActionsForSection(
  sectionName: keyof typeof PERMISSION_SECTIONS
): readonly string[] {
  return PERMISSION_SECTIONS[sectionName]?.actions ?? []
}

/**
 * Helper: الحصول على تسمية القسم بالعربية
 */
export function getSectionLabel(
  sectionName: keyof typeof PERMISSION_SECTIONS
): string {
  return PERMISSION_SECTIONS[sectionName]?.label ?? sectionName
}

/**
 * Helper: التحقق من صحة قسم معين
 */
export function isValidSection(
  sectionName: string
): sectionName is keyof typeof PERMISSION_SECTIONS {
  return sectionName in PERMISSION_SECTIONS
}

/**
 * Helper: التحقق من صحة فعل معين لقسم معين
 */
export function isValidAction(
  sectionName: keyof typeof PERMISSION_SECTIONS,
  action: string
): boolean {
  const validActions = getActionsForSection(sectionName)
  return validActions.includes(action as never)
}

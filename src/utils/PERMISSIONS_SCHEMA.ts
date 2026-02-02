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
    actions: ['view'] as const
  },
  employees: {
    label: 'الموظفين',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  companies: {
    label: 'المؤسسات',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  projects: {
    label: 'المشاريع',
    actions: ['view', 'create', 'edit', 'delete'] as const
  },
  alerts: {
    label: 'التنبيهات',
    actions: ['view'] as const
  },
  advancedSearch: {
    label: 'البحث المتقدم',
    actions: ['view'] as const
  },
  userGuide: {
    label: 'دليل المستخدم',
    actions: ['view'] as const
  },
  reports: {
    label: 'التقارير',
    actions: ['view', 'export'] as const
  },
  activityLogs: {
    label: 'سجل النشاطات',
    actions: ['view'] as const
  },
  importExport: {
    label: 'استيراد/تصدير',
    actions: ['view', 'import', 'export'] as const
  },
  users: {
    label: 'المستخدمين',
    actions: ['view'] as const
  },
  settings: {
    label: 'حدود الشركات',
    actions: ['view', 'edit'] as const
  },
  adminSettings: {
    label: 'إعدادات النظام',
    actions: ['view', 'edit'] as const
  },
  centralizedSettings: {
    label: 'إعدادات التنبيهات',
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

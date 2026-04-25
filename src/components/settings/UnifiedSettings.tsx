import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AlertTriangle,
  Eye,
  Palette,
  Save,
  Sparkles,
  Bell,
  TrendingUp,
  Settings as SettingsIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'
import { invalidateEmployeeNotificationThresholdsCache } from '@/utils/employeeAlerts'
import { invalidateNotificationThresholdsCache } from '@/utils/alerts'
import { invalidateStatusThresholdsCache } from '@/utils/autoCompanyStatus'

/**
 * واجهة موحدة لجميع إعدادات النظام
 * تجمع: إعدادات الحالات، إعدادات التنبيهات، وألوان الجداول
 */
interface UnifiedSettingsData {
  // الموظفين - الإقامة
  residence_urgent_days: number
  residence_high_days: number
  residence_medium_days: number

  // الموظفين - العقود
  contract_urgent_days: number
  contract_high_days: number
  contract_medium_days: number

  // الموظفين - التأمين الصحي
  health_insurance_urgent_days: number
  health_insurance_high_days: number
  health_insurance_medium_days: number

  // الموظفين - عقد أجير
  hired_worker_contract_urgent_days: number
  hired_worker_contract_high_days: number
  hired_worker_contract_medium_days: number

  // المؤسسات - السجل التجاري (موحد مع الموظفين)
  commercial_reg_urgent_days: number
  commercial_reg_high_days: number
  commercial_reg_medium_days: number

  // المؤسسات - اشتراك قوى
  power_subscription_urgent_days: number
  power_subscription_high_days: number
  power_subscription_medium_days: number

  // المؤسسات - اشتراك مقيم
  moqeem_subscription_urgent_days: number
  moqeem_subscription_high_days: number
  moqeem_subscription_medium_days: number

  [key: string]: number
}

const DEFAULT_SETTINGS: UnifiedSettingsData = {
  // الموظفين - الإقامة
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,

  // الموظفين - العقود
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,

  // الموظفين - التأمين الصحي
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,

  // الموظفين - عقد أجير
  hired_worker_contract_urgent_days: 7,
  hired_worker_contract_high_days: 15,
  hired_worker_contract_medium_days: 30,

  // المؤسسات - السجل التجاري (موحد مع الموظفين)
  commercial_reg_urgent_days: 7,
  commercial_reg_high_days: 15,
  commercial_reg_medium_days: 30,

  // المؤسسات - اشتراك قوى
  power_subscription_urgent_days: 7,
  power_subscription_high_days: 15,
  power_subscription_medium_days: 30,

  // المؤسسات - اشتراك مقيم
  moqeem_subscription_urgent_days: 7,
  moqeem_subscription_high_days: 15,
  moqeem_subscription_medium_days: 30,
}

// تكوين أقسام الموظفين
const EMPLOYEE_SECTIONS = [
  {
    key: 'residence',
    title: 'إقامات الموظفين',
    icon: '🛂',
    description: 'إعدادات ألوان وتنبيهات انتهاء الإقامات',
    fields: {
      urgent: 'residence_urgent_days',
      high: 'residence_high_days',
      medium: 'residence_medium_days',
    },
    type: 'employee' as const,
  },
  {
    key: 'contract',
    title: 'عقود الموظفين',
    icon: '📄',
    description: 'إعدادات ألوان وتنبيهات انتهاء عقود العمل',
    fields: {
      urgent: 'contract_urgent_days',
      high: 'contract_high_days',
      medium: 'contract_medium_days',
    },
    type: 'employee' as const,
  },
  {
    key: 'health',
    title: 'التأمين الصحي',
    icon: '🏥',
    description: 'إعدادات ألوان وتنبيهات انتهاء التأمين الصحي',
    fields: {
      urgent: 'health_insurance_urgent_days',
      high: 'health_insurance_high_days',
      medium: 'health_insurance_medium_days',
    },
    type: 'employee' as const,
  },
  {
    key: 'hired',
    title: 'عقود أجير',
    icon: '👷',
    description: 'إعدادات ألوان وتنبيهات انتهاء عقود الأجير',
    fields: {
      urgent: 'hired_worker_contract_urgent_days',
      high: 'hired_worker_contract_high_days',
      medium: 'hired_worker_contract_medium_days',
    },
    type: 'employee' as const,
  },
]

// تكوين أقسام المؤسسات (موحد مع الموظفين)
const COMPANY_SECTIONS = [
  {
    key: 'commercial',
    title: 'السجل التجاري',
    icon: '🏢',
    description: 'إعدادات حالة وألوان وتنبيهات السجل التجاري',
    fields: {
      urgent: 'commercial_reg_urgent_days',
      high: 'commercial_reg_high_days',
      medium: 'commercial_reg_medium_days',
    },
    type: 'company' as const,
  },
  {
    key: 'power',
    title: 'اشتراك قوى',
    icon: '⚡',
    description: 'إعدادات حالة وألوان وتنبيهات اشتراك قوى',
    fields: {
      urgent: 'power_subscription_urgent_days',
      high: 'power_subscription_high_days',
      medium: 'power_subscription_medium_days',
    },
    type: 'company' as const,
  },
  {
    key: 'moqeem',
    title: 'اشتراك مقيم',
    icon: '👥',
    description: 'إعدادات حالة وألوان وتنبيهات اشتراك مقيم',
    fields: {
      urgent: 'moqeem_subscription_urgent_days',
      high: 'moqeem_subscription_high_days',
      medium: 'moqeem_subscription_medium_days',
    },
    type: 'company' as const,
  },
]

export default function UnifiedSettings({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [settings, setSettings] = useState<UnifiedSettingsData>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'employees' | 'companies'>('employees')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // تحميل إعدادات التنبيهات (للموظفين)
      const { data: notificationData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'notification_thresholds')
        .maybeSingle()

      // تحميل إعدادات الحالات (للمؤسسات)
      const { data: statusData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'status_thresholds')
        .maybeSingle()

      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(notificationData?.setting_value || {}),
        ...(statusData?.setting_value || {}),
      }

      setSettings(mergedSettings)
    } catch (error) {
      logger.error('Error loading unified settings:', error)
      toast.error('تعذر تحميل الإعدادات، سيتم استخدام القيم الافتراضية')
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // حفظ إعدادات التنبيهات والحالات (موحدة للموظفين والمؤسسات)
      const notificationSettings = {
        // إعدادات الموظفين
        residence_urgent_days: settings.residence_urgent_days,
        residence_high_days: settings.residence_high_days,
        residence_medium_days: settings.residence_medium_days,
        contract_urgent_days: settings.contract_urgent_days,
        contract_high_days: settings.contract_high_days,
        contract_medium_days: settings.contract_medium_days,
        health_insurance_urgent_days: settings.health_insurance_urgent_days,
        health_insurance_high_days: settings.health_insurance_high_days,
        health_insurance_medium_days: settings.health_insurance_medium_days,
        hired_worker_contract_urgent_days: settings.hired_worker_contract_urgent_days,
        hired_worker_contract_high_days: settings.hired_worker_contract_high_days,
        hired_worker_contract_medium_days: settings.hired_worker_contract_medium_days,
        // إعدادات المؤسسات (موحدة)
        commercial_reg_urgent_days: settings.commercial_reg_urgent_days,
        commercial_reg_high_days: settings.commercial_reg_high_days,
        commercial_reg_medium_days: settings.commercial_reg_medium_days,
        power_subscription_urgent_days: settings.power_subscription_urgent_days,
        power_subscription_high_days: settings.power_subscription_high_days,
        power_subscription_medium_days: settings.power_subscription_medium_days,
        moqeem_subscription_urgent_days: settings.moqeem_subscription_urgent_days,
        moqeem_subscription_high_days: settings.moqeem_subscription_high_days,
        moqeem_subscription_medium_days: settings.moqeem_subscription_medium_days,
      }

      // حفظ إعدادات الحالات (للتوافق مع الكود القديم)
      const statusSettings = {
        commercial_reg_urgent_days: settings.commercial_reg_urgent_days,
        commercial_reg_high_days: settings.commercial_reg_high_days,
        commercial_reg_medium_days: settings.commercial_reg_medium_days,
        power_subscription_urgent_days: settings.power_subscription_urgent_days,
        power_subscription_high_days: settings.power_subscription_high_days,
        power_subscription_medium_days: settings.power_subscription_medium_days,
        moqeem_subscription_urgent_days: settings.moqeem_subscription_urgent_days,
        moqeem_subscription_high_days: settings.moqeem_subscription_high_days,
        moqeem_subscription_medium_days: settings.moqeem_subscription_medium_days,
      }

      // حفظ البيانات باستخدام INSERT OR UPDATE
      // محاولة الحفظ مع إعادة محاولة في حالة الفشل
      const { error: notificationError } = await supabase
        .from('system_settings')
        .upsert(
          {
            setting_key: 'notification_thresholds',
            setting_value: notificationSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        )
        .select()

      const { error: statusError } = await supabase
        .from('system_settings')
        .upsert(
          {
            setting_key: 'status_thresholds',
            setting_value: statusSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        )
        .select()

      if (notificationError || statusError) {
        throw notificationError || statusError
      }

      // إبطال جميع الكاش وإشعار باقي الصفحات
      invalidateNotificationThresholdsCache()
      invalidateEmployeeNotificationThresholdsCache()
      invalidateStatusThresholdsCache()
      window.dispatchEvent(new CustomEvent('settingsUpdated'))

      toast.success('تم حفظ جميع الإعدادات بنجاح')
    } catch (error) {
      logger.error('Error saving unified settings:', error)

      // معالجة رسالة الخطأ
      let errorMessage = 'فشل حفظ الإعدادات'
      if (error instanceof Object && 'message' in error) {
        const errorMsg = (error as Record<string, unknown>).message as string
        if (errorMsg.includes('row-level security') || errorMsg.includes('RLS')) {
          errorMessage =
            'ليس لديك صلاحية كافية لحفظ الإعدادات. اطلب من المدير إعطاء صلاحية التعديل.'
        } else if (errorMsg.includes('permission') || errorMsg.includes('access')) {
          errorMessage = 'خطأ في الصلاحيات. تأكد من أن لديك صلاحية التعديل.'
        }
      }

      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const employeePreviews = useMemo(
    () =>
      EMPLOYEE_SECTIONS.map((section) => ({
        ...section,
        values: {
          urgentDays: settings[section.fields.urgent],
          highDays: settings[section.fields.high],
          mediumDays: settings[section.fields.medium],
          greenStart: settings[section.fields.medium] + 1,
        },
      })),
    [settings]
  )

  const companyPreviews = useMemo(
    () =>
      COMPANY_SECTIONS.map((section) => ({
        ...section,
        values: {
          urgentDays: settings[section.fields.urgent],
          highDays: settings[section.fields.high],
          mediumDays: settings[section.fields.medium],
          greenStart: settings[section.fields.medium] + 1,
        },
      })),
    [settings]
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* رأس الصفحة */}
      <div className="app-panel p-3">
        <div className="flex items-center gap-2">
          <div className="app-icon-chip">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">إعدادات التنبيهات</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              صفحة موحدة لإعدادات الحالات والتنبيهات وألوان الجداول
            </p>
          </div>
        </div>
      </div>

      {/* تبويبات الأقسام */}
      <div className="app-toggle-shell p-1.5">
        <div className="flex gap-1.5 w-full">
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === 'employees' ? 'app-toggle-button-active' : 'app-toggle-button'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Bell className="w-4 h-4" />
              <span>إعدادات الموظفين</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === 'companies' ? 'app-toggle-button-active' : 'app-toggle-button'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span>إعدادات المؤسسات</span>
            </div>
          </button>
        </div>
      </div>

      {/* محتوى إعدادات الموظفين */}
      {activeTab === 'employees' && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="app-icon-chip">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  إعدادات ألوان وتنبيهات الموظفين
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  تحكم في الأيام والألوان والتنبيهات لجميع حالات الموظفين. التغييرات تنعكس فوراً على
                  الجداول والكروت والتنبيهات.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EMPLOYEE_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="border border-neutral-200 rounded-lg p-3 bg-gradient-to-br from-gray-50 to-white"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-lg">{section.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{section.title}</h3>
                      <p className="text-[11px] text-neutral-600">{section.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-neutral-700">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        أحمر (طارئ)
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        برتقالي (عاجل)
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        أصفر (متوسط)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.urgent]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.urgent]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-3 py-2 border border-red-200 rounded-lg text-center text-sm font-bold text-red-700 bg-white focus:ring-2 focus:ring-red-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.high]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.high]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-3 py-2 border border-orange-200 rounded-lg text-center text-sm font-bold text-warning-700 bg-white focus:ring-2 focus:ring-orange-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.medium]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.medium]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-3 py-2 border border-yellow-200 rounded-lg text-center text-sm font-bold text-yellow-700 bg-white focus:ring-2 focus:ring-yellow-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                    </div>

                    <div className="text-xs text-neutral-600 space-y-1 bg-white border border-neutral-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        <span>أحمر: منتهي أو ≤ {settings[section.fields.urgent]} يوم</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-warning-600" />
                        <span>برتقالي: ≤ {settings[section.fields.high]} يوم</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        <span>أصفر: ≤ {settings[section.fields.medium]} يوم</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>أخضر: أكثر من {settings[section.fields.medium]} يوم</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* معاينة سريعة للموظفين */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-base font-semibold text-neutral-900">معاينة سريعة - الموظفين</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {employeePreviews.map((section) => (
                <div
                  key={section.key}
                  className="border border-neutral-200 rounded-lg p-3 bg-neutral-50"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-lg">{section.icon}</span>
                    <span className="text-[13px] font-semibold text-neutral-900">
                      {section.title}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-neutral-700">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span>حتى {section.values.urgentDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                      <span>حتى {section.values.highDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                      <span>حتى {section.values.mediumDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <span>من {section.values.greenStart} يوم</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* محتوى إعدادات المؤسسات */}
      {activeTab === 'companies' && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-md">
                <TrendingUp className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  إعدادات ألوان وتنبيهات المؤسسات (موحد)
                </h2>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  تحكم في الأيام والألوان والتنبيهات لجميع اشتراكات المؤسسات. نفس نظام الموظفين:
                  طارئ - عاجل - متوسط - ساري.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMPANY_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="border border-neutral-200 rounded-lg p-3 bg-gradient-to-br from-gray-50 to-white"
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="text-xl">{section.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{section.title}</h3>
                      <p className="text-[11px] text-neutral-600">{section.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-neutral-700">
                      <span className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        أحمر (طارئ)
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                        برتقالي (عاجل)
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                        أصفر (متوسط)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.urgent]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.urgent]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-2.5 py-1.5 border border-red-200 rounded-md text-center text-[13px] font-bold text-red-700 bg-white focus:ring-2 focus:ring-red-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.high]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.high]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-2.5 py-1.5 border border-orange-200 rounded-md text-center text-[13px] font-bold text-warning-700 bg-white focus:ring-2 focus:ring-orange-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings[section.fields.medium]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [section.fields.medium]: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isReadOnly}
                        className={`w-full px-2.5 py-1.5 border border-yellow-200 rounded-md text-center text-[13px] font-bold text-yellow-700 bg-white focus:ring-2 focus:ring-yellow-500 ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed bg-neutral-50' : ''
                        }`}
                      />
                    </div>

                    <div className="text-[11px] text-neutral-600 space-y-1 bg-white border border-neutral-200 rounded-md p-2.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        <span>أحمر: منتهي أو ≤ {settings[section.fields.urgent]} يوم</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-warning-600" />
                        <span>برتقالي: ≤ {settings[section.fields.high]} يوم</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        <span>أصفر: ≤ {settings[section.fields.medium]} يوم</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                        <span>أخضر (ساري): أكثر من {settings[section.fields.medium]} يوم</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* معاينة سريعة للمؤسسات */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Eye className="w-4 h-4 text-success-600" />
              <h3 className="text-base font-semibold text-neutral-900">معاينة سريعة - المؤسسات</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {companyPreviews.map((section) => (
                <div
                  key={section.key}
                  className="border border-neutral-200 rounded-lg p-3 bg-neutral-50"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-lg">{section.icon}</span>
                    <span className="text-[13px] font-semibold text-neutral-900">
                      {section.title}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-neutral-700">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span>طارئ: حتى {section.values.urgentDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                      <span>عاجل: حتى {section.values.highDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                      <span>متوسط: حتى {section.values.mediumDays} يوم</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <span>ساري: أكثر من {section.values.mediumDays} يوم</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* أزرار الحفظ */}
      {!isReadOnly && (
        <div className="flex items-center justify-end gap-2.5 bg-white rounded-lg shadow-sm border border-neutral-200 p-3">
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="px-4 py-2 text-sm border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50 transition font-semibold"
            disabled={saving}
          >
            استعادة الافتراضي
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="app-button-primary text-sm disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="app-info-block rounded-lg p-3">
          <div className="flex items-start gap-2.5">
            <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">وضع العرض فقط</p>
              <p className="text-xs text-slate-700 mt-0.5">
                ليس لديك صلاحية تعديل الإعدادات. اطلب من المدير إعطاء الصلاحية اللازمة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ملاحظة توضيحية */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 mb-1.5">نظام موحد للموظفين والمؤسسات</h4>
            <ul className="text-[13px] text-amber-800 space-y-1 list-disc list-inside">
              <li>
                <strong>المسميات الموحدة:</strong> جميع الأقسام تستخدم نفس المسميات:{' '}
                <span className="font-bold">طارئ - عاجل - متوسط - ساري</span>
              </li>
              <li>
                <strong>إعدادات الموظفين:</strong> تؤثر على ألوان الجداول، الكروت، والتنبيهات
                (الإقامة، العقود، التأمين الصحي، عقد أجير)
              </li>
              <li>
                <strong>إعدادات المؤسسات:</strong> نفس النظام تماماً (السجل التجاري، التأمينات،
                اشتراك قوى، اشتراك مقيم)
              </li>
              <li>
                <strong>الألوان الموحدة:</strong> 🔴 أحمر (طارئ) | 🟠 برتقالي (عاجل) | 🟡 أصفر
                (متوسط) | 🟢 أخضر (ساري)
              </li>
              <li>
                <strong>القاعدة:</strong> أي قيمة أكبر من "متوسط" تعتبر تلقائياً في حالة "ساري"
                (أخضر)
              </li>
              <li>
                <strong>التنعكاس الفوري:</strong> أي تغيير هنا ينعكس تلقائياً على جميع أجزاء النظام
                بعد الحفظ
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

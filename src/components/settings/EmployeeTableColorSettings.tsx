import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Eye, Palette, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'
import { invalidateEmployeeNotificationThresholdsCache } from '@/utils/employeeAlerts'
import { invalidateNotificationThresholdsCache } from '@/utils/alerts'

interface ColorSettingsData {
  residence_urgent_days: number
  residence_high_days: number
  residence_medium_days: number
  contract_urgent_days: number
  contract_high_days: number
  contract_medium_days: number
  health_insurance_urgent_days: number
  health_insurance_high_days: number
  health_insurance_medium_days: number
  hired_worker_contract_urgent_days: number
  hired_worker_contract_high_days: number
  hired_worker_contract_medium_days: number
  // نحافظ على بقية الحقول لعدم فقدان بيانات التنبيهات الأخرى
  [key: string]: number
}

const DEFAULT_COLOR_SETTINGS: ColorSettingsData = {
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,
  hired_worker_contract_urgent_days: 7,
  hired_worker_contract_high_days: 15,
  hired_worker_contract_medium_days: 30
}

const CARD_CONFIG = [
  {
    key: 'residence',
    title: 'إقامات الموظفين',
    fields: {
      urgent: 'residence_urgent_days',
      high: 'residence_high_days',
      medium: 'residence_medium_days'
    }
  },
  {
    key: 'contract',
    title: 'عقود الموظفين',
    fields: {
      urgent: 'contract_urgent_days',
      high: 'contract_high_days',
      medium: 'contract_medium_days'
    }
  },
  {
    key: 'health',
    title: 'التأمين الصحي',
    fields: {
      urgent: 'health_insurance_urgent_days',
      high: 'health_insurance_high_days',
      medium: 'health_insurance_medium_days'
    }
  },
  {
    key: 'hired',
    title: 'عقود أجير',
    fields: {
      urgent: 'hired_worker_contract_urgent_days',
      high: 'hired_worker_contract_high_days',
      medium: 'hired_worker_contract_medium_days'
    }
  }
] as const

export default function EmployeeTableColorSettings() {
  const [settings, setSettings] = useState<ColorSettingsData>(DEFAULT_COLOR_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'notification_thresholds')
          .maybeSingle()

        if (data?.setting_value) {
          setSettings({ ...DEFAULT_COLOR_SETTINGS, ...data.setting_value })
        } else {
          setSettings(DEFAULT_COLOR_SETTINGS)
        }
      } catch (error) {
        logger.error('Error loading color settings:', error)
        toast.error('تعذر تحميل إعدادات الألوان، سيتم استخدام القيم الافتراضية')
        setSettings(DEFAULT_COLOR_SETTINGS)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'notification_thresholds',
          setting_value: settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // إبطال الكاش وإشعار باقي الصفحات
      invalidateNotificationThresholdsCache()
      invalidateEmployeeNotificationThresholdsCache()
      window.dispatchEvent(new CustomEvent('settingsUpdated'))

      toast.success('تم حفظ إعدادات ألوان الجدول بنجاح')
    } catch (error) {
      logger.error('Error saving color settings:', error)
      toast.error('فشل حفظ إعدادات الألوان')
    } finally {
      setSaving(false)
    }
  }

  const previews = useMemo(() => (
    CARD_CONFIG.map((card) => {
      const urgentDays = settings[card.fields.urgent]
      const highDays = settings[card.fields.high]
      const mediumDays = settings[card.fields.medium]

      return {
        ...card,
        values: {
          urgentDays,
          highDays,
          mediumDays,
          greenStart: mediumDays + 1
        }
      }
    })
  ), [settings])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
            <Palette className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">ألوان جدول الموظفين</h2>
            <p className="text-sm text-gray-600 mt-1">
              هذه القيم هي نفسها المستخدمة في نظام التنبيهات، وأي تعديل هنا سيؤثر على الألوان والتنبيهات معاً.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CARD_CONFIG.map((card) => (
            <div key={card.key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-700">
                  <span>أحمر (طارئ)</span>
                  <span>برتقالي (عاجل)</span>
                  <span>أصفر (متوسط)</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={settings[card.fields.urgent]}
                    onChange={(e) => setSettings({ ...settings, [card.fields.urgent]: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg text-center text-sm font-bold text-red-700 bg-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={settings[card.fields.high]}
                    onChange={(e) => setSettings({ ...settings, [card.fields.high]: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg text-center text-sm font-bold text-orange-700 bg-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={settings[card.fields.medium]}
                    onChange={(e) => setSettings({ ...settings, [card.fields.medium]: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-yellow-200 rounded-lg text-center text-sm font-bold text-yellow-700 bg-white"
                  />
                </div>

                <div className="text-xs text-gray-600 space-y-1 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>أحمر: منتهي أو ≤ {settings[card.fields.urgent]} يوم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>برتقالي: ≤ {settings[card.fields.high]} يوم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span>أصفر: ≤ {settings[card.fields.medium]} يوم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>أخضر: أكثر من {settings[card.fields.medium]} يوم</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">معاينة سريعة</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {previews.map((card) => (
            <div key={card.key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-900">{card.title}</span>
              </div>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>أحمر حتى {card.values.urgentDays} يوم</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>برتقالي حتى {card.values.highDays} يوم</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span>أصفر حتى {card.values.mediumDays} يوم</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>أخضر من {card.values.greenStart} يوم</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setSettings(DEFAULT_COLOR_SETTINGS)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          disabled={saving}
        >
          استعادة الافتراضي
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  )
}

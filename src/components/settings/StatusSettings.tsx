import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Save, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { invalidateStatusThresholdsCache } from '@/utils/autoCompanyStatus'
import { logger } from '@/utils/logger'

interface StatusSettingsData {
  // السجل التجاري
  commercial_reg_critical_days: number
  commercial_reg_urgent_days: number
  commercial_reg_medium_days: number
  // التأمينات الاجتماعية
  social_insurance_critical_days: number
  social_insurance_urgent_days: number
  social_insurance_medium_days: number
  // اشتراك قوى
  power_subscription_critical_days: number
  power_subscription_urgent_days: number
  power_subscription_medium_days: number
  // اشتراك مقيم
  moqeem_subscription_critical_days: number
  moqeem_subscription_urgent_days: number
  moqeem_subscription_medium_days: number
}

export default function StatusSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<StatusSettingsData>({
    // القيم الافتراضية
    commercial_reg_critical_days: 7,
    commercial_reg_urgent_days: 30,
    commercial_reg_medium_days: 45,
    social_insurance_critical_days: 7,
    social_insurance_urgent_days: 30,
    social_insurance_medium_days: 45,
    power_subscription_critical_days: 7,
    power_subscription_urgent_days: 30,
    power_subscription_medium_days: 45,
    moqeem_subscription_critical_days: 7,
    moqeem_subscription_urgent_days: 30,
    moqeem_subscription_medium_days: 45
  })

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'status_thresholds')
        .maybeSingle()

      if (data && data.setting_value) {
        setSettings({ ...settings, ...data.setting_value })
      }
    } catch {
      logger.debug('Using default status settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'status_thresholds',
          setting_value: settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Invalidate cache
      invalidateStatusThresholdsCache()

      // إرسال حدث لتحديث الإحصائيات في جميع الصفحات
      window.dispatchEvent(new CustomEvent('settingsUpdated'))

      toast.success('تم حفظ إعدادات الحالات بنجاح')
    } catch (error: unknown) {
      console.error('Error saving settings:', error)
      toast.error('فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

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
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إعدادات الحالات</h2>
            <p className="text-gray-600 text-sm mt-1">
              تحديد عدد الأيام لحساب حالة كل اشتراك (منتهي، حرج، عاجل، متوسط، ساري)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* السجل التجاري */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-200">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">السجل التجاري</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حرج (Critical)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.commercial_reg_critical_days}
                  onChange={(e) => setSettings({ ...settings, commercial_reg_critical_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">منتهي أو ≤ {settings.commercial_reg_critical_days} أيام = حالة حرج</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عاجل (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.commercial_reg_urgent_days}
                  onChange={(e) => setSettings({ ...settings, commercial_reg_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.commercial_reg_critical_days + 1} إلى {settings.commercial_reg_urgent_days} أيام = حالة عاجل</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.commercial_reg_medium_days}
                  onChange={(e) => setSettings({ ...settings, commercial_reg_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.commercial_reg_urgent_days + 1} إلى {settings.commercial_reg_medium_days} أيام = حالة متوسط</p>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>أكثر من {settings.commercial_reg_medium_days} يوم</strong> = حالة ساري
              </p>
            </div>
          </div>

          {/* التأمينات الاجتماعية */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-green-200">
              <AlertCircle className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">التأمينات الاجتماعية</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حرج (Critical)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.social_insurance_critical_days}
                  onChange={(e) => setSettings({ ...settings, social_insurance_critical_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">منتهي أو ≤ {settings.social_insurance_critical_days} أيام = حالة حرج</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عاجل (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.social_insurance_urgent_days}
                  onChange={(e) => setSettings({ ...settings, social_insurance_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.social_insurance_critical_days + 1} إلى {settings.social_insurance_urgent_days} أيام = حالة عاجل</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.social_insurance_medium_days}
                  onChange={(e) => setSettings({ ...settings, social_insurance_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.social_insurance_urgent_days + 1} إلى {settings.social_insurance_medium_days} أيام = حالة متوسط</p>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>أكثر من {settings.social_insurance_medium_days} يوم</strong> = حالة ساري
              </p>
            </div>
          </div>

          {/* اشتراك قوى */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-purple-200">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">اشتراك قوى</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حرج (Critical)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.power_subscription_critical_days}
                  onChange={(e) => setSettings({ ...settings, power_subscription_critical_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">منتهي أو ≤ {settings.power_subscription_critical_days} أيام = حالة حرج</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عاجل (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.power_subscription_urgent_days}
                  onChange={(e) => setSettings({ ...settings, power_subscription_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.power_subscription_critical_days + 1} إلى {settings.power_subscription_urgent_days} أيام = حالة عاجل</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.power_subscription_medium_days}
                  onChange={(e) => setSettings({ ...settings, power_subscription_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.power_subscription_urgent_days + 1} إلى {settings.power_subscription_medium_days} أيام = حالة متوسط</p>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>أكثر من {settings.power_subscription_medium_days} يوم</strong> = حالة ساري
              </p>
            </div>
          </div>

          {/* اشتراك مقيم */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-orange-200">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">اشتراك مقيم</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حرج (Critical)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.moqeem_subscription_critical_days}
                  onChange={(e) => setSettings({ ...settings, moqeem_subscription_critical_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">منتهي أو ≤ {settings.moqeem_subscription_critical_days} أيام = حالة حرج</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عاجل (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.moqeem_subscription_urgent_days}
                  onChange={(e) => setSettings({ ...settings, moqeem_subscription_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.moqeem_subscription_critical_days + 1} إلى {settings.moqeem_subscription_urgent_days} أيام = حالة عاجل</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.moqeem_subscription_medium_days}
                  onChange={(e) => setSettings({ ...settings, moqeem_subscription_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">من {settings.moqeem_subscription_urgent_days + 1} إلى {settings.moqeem_subscription_medium_days} أيام = حالة متوسط</p>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>أكثر من {settings.moqeem_subscription_medium_days} يوم</strong> = حالة ساري
              </p>
            </div>
          </div>
        </div>

        {/* ملخص الحالات */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-3">ملخص الحالات:</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-700">منتهي: &lt; 0 يوم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className="text-gray-700">حرج: ≤ {settings.commercial_reg_critical_days} يوم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-700">عاجل: {settings.commercial_reg_critical_days + 1} - {settings.commercial_reg_urgent_days} يوم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700">متوسط: {settings.commercial_reg_urgent_days + 1} - {settings.commercial_reg_medium_days} يوم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">ساري: &gt; {settings.commercial_reg_medium_days} يوم</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-green-400 font-medium"
          >
            <Save className="w-5 h-5" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </div>
    </div>
  )
}

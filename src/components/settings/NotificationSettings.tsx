import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { invalidateNotificationThresholdsCache } from '@/utils/alerts'
import { invalidateEmployeeNotificationThresholdsCache } from '@/utils/employeeAlerts'

interface NotificationSettingsData {
  residence_urgent_days: number
  residence_high_days: number
  residence_medium_days: number
  contract_urgent_days: number
  contract_high_days: number
  contract_medium_days: number
  // Company alerts settings
  commercial_reg_urgent_days: number
  commercial_reg_high_days: number
  commercial_reg_medium_days: number
  // التأمينات الاجتماعية للمؤسسات
  social_insurance_urgent_days: number
  social_insurance_high_days: number
  social_insurance_medium_days: number
  // التأمين الصحي للموظفين
  health_insurance_urgent_days: number
  health_insurance_high_days: number
  health_insurance_medium_days: number
  // عقد أجير
  hired_worker_contract_urgent_days: number
  hired_worker_contract_high_days: number
  hired_worker_contract_medium_days: number
  // اشتراك قوى
  power_subscription_urgent_days: number
  power_subscription_high_days: number
  power_subscription_medium_days: number
  // اشتراك مقيم
  moqeem_subscription_urgent_days: number
  moqeem_subscription_high_days: number
  moqeem_subscription_medium_days: number
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<NotificationSettingsData>({
    residence_urgent_days: 7,
    residence_high_days: 15,
    residence_medium_days: 30,
    contract_urgent_days: 7,
    contract_high_days: 15,
    contract_medium_days: 30,
    commercial_reg_urgent_days: 30,
    commercial_reg_high_days: 45,
    commercial_reg_medium_days: 60,
    // التأمينات الاجتماعية للمؤسسات
    social_insurance_urgent_days: 30,
    social_insurance_high_days: 45,
    social_insurance_medium_days: 60,
    // التأمين الصحي للموظفين
    health_insurance_urgent_days: 30,
    health_insurance_high_days: 45,
    health_insurance_medium_days: 60,
    // عقد أجير
    hired_worker_contract_urgent_days: 7,
    hired_worker_contract_high_days: 15,
    hired_worker_contract_medium_days: 30,
    // اشتراك قوى
    power_subscription_urgent_days: 30,
    power_subscription_high_days: 45,
    power_subscription_medium_days: 60,
    // اشتراك مقيم
    moqeem_subscription_urgent_days: 30,
    moqeem_subscription_high_days: 45,
    moqeem_subscription_medium_days: 60
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // محاولة تحميل الإعدادات من قاعدة البيانات
      // إذا لم توجد، استخدام القيم الافتراضية
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'notification_thresholds')
        .maybeSingle()

      if (data && data.setting_value) {
        // دمج الإعدادات المحملة مع القيم الافتراضية لضمان وجود جميع الحقول
        setSettings({
          residence_urgent_days: 7,
          residence_high_days: 15,
          residence_medium_days: 30,
          contract_urgent_days: 7,
          contract_high_days: 15,
          contract_medium_days: 30,
          commercial_reg_urgent_days: 30,
          commercial_reg_high_days: 45,
          commercial_reg_medium_days: 60,
          social_insurance_urgent_days: 30,
          social_insurance_high_days: 45,
          social_insurance_medium_days: 60,
          health_insurance_urgent_days: 30,
          health_insurance_high_days: 45,
          health_insurance_medium_days: 60,
          hired_worker_contract_urgent_days: 7,
          hired_worker_contract_high_days: 15,
          hired_worker_contract_medium_days: 30,
          power_subscription_urgent_days: 30,
          power_subscription_high_days: 45,
          power_subscription_medium_days: 60,
          moqeem_subscription_urgent_days: 30,
          moqeem_subscription_high_days: 45,
          moqeem_subscription_medium_days: 60,
          ...data.setting_value
        })
      }
    } catch (error) {
      console.log('Using default notification settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // حفظ الإعدادات في قاعدة البيانات
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'notification_thresholds',
          setting_value: settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Invalidate caches so fresh data is loaded on next request
      invalidateNotificationThresholdsCache()
      invalidateEmployeeNotificationThresholdsCache()

      // إرسال حدث لتحديث الإحصائيات في جميع الصفحات
      window.dispatchEvent(new CustomEvent('settingsUpdated'))

      toast.success('تم حفظ إعدادات التنبيهات بنجاح')
    } catch (error: any) {
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
          <div className="p-3 bg-blue-100 rounded-lg">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إعدادات التنبيهات</h2>
            <p className="text-gray-600 text-sm mt-1">
              تحديد عدد الأيام للتحذير من انتهاء الإقامات والعقود والسجل التجاري والتأمين
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Residence Expiry Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء الإقامة</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.residence_urgent_days}
                  onChange={(e) => setSettings({ ...settings, residence_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.residence_high_days}
                  onChange={(e) => setSettings({ ...settings, residence_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.residence_medium_days}
                  onChange={(e) => setSettings({ ...settings, residence_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Contract Expiry Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-200">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء العقد</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.contract_urgent_days}
                  onChange={(e) => setSettings({ ...settings, contract_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.contract_high_days}
                  onChange={(e) => setSettings({ ...settings, contract_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.contract_medium_days}
                  onChange={(e) => setSettings({ ...settings, contract_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Commercial Registration Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-200">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء السجل التجاري</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.commercial_reg_urgent_days}
                  onChange={(e) => setSettings({ ...settings, commercial_reg_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.commercial_reg_high_days}
                  onChange={(e) => setSettings({ ...settings, commercial_reg_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Social Insurance Settings - التأمينات الاجتماعية للمؤسسات */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-green-200">
              <AlertTriangle className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء التأمينات الاجتماعية (المؤسسات)</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.social_insurance_urgent_days}
                  onChange={(e) => setSettings({ ...settings, social_insurance_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.social_insurance_high_days}
                  onChange={(e) => setSettings({ ...settings, social_insurance_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Health Insurance Settings - التأمين الصحي للموظفين */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-purple-200">
              <AlertTriangle className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء التأمين الصحي (الموظفين)</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.health_insurance_urgent_days}
                  onChange={(e) => setSettings({ ...settings, health_insurance_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.health_insurance_high_days}
                  onChange={(e) => setSettings({ ...settings, health_insurance_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.health_insurance_medium_days}
                  onChange={(e) => setSettings({ ...settings, health_insurance_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Hired Worker Contract Settings - عقد أجير */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء عقد أجير</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.hired_worker_contract_urgent_days}
                  onChange={(e) => setSettings({ ...settings, hired_worker_contract_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.hired_worker_contract_high_days}
                  onChange={(e) => setSettings({ ...settings, hired_worker_contract_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.hired_worker_contract_medium_days}
                  onChange={(e) => setSettings({ ...settings, hired_worker_contract_medium_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Power Subscription Settings - اشتراك قوى */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-cyan-200">
              <AlertTriangle className="w-5 h-5 text-cyan-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء اشتراك قوى</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.power_subscription_urgent_days}
                  onChange={(e) => setSettings({ ...settings, power_subscription_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.power_subscription_high_days}
                  onChange={(e) => setSettings({ ...settings, power_subscription_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>

          {/* Moqeem Subscription Settings - اشتراك مقيم */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-teal-200">
              <AlertTriangle className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء اشتراك مقيم</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه طارئ (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.moqeem_subscription_urgent_days}
                  onChange={(e) => setSettings({ ...settings, moqeem_subscription_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية طارئة (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (High)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.moqeem_subscription_high_days}
                  onChange={(e) => setSettings({ ...settings, moqeem_subscription_high_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة (برتقالي)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه متوسط (Medium)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية متوسطة (أصفر)</p>
            </div>
          </div>
        </div>

        {/* Priority Examples */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-3">أمثلة على الأولويات:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-700">طارئ: منتهية أو خلال {settings.residence_urgent_days} أيام</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-700">عاجل: خلال {settings.residence_high_days} يوم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700">متوسط: خلال {settings.residence_medium_days} يوم</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 font-medium"
          >
            <Save className="w-5 h-5" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </div>
    </div>
  )
}

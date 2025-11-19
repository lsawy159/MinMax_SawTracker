import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Bell, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationSettingsData {
  residence_urgent_days: number
  residence_high_days: number
  residence_medium_days: number
  contract_urgent_days: number
  contract_high_days: number
  contract_medium_days: number
  // Company alerts settings
  commercial_reg_urgent_days: number
  commercial_reg_medium_days: number
  insurance_urgent_days: number
  insurance_medium_days: number
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
    commercial_reg_medium_days: 60,
    insurance_urgent_days: 30,
    insurance_medium_days: 60
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
        .single()

      if (data && data.setting_value) {
        setSettings(data.setting_value)
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
                تنبيه عاجل (Urgent)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة جداً (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عالي (High)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عالية (برتقالي)</p>
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
                تنبيه عاجل (Urgent)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة جداً (أحمر)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عالي (High)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عالية (برتقالي)</p>
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
                تنبيه عاجل (Urgent)
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
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة جداً (أحمر)</p>
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

          {/* Insurance Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-green-200">
              <AlertTriangle className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">إعدادات انتهاء التأمين</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تنبيه عاجل (Urgent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.insurance_urgent_days}
                  onChange={(e) => setSettings({ ...settings, insurance_urgent_days: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-center font-bold"
                />
                <span className="text-sm text-gray-600">أيام أو أقل</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">تنبيهات بأولوية عاجلة جداً (أحمر)</p>
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
                  value={settings.insurance_medium_days}
                  onChange={(e) => setSettings({ ...settings, insurance_medium_days: parseInt(e.target.value) || 0 })}
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
              <span className="text-gray-700">عاجل: منتهية أو خلال {settings.residence_urgent_days} أيام</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-700">عالي: خلال {settings.residence_high_days} يوم</span>
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

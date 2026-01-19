import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Shield, Save, RefreshCw } from 'lucide-react'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { getInputValue } from '@/utils/errorHandling'

interface SecuritySetting {
  id: string
  setting_key: string
  setting_value: string | number | boolean | Record<string, unknown> | null
  description: string
  setting_type?: 'text' | 'number' | 'boolean' | 'select' | 'time'
  options?: Array<string | number | { label: string; value: string | number }>
  updated_at: string
}

export default function SecuritySettingsManager() {
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([])
  const [settingsValues, setSettingsValues] = useState<Record<string, string | number | boolean | Record<string, unknown> | null>>({})
  const [savingSetting, setSavingSetting] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAddSettingModal, setShowAddSettingModal] = useState(false)
  const [isAddingSetting, setIsAddingSetting] = useState(false)
  const [newSetting, setNewSetting] = useState({
    setting_key: '',
    setting_value: '',
    description: '',
    setting_type: 'text' as 'text' | 'number' | 'boolean' | 'select' | 'time',
    options: ''
  })

  const loadSecuritySettings = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('security_settings')
        .select('*')
        .order('setting_key')

      if (error) throw error

      if (data) {
        const disallowedKeys = new Set([
          'admin_email',
          'backup_email_notifications',
          'backup_notifications_enabled',
          'backup_email_recipients'
        ])

        const filtered = data.filter(s => !disallowedKeys.has(s.setting_key))
        setSecuritySettings(filtered)
        const initialValues: Record<string, string | number | boolean | Record<string, unknown> | null> = {}
        filtered.forEach(setting => {
          if (typeof setting.setting_value === 'object' && setting.setting_value !== null) {
            initialValues[setting.setting_key] = JSON.stringify(setting.setting_value, null, 2)
          } else {
            initialValues[setting.setting_key] = setting.setting_value
          }
        })
        setSettingsValues(initialValues)
      }
    } catch (error) {
      console.error('Error loading security settings:', error)
      toast.error('فشل تحميل إعدادات الأمان')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSecuritySettings()
  }, [])

  const detectSettingType = (value: unknown): 'text' | 'number' | 'boolean' | 'select' | 'time' => {
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') {
      if (/^\d{2}:\d{2}$/.test(value)) return 'time'
      return 'text'
    }
    return 'text'
  }

  const updateSettingValue = (settingKey: string, value: string | number | boolean | Record<string, unknown> | null) => {
    setSettingsValues(prev => ({
      ...prev,
      [settingKey]: value
    }))
  }

  const renderSettingInput = (setting: SecuritySetting) => {
    const settingType = setting.setting_type || detectSettingType(setting.setting_value)
    const value = settingsValues[setting.setting_key] ?? setting.setting_value

    switch (settingType) {
      case 'text':
        if (typeof setting.setting_value === 'object' && setting.setting_value !== null) {
          return (
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="أدخل القيمة بتنسيق JSON..."
            />
          )
        }
        return (
          <input
            type="text"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateSettingValue(setting.setting_key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="mr-2 text-sm text-gray-600">
              {value ? 'مفعل' : 'معطل'}
            </span>
          </label>
        )

      case 'select':
        return (
          <select
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {setting.options && setting.options.length > 0 ? (
              setting.options.map((option: string | number | { label: string; value: string | number }) => {
                const optionValue = typeof option === 'object' ? option.value : option
                const optionLabel = typeof option === 'object' ? option.label : option
                return (
                  <option key={String(optionValue)} value={String(optionValue)}>{String(optionLabel)}</option>
                )
              })
            ) : (
              <option value="">اختر خياراً</option>
            )}
          </select>
        )

      case 'time':
        return (
          <input
            type="time"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      default:
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="أدخل القيمة..."
          />
        )
    }
  }

  const updateSecuritySetting = async (settingKey: string, newValue: string | number | boolean | Record<string, unknown> | null) => {
    setSavingSetting(settingKey)
    try {
      let finalValue = newValue
      if (typeof newValue === 'string' && (newValue.trim().startsWith('{') || newValue.trim().startsWith('['))) {
        try {
          finalValue = JSON.parse(newValue)
        } catch {
          finalValue = newValue
        }
      }

      const { error } = await supabase
        .from('security_settings')
        .update({
          setting_value: finalValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)

      if (error) throw error

      toast.success('تم تحديث الإعداد بنجاح')
      await loadSecuritySettings()
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('فشل في تحديث الإعداد')
    } finally {
      setSavingSetting(null)
    }
  }

  const addNewSetting = async () => {
    if (!newSetting.setting_key.trim()) {
      toast.error('يرجى إدخال مفتاح الإعداد')
      return
    }

    setIsAddingSetting(true)
    try {
      let finalValue: string | number | boolean | Record<string, unknown> | null = newSetting.setting_value

      if (newSetting.setting_type === 'boolean') {
        finalValue = newSetting.setting_value === 'true' || newSetting.setting_value === '1'
      } else if (newSetting.setting_type === 'number') {
        finalValue = parseFloat(newSetting.setting_value) || 0
      } else if (typeof newSetting.setting_value === 'string' && (newSetting.setting_value.trim().startsWith('{') || newSetting.setting_value.trim().startsWith('['))) {
        try {
          finalValue = JSON.parse(newSetting.setting_value)
        } catch {
          finalValue = newSetting.setting_value
        }
      }

      let optionsArray: string[] = []
      if (newSetting.setting_type === 'select' && newSetting.options) {
        optionsArray = newSetting.options.split(',').map(o => o.trim()).filter(o => o)
      }

      const { error } = await supabase
        .from('security_settings')
        .insert({
          setting_key: newSetting.setting_key.trim(),
          setting_value: finalValue,
          category: 'security',
          description: newSetting.description || null,
          setting_type: newSetting.setting_type,
          options: optionsArray.length > 0 ? optionsArray : null
        })

      if (error) throw error

      toast.success('تم إضافة الإعداد بنجاح')
      setShowAddSettingModal(false)
      setNewSetting({
        setting_key: '',
        setting_value: '',
        description: '',
        setting_type: 'text',
        options: ''
      })
      await loadSecuritySettings()
    } catch (error) {
      console.error('Error adding setting:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في إضافة الإعداد'
      toast.error(errorMessage)
    } finally {
      setIsAddingSetting(false)
    }
  }

  const formatDate = (dateString: string) => formatDateWithHijri(dateString, true)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">إعدادات الأمان</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddSettingModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            إضافة إعداد
          </button>
          <button
            onClick={loadSecuritySettings}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {securitySettings.map((setting) => (
          <div key={setting.id} className="border rounded-lg p-4 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{setting.setting_key.replace(/_/g, ' ')}</h3>
                {setting.description && (
                  <p className="text-gray-600 text-sm mt-1">{setting.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-500">
                آخر تحديث: <HijriDateDisplay date={setting.updated_at}>{formatDate(setting.updated_at)}</HijriDateDisplay>
              </span>
            </div>

            <div className="mb-3">
              {renderSettingInput(setting)}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => updateSecuritySetting(setting.setting_key, settingsValues[setting.setting_key] ?? setting.setting_value)}
                disabled={savingSetting === setting.setting_key || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {savingSetting === setting.setting_key ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {securitySettings.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="mb-4">لا توجد إعدادات أمان حالياً</p>
            <p className="text-sm text-gray-400 mb-4">يمكنك إضافة إعدادات جديدة من الزر أعلاه</p>
          </div>
        )}
      </div>

      {showAddSettingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">إضافة إعداد أمان جديد</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">مفتاح الإعداد (setting_key) *</label>
                <input
                  type="text"
                  value={newSetting.setting_key}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, setting_key: e.target.value }))}
                  placeholder="مثال: session_timeout_minutes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">نوع الإعداد *</label>
                <select
                  value={newSetting.setting_type}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, setting_type: e.target.value as 'text' | 'number' | 'boolean' | 'select' | 'time' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="text">نص (text)</option>
                  <option value="number">رقم (number)</option>
                  <option value="boolean">نعم/لا (boolean)</option>
                  <option value="time">وقت (time)</option>
                  <option value="select">قائمة (select)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">القيمة *</label>
                {newSetting.setting_type === 'boolean' ? (
                  <select
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="false">معطل (false)</option>
                    <option value="true">مفعل (true)</option>
                  </select>
                ) : newSetting.setting_type === 'time' ? (
                  <input
                    type="time"
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type={newSetting.setting_type === 'number' ? 'number' : 'text'}
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    placeholder={newSetting.setting_type === 'number' ? '0' : 'أدخل القيمة'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>

              {newSetting.setting_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium mb-2">الخيارات (مفصولة بفواصل)</label>
                  <input
                    type="text"
                    value={newSetting.options}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, options: e.target.value }))}
                    placeholder="مثال: option1, option2, option3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">الوصف (اختياري)</label>
                <textarea
                  value={newSetting.description}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف الإعداد"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowAddSettingModal(false)
                  setNewSetting({
                    setting_key: '',
                    setting_value: '',
                    description: '',
                    setting_type: 'text',
                    options: ''
                  })
                }}
                disabled={isAddingSetting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={addNewSetting}
                disabled={isAddingSetting || !newSetting.setting_key.trim() || !newSetting.setting_value}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAddingSetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    إضافة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

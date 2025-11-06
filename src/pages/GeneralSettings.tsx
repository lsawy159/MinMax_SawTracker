import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Settings, Globe, Shield, Palette, FileText, Bell, Clock, Database, Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface GeneralSetting {
  id?: string
  setting_key: string
  setting_value: any
  category: string
  description: string
  setting_type: 'text' | 'number' | 'boolean' | 'select' | 'time'
  options?: string[]
}

interface SettingsCategory {
  key: string
  label: string
  icon: any
  settings: GeneralSetting[]
}

export default function GeneralSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('system')
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، هذه الصفحة متاحة للمديرين فقط.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const settingsCategories: SettingsCategory[] = [
    {
      key: 'system',
      label: 'إعدادات النظام العامة',
      icon: Globe,
      settings: [
        {
          setting_key: 'system_timezone',
          setting_value: 'Asia/Riyadh',
          category: 'system',
          description: 'المنطقة الزمنية للنظام',
          setting_type: 'select',
          options: ['Asia/Riyadh', 'UTC', 'Asia/Dubai', 'Asia/Kuwait']
        },
        {
          setting_key: 'system_language',
          setting_value: 'ar',
          category: 'system',
          description: 'لغة النظام الافتراضية',
          setting_type: 'select',
          options: ['ar', 'en']
        },
        {
          setting_key: 'system_currency',
          setting_value: 'SAR',
          category: 'system',
          description: 'العملة الافتراضية',
          setting_type: 'select',
          options: ['SAR', 'USD', 'EUR', 'AED']
        },
        {
          setting_key: 'date_format',
          setting_value: 'yyyy-MM-dd',
          category: 'system',
          description: 'تنسيق التاريخ',
          setting_type: 'select',
          options: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy']
        },
        {
          setting_key: 'working_hours_start',
          setting_value: '08:00',
          category: 'system',
          description: 'بداية ساعات العمل',
          setting_type: 'time'
        },
        {
          setting_key: 'working_hours_end',
          setting_value: '17:00',
          category: 'system',
          description: 'نهاية ساعات العمل',
          setting_type: 'time'
        }
      ]
    },
    {
      key: 'backup',
      label: 'إعدادات النسخ الاحتياطية',
      icon: Database,
      settings: [
        {
          setting_key: 'backup_schedule',
          setting_value: 'daily',
          category: 'backup',
          description: 'جدولة النسخ الاحتياطية التلقائية',
          setting_type: 'select',
          options: ['disabled', 'daily', 'weekly', 'monthly']
        },
        {
          setting_key: 'backup_time',
          setting_value: '02:00',
          category: 'backup',
          description: 'وقت النسخ الاحتياطي اليومي',
          setting_type: 'time'
        },
        {
          setting_key: 'backup_retention_days',
          setting_value: 30,
          category: 'backup',
          description: 'عدد الأيام للاحتفاظ بالنسخ الاحتياطية',
          setting_type: 'number'
        },
        {
          setting_key: 'backup_compression',
          setting_value: true,
          category: 'backup',
          description: 'ضغط ملفات النسخ الاحتياطية',
          setting_type: 'boolean'
        },
        {
          setting_key: 'backup_notifications',
          setting_value: true,
          category: 'backup',
          description: 'تفعيل تنبيهات النسخ الاحتياطية',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'security',
      label: 'إعدادات الأمان المتقدمة',
      icon: Shield,
      settings: [
        {
          setting_key: 'password_min_length',
          setting_value: 8,
          category: 'security',
          description: 'الحد الأدنى لطول كلمة المرور',
          setting_type: 'number'
        },
        {
          setting_key: 'password_require_uppercase',
          setting_value: true,
          category: 'security',
          description: 'اشتراط أحرف كبيرة في كلمة المرور',
          setting_type: 'boolean'
        },
        {
          setting_key: 'password_require_numbers',
          setting_value: true,
          category: 'security',
          description: 'اشتراط أرقام في كلمة المرور',
          setting_type: 'boolean'
        },
        {
          setting_key: 'session_timeout_hours',
          setting_value: 8,
          category: 'security',
          description: 'مدة انتهاء الجلسة (بالساعات)',
          setting_type: 'number'
        },
        {
          setting_key: 'max_login_attempts',
          setting_value: 5,
          category: 'security',
          description: 'عدد محاولات تسجيل الدخول المسموحة',
          setting_type: 'number'
        },
        {
          setting_key: 'lockout_duration_minutes',
          setting_value: 30,
          category: 'security',
          description: 'مدة القفل بعد فشل تسجيل الدخول (بالدقائق)',
          setting_type: 'number'
        },
        {
          setting_key: 'enable_two_factor',
          setting_value: false,
          category: 'security',
          description: 'تفعيل المصادقة الثنائية',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'ui',
      label: 'إعدادات واجهة المستخدم',
      icon: Palette,
      settings: [
        {
          setting_key: 'ui_theme',
          setting_value: 'light',
          category: 'ui',
          description: 'المظهر العام',
          setting_type: 'select',
          options: ['light', 'dark', 'auto']
        },
        {
          setting_key: 'ui_primary_color',
          setting_value: 'blue',
          category: 'ui',
          description: 'اللون الأساسي',
          setting_type: 'select',
          options: ['blue', 'green', 'purple', 'red', 'orange', 'teal']
        },
        {
          setting_key: 'ui_font_size',
          setting_value: 'medium',
          category: 'ui',
          description: 'حجم الخط',
          setting_type: 'select',
          options: ['small', 'medium', 'large']
        },
        {
          setting_key: 'items_per_page',
          setting_value: 12,
          category: 'ui',
          description: 'عدد العناصر المعروضة في كل صفحة',
          setting_type: 'select',
          options: ['6', '12', '24', '48']
        },
        {
          setting_key: 'show_animations',
          setting_value: true,
          category: 'ui',
          description: 'تفعيل الحركات والانتقالات',
          setting_type: 'boolean'
        },
        {
          setting_key: 'compact_mode',
          setting_value: false,
          category: 'ui',
          description: 'الوضع المضغوط (عرض أكثر كثافة)',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'reports',
      label: 'إعدادات التقارير',
      icon: FileText,
      settings: [
        {
          setting_key: 'report_default_format',
          setting_value: 'pdf',
          category: 'reports',
          description: 'تنسيق التقارير الافتراضي',
          setting_type: 'select',
          options: ['pdf', 'excel', 'csv']
        },
        {
          setting_key: 'report_auto_schedule',
          setting_value: false,
          category: 'reports',
          description: 'تفعيل الجدولة التلقائية للتقارير',
          setting_type: 'boolean'
        },
        {
          setting_key: 'report_recipients',
          setting_value: '',
          category: 'reports',
          description: 'المستلمون الافتراضيون للتقارير (البريد الإلكتروني)',
          setting_type: 'text'
        },
        {
          setting_key: 'report_include_charts',
          setting_value: true,
          category: 'reports',
          description: 'تضمين الرسوم البيانية في التقارير',
          setting_type: 'boolean'
        },
        {
          setting_key: 'report_company_logo',
          setting_value: true,
          category: 'reports',
          description: 'إضافة شعار الشركة للتقارير',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'notifications',
      label: 'إعدادات الإشعارات المتقدمة',
      icon: Bell,
      settings: [
        {
          setting_key: 'notification_methods',
          setting_value: 'in_app',
          category: 'notifications',
          description: 'طرق الإرسال',
          setting_type: 'select',
          options: ['in_app', 'email', 'sms', 'all']
        },
        {
          setting_key: 'notification_frequency',
          setting_value: 'immediate',
          category: 'notifications',
          description: 'تكرار الإشعارات',
          setting_type: 'select',
          options: ['immediate', 'hourly', 'daily', 'weekly']
        },
        {
          setting_key: 'urgent_notifications',
          setting_value: true,
          category: 'notifications',
          description: 'تفعيل الإشعارات العاجلة',
          setting_type: 'boolean'
        },
        {
          setting_key: 'residence_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'التنبيه قبل انتهاء الإقامة (بالأيام)',
          setting_type: 'number'
        },
        {
          setting_key: 'contract_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'التنبيه قبل انتهاء العقد (بالأيام)',
          setting_type: 'number'
        },
        {
          setting_key: 'quiet_hours_start',
          setting_value: '22:00',
          category: 'notifications',
          description: 'بداية فترة الصمت (لا إشعارات)',
          setting_type: 'time'
        },
        {
          setting_key: 'quiet_hours_end',
          setting_value: '08:00',
          category: 'notifications',
          description: 'نهاية فترة الصمت',
          setting_type: 'time'
        }
      ]
    }
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')

      if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist
        console.error('Error loading settings:', error)
      }

      if (data) {
        const settingsMap: Record<string, any> = {}
        data.forEach(setting => {
          settingsMap[setting.setting_key] = setting.setting_value
        })
        setSettings(settingsMap)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      // تجميع جميع الإعدادات من جميع الفئات
      const allSettings: GeneralSetting[] = []
      settingsCategories.forEach(category => {
        category.settings.forEach(setting => {
          allSettings.push({
            ...setting,
            setting_value: settings[setting.setting_key] ?? setting.setting_value
          })
        })
      })

      // حذف الإعدادات الموجودة وإدراج الجديدة
      await supabase.from('general_settings').delete().neq('id', 0)

      const { error } = await supabase
        .from('general_settings')
        .insert(allSettings.map(setting => ({
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          category: setting.category,
          description: setting.description,
          setting_type: setting.setting_type,
          options: setting.options
        })))

      if (error) {
        console.error('Error saving settings:', error)
        toast.error('فشل حفظ الإعدادات')
        return
      }

      toast.success('تم حفظ الإعدادات بنجاح')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('حدث خطأ أثناء حفظ الإعدادات')
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings: Record<string, any> = {}
      settingsCategories.forEach(category => {
        category.settings.forEach(setting => {
          defaultSettings[setting.setting_key] = setting.setting_value
        })
      })
      setSettings(defaultSettings)
      toast.success('تم إعادة تعيين الإعدادات إلى القيم الافتراضية')
    }
  }

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const renderSettingInput = (setting: GeneralSetting) => {
    const value = settings[setting.setting_key] ?? setting.setting_value

    switch (setting.setting_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateSetting(setting.setting_key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="mr-2 text-sm text-gray-600">
              {Boolean(value) ? 'مفعل' : 'معطل'}
            </span>
          </label>
        )

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {setting.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  const activeCategory = settingsCategories.find(cat => cat.key === activeTab)

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            الإعدادات العامة الشاملة
          </h1>
          <div className="flex gap-3">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تعيين
            </button>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">فئات الإعدادات</h3>
              <nav className="space-y-2">
                {settingsCategories.map(category => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.key}
                      onClick={() => setActiveTab(category.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition ${
                        activeTab === category.key
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{category.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {activeCategory && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <activeCategory.icon className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold text-gray-900">{activeCategory.label}</h2>
                </div>

                <div className="space-y-6">
                  {activeCategory.settings.map(setting => (
                    <div key={setting.setting_key} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">
                            {setting.description}
                          </h3>
                          <p className="text-sm text-gray-500">
                            المفتاح: {setting.setting_key}
                          </p>
                        </div>
                        <div className="sm:w-64">
                          {renderSettingInput(setting)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  {settingsCategories.reduce((acc, cat) => acc + cat.settings.length, 0)}
                </h3>
                <p className="text-sm text-gray-600">إجمالي الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Database className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{settingsCategories.length}</h3>
                <p className="text-sm text-gray-600">فئات الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  {new Date().toLocaleDateString('ar-SA')}
                </h3>
                <p className="text-sm text-gray-600">آخر تحديث</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
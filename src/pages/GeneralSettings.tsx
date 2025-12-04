import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Settings, Globe, Shield, Palette, FileText, Bell, Clock, Database, Save, RefreshCw, Database as DatabaseIcon, TrendingUp, Edit3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import CustomFieldManager from '@/components/settings/CustomFieldManager'
import NotificationSettings from '@/components/settings/NotificationSettings'
import StatusSettings from '@/components/settings/StatusSettings'

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
  settings?: GeneralSetting[]
  component?: React.ComponentType
}

type TabType = 'system' | 'fields' | 'notifications' | 'status' | 'backup' | 'security' | 'ui' | 'reports' | 'advanced-notifications'

export default function GeneralSettings() {
  const { user } = useAuth()
  const { canView, canEdit } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('system')
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('adminSettings')
  const hasEditPermission = canEdit('adminSettings') || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

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

  useEffect(() => {
    if (user && hasViewPermission) {
      loadSettings()
    } else {
      setIsLoading(false)
    }
  }, [user, hasViewPermission])

  // Check if user has view permission
  if (!user || !hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const settingsCategories: SettingsCategory[] = [
    {
      key: 'system',
      label: 'إعدادات النظام الأساسية',
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
      key: 'fields',
      label: 'إدارة الحقول المخصصة',
      icon: Edit3,
      component: CustomFieldManager
    },
    {
      key: 'notifications',
      label: 'إعدادات التنبيهات',
      icon: Bell,
      component: NotificationSettings
    },
    {
      key: 'status',
      label: 'إعدادات الحالات',
      icon: TrendingUp,
      component: StatusSettings
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
          setting_value: 'excel',
          category: 'reports',
          description: 'تنسيق التقارير الافتراضي',
          setting_type: 'select',
          options: ['excel', 'csv']
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
      key: 'advanced-notifications',
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

  const saveSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }

    setIsSaving(true)
    try {
      // تجميع جميع الإعدادات من جميع الفئات
      const allSettings: GeneralSetting[] = []
      settingsCategories.forEach(category => {
        if (category.settings) {
          category.settings.forEach(setting => {
            allSettings.push({
              ...setting,
              setting_value: settings[setting.setting_key] ?? setting.setting_value
            })
          })
        }
      })

      // حذف جميع الإعدادات الموجودة قبل إدراج الجديدة
      // ملاحظة: لا يسمح PostgREST بالحذف بدون شرط، لذلك نستخدم قيمة UUID صالحة لا توجد فعلياً
      // لتفادي الخطأ السابق 400 (id=neq.0) بسبب مقارنة UUID بقيمة رقمية.
      const { error: deleteError } = await supabase
        .from('general_settings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (deleteError) {
        console.error('Error deleting existing settings:', deleteError)
        toast.error('فشل حذف الإعدادات الحالية قبل الحفظ')
        return
      }

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
        console.error('Error saving settings:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })

        // معالجة خاصة لخطأ التعارض (مثل تكرار setting_key)
        if (error.code === '23505') {
          toast.error('يوجد تعارض في مفاتيح الإعدادات. تأكد من عدم تكرار نفس الاسم أكثر من مرة.')
        } else {
          toast.error('فشل حفظ الإعدادات. يرجى المحاولة مرة أخرى.')
        }
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
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }

    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings: Record<string, any> = {}
      settingsCategories.forEach(category => {
        if (category.settings) {
          category.settings.forEach(setting => {
            defaultSettings[setting.setting_key] = setting.setting_value
          })
        }
      })
      setSettings(defaultSettings)
      toast.success('تم إعادة تعيين الإعدادات إلى القيم الافتراضية')
    }
  }

  const updateSetting = (key: string, value: any) => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const renderSettingInput = (setting: GeneralSetting) => {
    const value = settings[setting.setting_key] ?? setting.setting_value
    const disabled = !hasEditPermission

    switch (setting.setting_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, Number(e.target.value))}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateSetting(setting.setting_key, e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
            />
            <span className="mr-2 text-sm text-gray-600">
              {value ? 'مفعل' : 'معطل'}
            </span>
          </label>
        )

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">إعدادات النظام</h1>
                <p className="text-gray-600 mt-1">إدارة جميع إعدادات النظام والإعدادات العامة</p>
              </div>
            </div>
            {hasEditPermission && (
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
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4 text-lg">فئات الإعدادات</h3>
              <nav className="space-y-2">
                {settingsCategories.map(category => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.key}
                      onClick={() => setActiveTab(category.key as TabType)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-all duration-200 ${
                        activeTab === category.key
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-r-3 border-blue-500 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${activeTab === category.key ? 'text-blue-600' : 'text-gray-500'}`} />
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Tab Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <activeCategory.icon className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-900">{activeCategory.label}</h2>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeCategory.component ? (
                    <activeCategory.component />
                  ) : activeCategory.settings ? (
                    <div className="space-y-6">
                      {activeCategory.settings.map(setting => (
                        <div key={setting.setting_key} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 mb-1">
                                {setting.description}
                              </h3>
                              <p className="text-sm text-gray-500">
                                المفتاح: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{setting.setting_key}</code>
                              </p>
                            </div>
                            <div className="sm:w-64">
                              {renderSettingInput(setting)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <activeCategory.icon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p>لا توجد إعدادات متاحة في هذا القسم</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  {settingsCategories.reduce((acc, cat) => acc + (cat.settings?.length || 0), 0)}
                </h3>
                <p className="text-sm text-gray-600">إجمالي الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                <DatabaseIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{settingsCategories.length}</h3>
                <p className="text-sm text-gray-600">فئات الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
                <Clock className="w-6 h-6 text-white" />
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

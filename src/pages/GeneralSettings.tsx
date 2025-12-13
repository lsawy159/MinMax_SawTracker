import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Settings, Globe, Shield, FileText, Clock, Database, Save, RefreshCw, Database as DatabaseIcon, Edit3, Palette, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import { getInputValue } from '@/utils/errorHandling'
import CustomFieldManager from '@/components/settings/CustomFieldManager'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import BackupManagement from '@/components/settings/BackupManagement'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'

interface GeneralSetting {
  id?: string
  setting_key: string
  setting_value: string | number | boolean | Record<string, unknown> | null
  category: string
  description: string
  setting_type: 'text' | 'number' | 'boolean' | 'select' | 'time'
  options?: string[]
}

interface SettingsCategory {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  settings?: GeneralSetting[]
  component?: React.ComponentType
}

type TabType = 'system' | 'fields' | 'backup' | 'security' | 'ui' | 'reports' | 'advanced-notifications' | 'unified'

export default function GeneralSettings() {
  const { user } = useAuth()
  const { canView, canEdit } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('system')
  // Settings can be string, number, boolean, or object
  const [settings, setSettings] = useState<Record<string, string | number | boolean | Record<string, unknown> | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [resetTabKey, setResetTabKey] = useState<TabType | null>(null)

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('adminSettings')
  const hasEditPermission = canEdit('adminSettings') || user?.role === 'admin'
  // Reserved for future use: isAdmin
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const settingsMap: Record<string, string | number | boolean | Record<string, unknown> | null> = {}
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
      key: 'unified',
      label: 'الإعدادات المركزية (موحدة)',
      icon: Settings,
      component: UnifiedSettings
    },
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
      key: 'backup',
      label: 'إعدادات النسخ الاحتياطية',
      icon: Database,
      component: BackupManagement
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

  const saveActiveTabSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }

    const categoryToSave = settingsCategories.find(cat => cat.key === activeTab)
    if (!categoryToSave || !categoryToSave.settings) {
      // تبويبات بدون settings تستخدم مكونات مستقلة (مثل الحقول المخصصة/الإعدادات الموحدة)
      toast.info('هذا التبويب يدير الحفظ من داخل مكونه الخاص')
      return
    }

    setIsSaving(true)
    try {
      // إعدادات التبويب الحالي فقط
      const tabSettings = categoryToSave.settings.map(setting => ({
        ...setting,
        setting_value: settings[setting.setting_key] ?? setting.setting_value
      }))

      // حذف الإعدادات الخاصة بهذا التبويب فقط
      const { error: deleteError } = await supabase
        .from('general_settings')
        .delete()
        .eq('category', categoryToSave.key)

      if (deleteError) {
        console.error('Error deleting existing settings for tab:', deleteError)
        toast.error('فشل حذف إعدادات هذا التبويب قبل الحفظ')
        return
      }

      const { error } = await supabase
        .from('general_settings')
        .insert(tabSettings.map(setting => ({
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

        if (error.code === '23505') {
          toast.error('يوجد تعارض في مفاتيح الإعدادات. تأكد من عدم تكرار نفس الاسم أكثر من مرة.')
        } else {
          toast.error('فشل حفظ إعدادات هذا التبويب. يرجى المحاولة مرة أخرى.')
        }
        return
      }

      toast.success('تم حفظ إعدادات هذا التبويب بنجاح')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('حدث خطأ أثناء حفظ إعدادات التبويب')
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefaults = (tabKey: TabType) => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }
    setResetTabKey(tabKey)
    setShowConfirmReset(true)
  }

  const getChangedSettings = () => {
    if (!resetTabKey) return []
    
    const categoryToReset = settingsCategories.find(cat => cat.key === resetTabKey)
    
    // إذا كان التبويب لا يحتوي على settings array (يستخدم component)، أرجع مصفوفة فارغة
    if (!categoryToReset || !categoryToReset.settings) return []
    
    return categoryToReset.settings.filter(setting => {
      const currentValue = settings[setting.setting_key]
      const defaultValue = setting.setting_value
      return currentValue !== undefined && currentValue !== defaultValue
    }).map(setting => ({
      ...setting,
      currentValue: settings[setting.setting_key],
      defaultValue: setting.setting_value
    }))
  }

  const handleConfirmReset = () => {
    if (!resetTabKey) return
    
    const defaultSettings: Record<string, string | number | boolean | Record<string, unknown> | null> = {}
    const categoryToReset = settingsCategories.find(cat => cat.key === resetTabKey)
    
    if (categoryToReset && categoryToReset.settings) {
      categoryToReset.settings.forEach(setting => {
        defaultSettings[setting.setting_key] = setting.setting_value
      })
    }
    
    setSettings(prev => ({
      ...prev,
      ...defaultSettings
    }))
    
    const categoryLabel = categoryToReset?.label || 'الإعدادات'
    toast.success(`تم إعادة تعيين ${categoryLabel} إلى القيم الافتراضية`)
    setShowConfirmReset(false)
    setResetTabKey(null)
  }

  const updateSetting = (key: string, value: string | number | boolean | Record<string, unknown> | null) => {
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
            value={getInputValue(value)}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={getInputValue(value)}
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
            value={getInputValue(value)}
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
            value={getInputValue(value)}
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
      <div className="p-3">
        {/* Header */}
        <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">إعدادات النظام</h1>
                <p className="text-xs text-gray-600 mt-0.5">إدارة إعدادات النظام والإعدادات العامة</p>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 sticky top-3">
              <h3 className="font-semibold text-gray-900 mb-2 text-xs">فئات الإعدادات</h3>
              <nav className="space-y-1">
                {settingsCategories.map(category => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.key}
                      onClick={() => setActiveTab(category.key as TabType)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-right transition-all duration-200 text-xs ${
                        activeTab === category.key
                          ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${activeTab === category.key ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="font-medium">{category.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {activeCategory && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Tab Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <activeCategory.icon className="w-5 h-5 text-blue-600" />
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">{activeCategory.label}</h2>
                        {activeCategory.settings && (
                          <p className="text-xs text-gray-600">{activeCategory.settings.length} إعدادات</p>
                        )}
                      </div>
                    </div>
                    {hasEditPermission && activeCategory.settings && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resetToDefaults(activeTab)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition font-medium"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          استعادة
                        </button>
                        <button
                          onClick={saveActiveTabSettings}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'جاري...' : 'حفظ هذا التبويب'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-3">
                  {activeCategory.component ? (
                    <activeCategory.component />
                  ) : activeCategory.settings ? (
                    <div className="space-y-3">
                      {activeCategory.settings.map(setting => (
                        <div key={setting.setting_key} className="border-b border-gray-100 pb-2.5 last:border-b-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 text-sm mb-0.5">
                                {setting.description}
                              </h3>
                              <p className="text-xs text-gray-500">
                                المفتاح: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{setting.setting_key}</code>
                              </p>
                            </div>
                            <div className="sm:w-56">
                              {renderSettingInput(setting)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <activeCategory.icon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs">لا توجد إعدادات متاحة في هذا القسم</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-900">
                  {settingsCategories.reduce((acc, cat) => acc + (cat.settings?.length || 0), 0)}
                </h3>
                <p className="text-xs text-gray-600">إجمالي الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm border border-green-200 p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                <DatabaseIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-900">{settingsCategories.length}</h3>
                <p className="text-xs text-gray-600">فئات الإعدادات</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm border border-purple-200 p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-sm">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-900">
                  {new Date().toLocaleDateString('ar-SA')}
                </h3>
                <p className="text-xs text-gray-600">آخر تحديث</p>
              </div>
            </div>
          </div>
        </div>

        <ConfirmationDialog
          isOpen={showConfirmReset}
          onClose={() => {
            setShowConfirmReset(false)
            setResetTabKey(null)
          }}
          onConfirm={handleConfirmReset}
          title="إعادة تعيين الإعدادات"
          message={`سيتم إعادة تعيين ${settingsCategories.find(cat => cat.key === resetTabKey)?.label || 'الإعدادات'} إلى القيم الافتراضية`}
          confirmText="تأكيد"
          cancelText="إلغاء"
          isDangerous={true}
          icon="alert"
        >
          {getChangedSettings().length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-60 overflow-y-auto">
              <p className="text-sm font-semibold text-blue-900 mb-3">الإعدادات التي ستتغير:</p>
              <div className="space-y-2">
                {getChangedSettings().map(setting => (
                  <div key={setting.setting_key} className="bg-white border border-blue-100 rounded p-3">
                    <p className="text-sm font-medium text-gray-900">{setting.description}</p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <div>
                        <span className="text-gray-600">الحالي: </span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono">
                          {String(setting.currentValue)}
                        </code>
                      </div>
                      <div className="text-gray-400">←</div>
                      <div>
                        <code className="bg-green-100 px-2 py-1 rounded text-green-700 font-mono">
                          {String(setting.defaultValue)}
                        </code>
                        <span className="text-gray-600"> :الافتراضي</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {getChangedSettings().length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                ✓ جميع الإعدادات موجودة بالفعل على قيمها الافتراضية
              </p>
            </div>
          )}
        </ConfirmationDialog>
      </div>
    </Layout>
  )
}

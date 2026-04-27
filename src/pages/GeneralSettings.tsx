import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import {
  Settings,
  Globe,
  Shield,
  FileText,
  Clock,
  Save,
  RefreshCw,
  Database as DatabaseIcon,
  Palette,
  Bell,
  BarChart3,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import { getInputValue } from '@/utils/errorHandling'
import SessionsManager from '@/components/settings/SessionsManager'
import { BackupTab } from '@/components/settings/tabs/BackupTab'
import AuditDashboard from '@/components/settings/AuditDashboard'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'
import { PermissionsPanel } from '@/pages/Permissions'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

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
  description: string
  icon: React.ComponentType<{ className?: string }>
  settings?: GeneralSetting[]
  component?: React.ComponentType
}

type TabType =
  | 'system'
  | 'sessions'
  | 'audit'
  | 'permissions'
  | 'ui'
  | 'reports'
  | 'advanced-notifications'
  | 'alert-settings'
  | 'backup'

export default function GeneralSettings() {
  const { user } = useAuth()
  const { canView, canEdit } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('system')
  // Settings can be string, number, boolean, or object
  const [settings, setSettings] = useState<
    Record<string, string | number | boolean | Record<string, unknown> | null>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [resetTabKey, setResetTabKey] = useState<TabType | null>(null)

  const hasViewPermission = canView('adminSettings')
  const hasEditPermission = canEdit('adminSettings')

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key,setting_value')

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error)
      }

      if (data) {
        const settingsMap: Record<
          string,
          string | number | boolean | Record<string, unknown> | null
        > = {}
        data.forEach((row: { setting_key: string; setting_value: unknown }) => {
          const raw = row.setting_value
          // Values stored as JSON strings — parse back to native type
          if (typeof raw === 'string') {
            try {
              settingsMap[row.setting_key] = JSON.parse(raw)
            } catch {
              settingsMap[row.setting_key] = raw
            }
          } else {
            settingsMap[row.setting_key] = raw as string | number | boolean | null
          }
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

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!tab) {
      return
    }

    const allowedTabs: TabType[] = [
      'system',
      'sessions',
      'audit',
      'permissions',
      'ui',
      'reports',
      'advanced-notifications',
      'alert-settings',
      'backup',
    ]
    if (allowedTabs.includes(tab as TabType)) {
      setActiveTab(tab as TabType)
    }
  }, [searchParams])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Check if user has view permission
  if (!user || !hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">
              عذراً، ليس لديك صلاحية لعرض هذه الصفحة.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  const settingsCategories: SettingsCategory[] = [
    {
      key: 'system',
      label: 'إعدادات النظام الأساسية',
      description: 'إعدادات المنطقة الزمنية واللغة والعملة وتنسيق التاريخ وساعات العمل. تُحفظ في قاعدة البيانات وتُطبَّق على كامل النظام.',
      icon: Globe,
      settings: [
        {
          setting_key: 'system_timezone',
          setting_value: 'Asia/Riyadh',
          category: 'system',
          description: 'المنطقة الزمنية للنظام',
          setting_type: 'select',
          options: ['Asia/Riyadh', 'UTC', 'Asia/Dubai', 'Asia/Kuwait'],
        },
        {
          setting_key: 'system_language',
          setting_value: 'ar',
          category: 'system',
          description: 'لغة النظام الافتراضية',
          setting_type: 'select',
          options: ['ar', 'en'],
        },
        {
          setting_key: 'system_currency',
          setting_value: 'SAR',
          category: 'system',
          description: 'العملة الافتراضية',
          setting_type: 'select',
          options: ['SAR', 'USD', 'EUR', 'AED'],
        },
        {
          setting_key: 'date_format',
          setting_value: 'yyyy-MM-dd',
          category: 'system',
          description: 'تنسيق التاريخ',
          setting_type: 'select',
          options: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy'],
        },
        {
          setting_key: 'working_hours_start',
          setting_value: '08:00',
          category: 'system',
          description: 'بداية ساعات العمل',
          setting_type: 'time',
        },
        {
          setting_key: 'working_hours_end',
          setting_value: '17:00',
          category: 'system',
          description: 'نهاية ساعات العمل',
          setting_type: 'time',
        },
      ],
    },
    {
      key: 'backup',
      label: 'النسخ الاحتياطية',
      description: 'جدولة النسخ الاحتياطي التلقائي وعرض سجل العمليات السابقة وتحميل النسخ المحفوظة.',
      icon: DatabaseIcon,
      component: BackupTab,
    },
    {
      key: 'sessions',
      label: 'إدارة الجلسات النشطة',
      description: 'عرض جميع الجلسات المفتوحة حالياً لجميع المستخدمين وإمكانية إنهاء أي جلسة عن بُعد.',
      icon: Users,
      component: SessionsManager,
    },
    {
      key: 'audit',
      label: 'لوحة المراجعة والتدقيق',
      description: 'سجل كامل لكل عمليات الإضافة والتعديل والحذف في النظام مع التوقيت والمستخدم المسؤول.',
      icon: BarChart3,
      component: AuditDashboard,
    },
    {
      key: 'permissions',
      label: 'إدارة الصلاحيات',
      description: 'تحديد صلاحيات كل مستخدم وتعيين الأدوار (مدير / مسؤول / مستخدم) والتحكم في ما يستطيع رؤيته وتعديله.',
      icon: Shield,
      component: PermissionsPanel,
    },
    {
      key: 'ui',
      label: 'إعدادات واجهة المستخدم',
      description: 'تخصيص مظهر التطبيق: الثيم، حجم الخط، كثافة العرض، وعدد العناصر في كل صفحة.',
      icon: Palette,
      settings: [
        {
          setting_key: 'ui_theme',
          setting_value: 'light',
          category: 'ui',
          description: 'المظهر العام',
          setting_type: 'select',
          options: ['light', 'dark', 'auto'],
        },
        {
          setting_key: 'ui_primary_color',
          setting_value: 'blue',
          category: 'ui',
          description: 'اللون الأساسي',
          setting_type: 'select',
          options: ['blue', 'green', 'purple', 'red', 'orange', 'teal'],
        },
        {
          setting_key: 'ui_font_size',
          setting_value: 'medium',
          category: 'ui',
          description: 'حجم الخط',
          setting_type: 'select',
          options: ['small', 'medium', 'large'],
        },
        {
          setting_key: 'items_per_page',
          setting_value: 12,
          category: 'ui',
          description: 'عدد العناصر المعروضة في كل صفحة',
          setting_type: 'select',
          options: ['6', '12', '24', '48'],
        },
        {
          setting_key: 'show_animations',
          setting_value: true,
          category: 'ui',
          description: 'تفعيل الحركات والانتقالات',
          setting_type: 'boolean',
        },
        {
          setting_key: 'compact_mode',
          setting_value: false,
          category: 'ui',
          description: 'الوضع المضغوط (عرض أكثر كثافة)',
          setting_type: 'boolean',
        },
      ],
    },
    {
      key: 'reports',
      label: 'إعدادات التقارير',
      description: 'تحديد تنسيق التقارير الافتراضي (Excel/CSV)، جدولة الإرسال التلقائي للبريد الإلكتروني، وإضافة شعار الشركة.',
      icon: FileText,
      settings: [
        {
          setting_key: 'report_default_format',
          setting_value: 'excel',
          category: 'reports',
          description: 'تنسيق التقارير الافتراضي',
          setting_type: 'select',
          options: ['excel', 'csv'],
        },
        {
          setting_key: 'report_auto_schedule',
          setting_value: false,
          category: 'reports',
          description: 'تفعيل الجدولة التلقائية للتقارير',
          setting_type: 'boolean',
        },
        {
          setting_key: 'report_recipients',
          setting_value: '',
          category: 'reports',
          description:
            'المستلمون الافتراضيون للتقارير (البريد الإلكتروني)',
          setting_type: 'text',
        },
        {
          setting_key: 'report_include_charts',
          setting_value: true,
          category: 'reports',
          description: 'تضمين الرسوم البيانية في التقارير',
          setting_type: 'boolean',
        },
        {
          setting_key: 'report_company_logo',
          setting_value: true,
          category: 'reports',
          description: 'إضافة شعار الشركة للتقارير',
          setting_type: 'boolean',
        },
      ],
    },
    {
      key: 'advanced-notifications',
      label: 'إعدادات الإشعارات المتقدمة',
      description: 'التحكم في طريقة الإشعارات (داخل التطبيق / بريد / SMS)، وتحديد عدد الأيام للتنبيه قبل انتهاء الإقامات والعقود، وساعات الصمت.',
      icon: Bell,
      settings: [
        {
          setting_key: 'notification_methods',
          setting_value: 'in_app',
          category: 'notifications',
          description: 'طرق الإرسال',
          setting_type: 'select',
          options: ['in_app', 'email', 'sms', 'all'],
        },
        {
          setting_key: 'notification_frequency',
          setting_value: 'immediate',
          category: 'notifications',
          description: 'تكرار الإشعارات',
          setting_type: 'select',
          options: ['immediate', 'hourly', 'daily', 'weekly'],
        },
        {
          setting_key: 'urgent_notifications',
          setting_value: true,
          category: 'notifications',
          description: 'تفعيل الإشعارات العاجلة',
          setting_type: 'boolean',
        },
        {
          setting_key: 'residence_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'التنبيه قبل انتهاء الإقامة (بالأيام)',
          setting_type: 'number',
        },
        {
          setting_key: 'contract_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'التنبيه قبل انتهاء العقد (بالأيام)',
          setting_type: 'number',
        },
        {
          setting_key: 'quiet_hours_start',
          setting_value: '22:00',
          category: 'notifications',
          description: 'بداية فترة الصمت (لا إشعارات)',
          setting_type: 'time',
        },
        {
          setting_key: 'quiet_hours_end',
          setting_value: '08:00',
          category: 'notifications',
          description: 'نهاية فترة الصمت',
          setting_type: 'time',
        },
      ],
    },
    {
      key: 'alert-settings',
      label: 'إعدادات التنبيهات',
      description: 'تخصيص حدود التنبيهات وألوانها وحالاتها: ما يُعتبر تنبيهاً حرجاً، والألوان المرتبطة بكل حالة.',
      icon: AlertTriangle,
      component: UnifiedSettings,
    },
  ]

  const saveActiveTabSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }

    const categoryToSave = settingsCategories.find((cat) => cat.key === activeTab)
    if (!categoryToSave || !categoryToSave.settings) {
      // تبويبات بدون settings تستخدم مكونات مستقلة (مثل الحقول المخصصة/الإعدادات الموحدة)
      toast.info('هذا التبويب يدير الحفظ من داخل مكونه الخاص')
      return
    }

    setIsSaving(true)
    try {
      const rows = categoryToSave.settings.map((setting) => {
        const currentValue = settings[setting.setting_key] ?? setting.setting_value
        return {
          setting_key: setting.setting_key,
          setting_value: JSON.stringify(currentValue),
          category: setting.category,
          description: setting.description,
          setting_type: setting.setting_type,
        }
      })

      const { error } = await supabase
        .from('system_settings')
        .upsert(rows, { onConflict: 'setting_key' })

      if (error) {
        console.error('Error saving settings:', error)
        toast.error('فشل حفظ الإعدادات. يرجى المحاولة مرة أخرى.')
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

    const categoryToReset = settingsCategories.find((cat) => cat.key === resetTabKey)

    // إذا كان التبويب لا يحتوي على settings array (يستخدم component)، أرجع مصفوفة فارغة
    if (!categoryToReset || !categoryToReset.settings) return []

    return categoryToReset.settings
      .filter((setting) => {
        const currentValue = settings[setting.setting_key]
        const defaultValue = setting.setting_value
        return currentValue !== undefined && currentValue !== defaultValue
      })
      .map((setting) => ({
        ...setting,
        currentValue: settings[setting.setting_key],
        defaultValue: setting.setting_value,
      }))
  }

  const handleConfirmReset = () => {
    if (!resetTabKey) return

    const defaultSettings: Record<
      string,
      string | number | boolean | Record<string, unknown> | null
    > = {}
    const categoryToReset = settingsCategories.find((cat) => cat.key === resetTabKey)

    if (categoryToReset && categoryToReset.settings) {
      categoryToReset.settings.forEach((setting) => {
        defaultSettings[setting.setting_key] = setting.setting_value
      })
    }

    setSettings((prev) => ({
      ...prev,
      ...defaultSettings,
    }))

    const categoryLabel = categoryToReset?.label || 'الإعدادات'
    toast.success(
      `تم إعادة تعيين ${categoryLabel} إلى القيم الافتراضية`
    )
    setShowConfirmReset(false)
    setResetTabKey(null)
  }

  const updateSetting = (
    key: string,
    value: string | number | boolean | Record<string, unknown> | null
  ) => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل الإعدادات')
      return
    }
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const renderSettingInput = (setting: GeneralSetting) => {
    const value = settings[setting.setting_key] ?? setting.setting_value
    const disabled = !hasEditPermission

    switch (setting.setting_type) {
      case 'text':
        return (
          <Input
            type="text"
            value={getInputValue(value)}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            disabled={disabled}
            className="disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={getInputValue(value)}
            onChange={(e) => updateSetting(setting.setting_key, Number(e.target.value))}
            disabled={disabled}
            className="disabled:cursor-not-allowed disabled:bg-gray-100"
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
              className="h-4 w-4 rounded border-border-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
            />
            <span className="mr-2 text-sm text-gray-600">{value ? 'مفعل' : 'معطل'}</span>
          </label>
        )

      case 'select':
        return (
          <Select
            value={getInputValue(value)}
            onValueChange={(selectedValue) => updateSetting(setting.setting_key, selectedValue)}
            disabled={disabled}
          >
            <SelectTrigger className="disabled:cursor-not-allowed disabled:bg-gray-100">
              <SelectValue placeholder="اختر قيمة" />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => {
                if (option === null || option === undefined) {
                  return null
                }

                if (typeof option === 'object') {
                  const optionObject = option as { label?: string; value?: unknown } | null
                  if (!optionObject) {
                    return null
                  }

                  const optionValue = String(optionObject.value ?? '')
                  const optionLabel = String(optionObject.label ?? optionValue)

                  return (
                    <SelectItem key={optionValue} value={optionValue}>
                      {optionLabel}
                    </SelectItem>
                  )
                }

                return (
                  <SelectItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )

      case 'time':
        return (
          <Input
            type="time"
            value={getInputValue(value)}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            disabled={disabled}
            className="disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        )

      default:
        return null
    }
  }

  const activeCategory = settingsCategories.find((cat) => cat.key === activeTab)
  const shouldBlockForLoading = isLoading && Boolean(activeCategory?.settings)

  if (shouldBlockForLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <div className="app-icon-chip p-2">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">إعدادات النظام</h1>
            <p className="mt-0.5 text-xs text-gray-600">
              إدارة إعدادات النظام والإعدادات العامة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="app-panel sticky top-3 p-2.5">
              <h3 className="font-semibold text-gray-900 mb-2 text-xs">
                فئات الإعدادات
              </h3>
              <nav className="space-y-1">
                {settingsCategories.map((category) => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.key}
                      onClick={() => handleTabChange(category.key as TabType)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-right text-xs transition-all duration-200 ${
                        activeTab === category.key
                          ? 'bg-primary/15 text-foreground shadow-soft ring-1 ring-primary/40'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${activeTab === category.key ? 'text-foreground' : 'text-gray-500'}`}
                      />
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
              <div className="app-panel overflow-hidden">
                {/* Tab Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-border-200 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <activeCategory.icon className="w-5 h-5 text-foreground" />
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">
                          {activeCategory.label}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5 max-w-lg leading-relaxed">
                          {activeCategory.description}
                        </p>
                      </div>
                    </div>
                    {hasEditPermission && activeCategory.settings && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => resetToDefaults(activeTab)}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          استعادة
                        </Button>
                        <Button
                          onClick={saveActiveTabSettings}
                          disabled={isSaving}
                          size="sm"
                          className="text-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'جاري...' : 'حفظ هذا التبويب'}
                        </Button>
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
                      {activeCategory.settings.map((setting) => (
                        <div
                          key={setting.setting_key}
                          className="border-b border-border-100 pb-2.5 last:border-b-0 last:pb-0"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 text-sm mb-0.5">
                                {setting.description}
                              </h3>
                              <p className="text-xs text-gray-500">
                                المفتاح:{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                  {setting.setting_key}
                                </code>
                              </p>
                            </div>
                            <div className="sm:w-56">{renderSettingInput(setting)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <activeCategory.icon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs">
                        لا توجد إعدادات متاحة في هذا القسم
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="app-panel border-primary/30 bg-primary/10 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-foreground shadow-sm">
                <Settings className="w-4 h-4" />
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

          <div className="app-panel border-border-200 bg-surface-secondary-50 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary-800 shadow-sm">
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
          message={`سيتم إعادة تعيين ${settingsCategories.find((cat) => cat.key === resetTabKey)?.label || 'الإعدادات'} إلى القيم الافتراضية`}
          confirmText="تأكيد"
          cancelText="إلغاء"
          isDangerous={true}
          icon="alert"
        >
          {getChangedSettings().length > 0 && (
            <div className="app-info-block max-h-60 overflow-y-auto rounded-lg p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">
                الإعدادات التي ستتغير:
              </p>
              <div className="space-y-2">
                {getChangedSettings().map((setting) => (
                  <div
                    key={setting.setting_key}
                    className="rounded border border-primary/20 bg-surface p-3"
                  >
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
            <div className="bg-gray-50 border border-border-200 rounded-lg p-4 text-center">
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

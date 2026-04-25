import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Settings, Globe, Shield, FileText, Clock, Save, RefreshCw, Database as DatabaseIcon, Edit3, Palette, Bell, BarChart3, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import { getInputValue } from '@/utils/errorHandling'
import CustomFieldManager from '@/components/settings/CustomFieldManager'
import SessionsManager from '@/components/settings/SessionsManager'
import AuditDashboard from '@/components/settings/AuditDashboard'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'
import { PermissionsPanel } from '@/pages/Permissions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

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

type TabType = 'system' | 'fields' | 'sessions' | 'audit' | 'permissions' | 'ui' | 'reports' | 'advanced-notifications' | 'unified'

export default function GeneralSettings() {
  const { user } = useAuth()
  const { canView, canEdit } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('system')
  // Settings can be string, number, boolean, or object
  const [settings, setSettings] = useState<Record<string, string | number | boolean | Record<string, unknown> | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [resetTabKey, setResetTabKey] = useState<TabType | null>(null)

  // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† طµظ„ط§ط­ظٹط© ط§ظ„ط¹ط±ط¶
  const hasViewPermission = canView('adminSettings')
  const hasEditPermission = canEdit('adminSettings')

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('general_settings')
        .select('id,setting_key,setting_value,created_at,updated_at')

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

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!tab) {
      return
    }

    const allowedTabs: TabType[] = ['system', 'fields', 'sessions', 'audit', 'permissions', 'ui', 'reports', 'advanced-notifications', 'unified']
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ط؛ظٹط± ظ…طµط±ط­</h2>
            <p className="text-gray-600">ط¹ط°ط±ط§ظ‹طŒ ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„ط¹ط±ط¶ ظ‡ط°ظ‡ ط§ظ„طµظپط­ط©.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const settingsCategories: SettingsCategory[] = [
    {
      key: 'system',
      label: 'ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط£ط³ط§ط³ظٹط©',
      icon: Globe,
      settings: [
        {
          setting_key: 'system_timezone',
          setting_value: 'Asia/Riyadh',
          category: 'system',
          description: 'ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ط²ظ…ظ†ظٹط© ظ„ظ„ظ†ط¸ط§ظ…',
          setting_type: 'select',
          options: ['Asia/Riyadh', 'UTC', 'Asia/Dubai', 'Asia/Kuwait']
        },
        {
          setting_key: 'system_language',
          setting_value: 'ar',
          category: 'system',
          description: 'ظ„ط؛ط© ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©',
          setting_type: 'select',
          options: ['ar', 'en']
        },
        {
          setting_key: 'system_currency',
          setting_value: 'SAR',
          category: 'system',
          description: 'ط§ظ„ط¹ظ…ظ„ط© ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©',
          setting_type: 'select',
          options: ['SAR', 'USD', 'EUR', 'AED']
        },
        {
          setting_key: 'date_format',
          setting_value: 'yyyy-MM-dd',
          category: 'system',
          description: 'طھظ†ط³ظٹظ‚ ط§ظ„طھط§ط±ظٹط®',
          setting_type: 'select',
          options: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy']
        },
        {
          setting_key: 'working_hours_start',
          setting_value: '08:00',
          category: 'system',
          description: 'ط¨ط¯ط§ظٹط© ط³ط§ط¹ط§طھ ط§ظ„ط¹ظ…ظ„',
          setting_type: 'time'
        },
        {
          setting_key: 'working_hours_end',
          setting_value: '17:00',
          category: 'system',
          description: 'ظ†ظ‡ط§ظٹط© ط³ط§ط¹ط§طھ ط§ظ„ط¹ظ…ظ„',
          setting_type: 'time'
        }
      ]
    },
    {
      key: 'fields',
      label: 'ط¥ط¯ط§ط±ط© ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط®طµطµط©',
      icon: Edit3,
      component: CustomFieldManager
    },

    {
      key: 'sessions',
      label: 'ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ„ط³ط§طھ ط§ظ„ظ†ط´ط·ط©',
      icon: Users,
      component: SessionsManager
    },
    {
      key: 'audit',
      label: 'ظ„ظˆط­ط© ط§ظ„ظ…ط±ط§ط¬ط¹ط© ظˆط§ظ„طھط¯ظ‚ظٹظ‚',
      icon: BarChart3,
      component: AuditDashboard
    },
    {
      key: 'permissions',
      label: 'ط¥ط¯ط§ط±ط© ط§ظ„طµظ„ط§ط­ظٹط§طھ',
      icon: Shield,
      component: PermissionsPanel
    },
    {
      key: 'ui',
      label: 'ط¥ط¹ط¯ط§ط¯ط§طھ ظˆط§ط¬ظ‡ط© ط§ظ„ظ…ط³طھط®ط¯ظ…',
      icon: Palette,
      settings: [
        {
          setting_key: 'ui_theme',
          setting_value: 'light',
          category: 'ui',
          description: 'ط§ظ„ظ…ط¸ظ‡ط± ط§ظ„ط¹ط§ظ…',
          setting_type: 'select',
          options: ['light', 'dark', 'auto']
        },
        {
          setting_key: 'ui_primary_color',
          setting_value: 'blue',
          category: 'ui',
          description: 'ط§ظ„ظ„ظˆظ† ط§ظ„ط£ط³ط§ط³ظٹ',
          setting_type: 'select',
          options: ['blue', 'green', 'purple', 'red', 'orange', 'teal']
        },
        {
          setting_key: 'ui_font_size',
          setting_value: 'medium',
          category: 'ui',
          description: 'ط­ط¬ظ… ط§ظ„ط®ط·',
          setting_type: 'select',
          options: ['small', 'medium', 'large']
        },
        {
          setting_key: 'items_per_page',
          setting_value: 12,
          category: 'ui',
          description: 'ط¹ط¯ط¯ ط§ظ„ط¹ظ†ط§طµط± ط§ظ„ظ…ط¹ط±ظˆط¶ط© ظپظٹ ظƒظ„ طµظپط­ط©',
          setting_type: 'select',
          options: ['6', '12', '24', '48']
        },
        {
          setting_key: 'show_animations',
          setting_value: true,
          category: 'ui',
          description: 'طھظپط¹ظٹظ„ ط§ظ„ط­ط±ظƒط§طھ ظˆط§ظ„ط§ظ†طھظ‚ط§ظ„ط§طھ',
          setting_type: 'boolean'
        },
        {
          setting_key: 'compact_mode',
          setting_value: false,
          category: 'ui',
          description: 'ط§ظ„ظˆط¶ط¹ ط§ظ„ظ…ط¶ط؛ظˆط· (ط¹ط±ط¶ ط£ظƒط«ط± ظƒط«ط§ظپط©)',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'reports',
      label: 'ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„طھظ‚ط§ط±ظٹط±',
      icon: FileText,
      settings: [
        {
          setting_key: 'report_default_format',
          setting_value: 'excel',
          category: 'reports',
          description: 'طھظ†ط³ظٹظ‚ ط§ظ„طھظ‚ط§ط±ظٹط± ط§ظ„ط§ظپطھط±ط§ط¶ظٹ',
          setting_type: 'select',
          options: ['excel', 'csv']
        },
        {
          setting_key: 'report_auto_schedule',
          setting_value: false,
          category: 'reports',
          description: 'طھظپط¹ظٹظ„ ط§ظ„ط¬ط¯ظˆظ„ط© ط§ظ„طھظ„ظ‚ط§ط¦ظٹط© ظ„ظ„طھظ‚ط§ط±ظٹط±',
          setting_type: 'boolean'
        },
        {
          setting_key: 'report_recipients',
          setting_value: '',
          category: 'reports',
          description: 'ط§ظ„ظ…ط³طھظ„ظ…ظˆظ† ط§ظ„ط§ظپطھط±ط§ط¶ظٹظˆظ† ظ„ظ„طھظ‚ط§ط±ظٹط± (ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ)',
          setting_type: 'text'
        },
        {
          setting_key: 'report_include_charts',
          setting_value: true,
          category: 'reports',
          description: 'طھط¶ظ…ظٹظ† ط§ظ„ط±ط³ظˆظ… ط§ظ„ط¨ظٹط§ظ†ظٹط© ظپظٹ ط§ظ„طھظ‚ط§ط±ظٹط±',
          setting_type: 'boolean'
        },
        {
          setting_key: 'report_company_logo',
          setting_value: true,
          category: 'reports',
          description: 'ط¥ط¶ط§ظپط© ط´ط¹ط§ط± ط§ظ„ط´ط±ظƒط© ظ„ظ„طھظ‚ط§ط±ظٹط±',
          setting_type: 'boolean'
        }
      ]
    },
    {
      key: 'advanced-notifications',
      label: 'ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ…طھظ‚ط¯ظ…ط©',
      icon: Bell,
      settings: [
        {
          setting_key: 'notification_methods',
          setting_value: 'in_app',
          category: 'notifications',
          description: 'ط·ط±ظ‚ ط§ظ„ط¥ط±ط³ط§ظ„',
          setting_type: 'select',
          options: ['in_app', 'email', 'sms', 'all']
        },
        {
          setting_key: 'notification_frequency',
          setting_value: 'immediate',
          category: 'notifications',
          description: 'طھظƒط±ط§ط± ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ',
          setting_type: 'select',
          options: ['immediate', 'hourly', 'daily', 'weekly']
        },
        {
          setting_key: 'urgent_notifications',
          setting_value: true,
          category: 'notifications',
          description: 'طھظپط¹ظٹظ„ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط©',
          setting_type: 'boolean'
        },
        {
          setting_key: 'residence_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'ط§ظ„طھظ†ط¨ظٹظ‡ ظ‚ط¨ظ„ ط§ظ†طھظ‡ط§ط، ط§ظ„ط¥ظ‚ط§ظ…ط© (ط¨ط§ظ„ط£ظٹط§ظ…)',
          setting_type: 'number'
        },
        {
          setting_key: 'contract_expiry_days',
          setting_value: 30,
          category: 'notifications',
          description: 'ط§ظ„طھظ†ط¨ظٹظ‡ ظ‚ط¨ظ„ ط§ظ†طھظ‡ط§ط، ط§ظ„ط¹ظ‚ط¯ (ط¨ط§ظ„ط£ظٹط§ظ…)',
          setting_type: 'number'
        },
        {
          setting_key: 'quiet_hours_start',
          setting_value: '22:00',
          category: 'notifications',
          description: 'ط¨ط¯ط§ظٹط© ظپطھط±ط© ط§ظ„طµظ…طھ (ظ„ط§ ط¥ط´ط¹ط§ط±ط§طھ)',
          setting_type: 'time'
        },
        {
          setting_key: 'quiet_hours_end',
          setting_value: '08:00',
          category: 'notifications',
          description: 'ظ†ظ‡ط§ظٹط© ظپطھط±ط© ط§ظ„طµظ…طھ',
          setting_type: 'time'
        }
      ]
    }
  ]

  const saveActiveTabSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„طھط¹ط¯ظٹظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ')
      return
    }

    const categoryToSave = settingsCategories.find(cat => cat.key === activeTab)
    if (!categoryToSave || !categoryToSave.settings) {
      // طھط¨ظˆظٹط¨ط§طھ ط¨ط¯ظˆظ† settings طھط³طھط®ط¯ظ… ظ…ظƒظˆظ†ط§طھ ظ…ط³طھظ‚ظ„ط© (ظ…ط«ظ„ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط®طµطµط©/ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ…ظˆط­ط¯ط©)
      toast.info('ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨ ظٹط¯ظٹط± ط§ظ„ط­ظپط¸ ظ…ظ† ط¯ط§ط®ظ„ ظ…ظƒظˆظ†ظ‡ ط§ظ„ط®ط§طµ')
      return
    }

    setIsSaving(true)
    try {
      // ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„طھط¨ظˆظٹط¨ ط§ظ„ط­ط§ظ„ظٹ ظپظ‚ط·
      const tabSettings = categoryToSave.settings.map(setting => ({
        ...setting,
        setting_value: settings[setting.setting_key] ?? setting.setting_value
      }))

      // ط­ط°ظپ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط®ط§طµط© ط¨ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨ ظپظ‚ط·
      const { error: deleteError } = await supabase
        .from('general_settings')
        .delete()
        .eq('category', categoryToSave.key)

      if (deleteError) {
        console.error('Error deleting existing settings for tab:', deleteError)
        toast.error('ظپط´ظ„ ط­ط°ظپ ط¥ط¹ط¯ط§ط¯ط§طھ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨ ظ‚ط¨ظ„ ط§ظ„ط­ظپط¸')
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
          toast.error('ظٹظˆط¬ط¯ طھط¹ط§ط±ط¶ ظپظٹ ظ…ظپط§طھظٹط­ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ. طھط£ظƒط¯ ظ…ظ† ط¹ط¯ظ… طھظƒط±ط§ط± ظ†ظپط³ ط§ظ„ط§ط³ظ… ط£ظƒط«ط± ظ…ظ† ظ…ط±ط©.')
        } else {
          toast.error('ظپط´ظ„ ط­ظپط¸ ط¥ط¹ط¯ط§ط¯ط§طھ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨. ظٹط±ط¬ظ‰ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط±ط© ط£ط®ط±ظ‰.')
        }
        return
      }

      toast.success('طھظ… ط­ظپط¸ ط¥ط¹ط¯ط§ط¯ط§طھ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨ ط¨ظ†ط¬ط§ط­')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ظپط¸ ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„طھط¨ظˆظٹط¨')
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefaults = (tabKey: TabType) => {
    if (!hasEditPermission) {
      toast.error('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„طھط¹ط¯ظٹظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ')
      return
    }
    setResetTabKey(tabKey)
    setShowConfirmReset(true)
  }

  const getChangedSettings = () => {
    if (!resetTabKey) return []
    
    const categoryToReset = settingsCategories.find(cat => cat.key === resetTabKey)
    
    // ط¥ط°ط§ ظƒط§ظ† ط§ظ„طھط¨ظˆظٹط¨ ظ„ط§ ظٹط­طھظˆظٹ ط¹ظ„ظ‰ settings array (ظٹط³طھط®ط¯ظ… component)طŒ ط£ط±ط¬ط¹ ظ…طµظپظˆظپط© ظپط§ط±ط؛ط©
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
    
    const categoryLabel = categoryToReset?.label || 'ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ'
    toast.success(`طھظ… ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ${categoryLabel} ط¥ظ„ظ‰ ط§ظ„ظ‚ظٹظ… ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©`)
    setShowConfirmReset(false)
    setResetTabKey(null)
  }

  const updateSetting = (key: string, value: string | number | boolean | Record<string, unknown> | null) => {
    if (!hasEditPermission) {
      toast.error('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„طھط¹ط¯ظٹظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ')
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
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
            />
            <span className="mr-2 text-sm text-gray-600">
              {value ? 'ظ…ظپط¹ظ„' : 'ظ…ط¹ط·ظ„'}
            </span>
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
              <SelectValue placeholder="ط§ط®طھط± ظ‚ظٹظ…ط©" />
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

  const activeCategory = settingsCategories.find(cat => cat.key === activeTab)
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
            <h1 className="text-xl font-bold text-gray-900">ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ…</h1>
            <p className="mt-0.5 text-xs text-gray-600">ط¥ط¯ط§ط±ط© ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ… ظˆط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط¹ط§ظ…ط©</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="app-panel sticky top-3 p-2.5">
              <h3 className="font-semibold text-gray-900 mb-2 text-xs">ظپط¦ط§طھ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</h3>
              <nav className="space-y-1">
                {settingsCategories.map(category => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.key}
                      onClick={() => handleTabChange(category.key as TabType)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-right text-xs transition-all duration-200 ${
                        activeTab === category.key
                          ? 'bg-primary/15 text-slate-900 shadow-soft ring-1 ring-primary/40'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${activeTab === category.key ? 'text-slate-900' : 'text-gray-500'}`} />
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
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <activeCategory.icon className="w-5 h-5 text-slate-900" />
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">{activeCategory.label}</h2>
                        {activeCategory.settings && (
                          <p className="text-xs text-gray-600">{activeCategory.settings.length} ط¥ط¹ط¯ط§ط¯ط§طھ</p>
                        )}
                      </div>
                    </div>
                    {hasEditPermission && activeCategory.settings && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => resetToDefaults(activeTab)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          ط§ط³طھط¹ط§ط¯ط©
                        </Button>
                        <Button
                          onClick={saveActiveTabSettings}
                          disabled={isSaving}
                          size="sm"
                          className="text-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'ط¬ط§ط±ظٹ...' : 'ط­ظپط¸ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨'}
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
                      {activeCategory.settings.map(setting => (
                        <div key={setting.setting_key} className="border-b border-gray-100 pb-2.5 last:border-b-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 text-sm mb-0.5">
                                {setting.description}
                              </h3>
                              <p className="text-xs text-gray-500">
                                ط§ظ„ظ…ظپطھط§ط­: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{setting.setting_key}</code>
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
                      <p className="text-xs">ظ„ط§ طھظˆط¬ط¯ ط¥ط¹ط¯ط§ط¯ط§طھ ظ…طھط§ط­ط© ظپظٹ ظ‡ط°ط§ ط§ظ„ظ‚ط³ظ…</p>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-slate-950 shadow-sm">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-900">
                  {settingsCategories.reduce((acc, cat) => acc + (cat.settings?.length || 0), 0)}
                </h3>
                <p className="text-xs text-gray-600">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</p>
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
                <p className="text-xs text-gray-600">ظپط¦ط§طھ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</p>
              </div>
            </div>
          </div>

          <div className="app-panel border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 shadow-sm">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-900">
                  {new Date().toLocaleDateString('ar-SA')}
                </h3>
                <p className="text-xs text-gray-600">ط¢ط®ط± طھط­ط¯ظٹط«</p>
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
          title="ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ"
          message={`ط³ظٹطھظ… ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ${settingsCategories.find(cat => cat.key === resetTabKey)?.label || 'ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ'} ط¥ظ„ظ‰ ط§ظ„ظ‚ظٹظ… ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©`}
          confirmText="طھط£ظƒظٹط¯"
          cancelText="ط¥ظ„ط؛ط§ط،"
          isDangerous={true}
          icon="alert"
        >
          {getChangedSettings().length > 0 && (
            <div className="app-info-block max-h-60 overflow-y-auto rounded-lg p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„طھظٹ ط³طھطھط؛ظٹط±:</p>
              <div className="space-y-2">
                {getChangedSettings().map(setting => (
                  <div key={setting.setting_key} className="rounded border border-primary/20 bg-white p-3">
                    <p className="text-sm font-medium text-gray-900">{setting.description}</p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <div>
                        <span className="text-gray-600">ط§ظ„ط­ط§ظ„ظٹ: </span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono">
                          {String(setting.currentValue)}
                        </code>
                      </div>
                      <div className="text-gray-400">â†گ</div>
                      <div>
                        <code className="bg-green-100 px-2 py-1 rounded text-green-700 font-mono">
                          {String(setting.defaultValue)}
                        </code>
                        <span className="text-gray-600"> :ط§ظ„ط§ظپطھط±ط§ط¶ظٹ</span>
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
                âœ“ ط¬ظ…ظٹط¹ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ظ…ظˆط¬ظˆط¯ط© ط¨ط§ظ„ظپط¹ظ„ ط¹ظ„ظ‰ ظ‚ظٹظ…ظ‡ط§ ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©
              </p>
            </div>
          )}
        </ConfirmationDialog>
      </div>
    </Layout>
  )
}


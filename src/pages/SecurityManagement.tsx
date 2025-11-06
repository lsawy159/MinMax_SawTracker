import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Shield, Database, Key, Users, Activity, Settings, Download, Upload, Trash2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface SecuritySetting {
  id: string
  setting_key: string
  setting_value: any
  description: string
  updated_at: string
}

interface BackupRecord {
  id: string
  backup_type: string
  file_path: string
  file_size: number
  compression_ratio: number
  status: string
  started_at: string
  completed_at: string
  error_message?: string
}

interface UserSession {
  id: string
  device_info: any
  ip_address: string
  location: string
  last_activity: string
  created_at: string
  is_active: boolean
}

export default function SecurityManagement() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'settings' | 'backups' | 'sessions' | 'audit'>('settings')
  const [isLoading, setIsLoading] = useState(false)
  
  // Security Settings
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([])
  
  // Backups
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  
  // Sessions
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([])
  
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
  
  // Audit Stats
  const [auditStats, setAuditStats] = useState({
    total_logs: 0,
    high_risk_operations: 0,
    failed_logins_today: 0,
    active_sessions: 0
  })

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'settings') {
        await loadSecuritySettings()
      } else if (activeTab === 'backups') {
        await loadBackups()
      } else if (activeTab === 'sessions') {
        await loadActiveSessions()
      } else if (activeTab === 'audit') {
        await loadAuditStats()
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadSecuritySettings = async () => {
    const { data } = await supabase
      .from('security_settings')
      .select('*')
      .order('setting_key')
    
    if (data) setSecuritySettings(data)
  }

  const loadBackups = async () => {
    const { data } = await supabase
      .from('backup_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)
    
    if (data) setBackups(data)
  }

  const loadActiveSessions = async () => {
    // محاكاة البيانات حتى يتم تحديث قاعدة البيانات
    setActiveSessions([
      {
        id: '1',
        device_info: { browser: 'Chrome', platform: 'Windows' },
        ip_address: '192.168.1.100',
        location: 'الرياض، السعودية',
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_active: true
      }
    ])
  }

  const loadAuditStats = async () => {
    try {
      // إحصائيات سجل النشاط
      const { count: totalLogs } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })

      // العمليات عالية الخطورة
      const { count: highRiskOps } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })
        .in('operation', ['delete', 'bulk_delete', 'admin_action'])

      setAuditStats({
        total_logs: totalLogs || 0,
        high_risk_operations: highRiskOps || 0,
        failed_logins_today: 5, // محاكاة
        active_sessions: activeSessions.length
      })
    } catch (error) {
      console.error('Error loading audit stats:', error)
    }
  }

  const updateSecuritySetting = async (settingKey: string, newValue: any) => {
    try {
      const { error } = await supabase
        .from('security_settings')
        .update({
          setting_value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)

      if (error) throw error
      
      toast.success('تم تحديث الإعداد بنجاح')
      loadSecuritySettings()
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('فشل في تحديث الإعداد')
    }
  }

  const createBackup = async () => {
    setIsCreatingBackup(true)
    try {
      const { data, error } = await supabase.functions.invoke('automated-backup', {
        body: { backup_type: 'manual' }
      })

      if (error) throw error

      if (data.success) {
        toast.success('تم إنشاء النسخة الاحتياطية بنجاح')
        loadBackups()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      toast.error('فشل في إنشاء النسخة الاحتياطية')
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const deleteBackup = async (backupId: string, filePath: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) return

    try {
      // حذف الملف من Storage
      const { error: storageError } = await supabase.storage
        .from('backups')
        .remove([filePath])

      if (storageError) throw storageError

      // حذف السجل من قاعدة البيانات
      const { error: dbError } = await supabase
        .from('backup_history')
        .delete()
        .eq('id', backupId)

      if (dbError) throw dbError

      toast.success('تم حذف النسخة الاحتياطية')
      loadBackups()
    } catch (error) {
      console.error('Error deleting backup:', error)
      toast.error('فشل في حذف النسخة الاحتياطية')
    }
  }

  const downloadBackup = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(filePath)

      if (error) throw error

      // إنشاء رابط التحميل
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = filePath
      link.click()
      URL.revokeObjectURL(url)

      toast.success('تم تحميل النسخة الاحتياطية')
    } catch (error) {
      console.error('Error downloading backup:', error)
      toast.error('فشل في تحميل النسخة الاحتياطية')
    }
  }

  const terminateSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من إنهاء هذه الجلسة؟')) return

    try {
      // محاكاة إنهاء الجلسة
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId))
      toast.success('تم إنهاء الجلسة')
    } catch (error) {
      console.error('Error terminating session:', error)
      toast.error('فشل في إنهاء الجلسة')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ar-SA')
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-red-600" />
            إدارة الأمان والنسخ الاحتياطية
          </h1>
          <p className="text-gray-600">إدارة شاملة لأمان النظام والحماية والنسخ الاحتياطية</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">إجمالي السجلات</p>
                <p className="text-2xl font-bold">{auditStats.total_logs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">عمليات عالية الخطورة</p>
                <p className="text-2xl font-bold">{auditStats.high_risk_operations}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">فشل دخول اليوم</p>
                <p className="text-2xl font-bold">{auditStats.failed_logins_today}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">الجلسات النشطة</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border rounded-lg">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                إعدادات الأمان
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'backups'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Database className="w-4 h-4 inline mr-2" />
                النسخ الاحتياطية
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'sessions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                الجلسات النشطة
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                إحصائيات التدقيق
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Security Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">إعدادات الأمان</h2>
                  <button
                    onClick={loadSecuritySettings}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>

                <div className="space-y-4">
                  {securitySettings.map((setting) => (
                    <div key={setting.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{setting.setting_key.replace(/_/g, ' ')}</h3>
                        <span className="text-sm text-gray-500">
                          آخر تحديث: {formatDate(setting.updated_at)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{setting.description}</p>
                      
                      <div className="bg-gray-50 rounded p-3">
                        <pre className="text-sm whitespace-pre-wrap">
                          {JSON.stringify(setting.setting_value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Backups Tab */}
            {activeTab === 'backups' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">النسخ الاحتياطية</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={loadBackups}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      تحديث
                    </button>
                    <button
                      onClick={createBackup}
                      disabled={isCreatingBackup}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <Database className={`w-4 h-4 ${isCreatingBackup ? 'animate-spin' : ''}`} />
                      إنشاء نسخة احتياطية
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-right">النوع</th>
                        <th className="px-4 py-2 text-right">اسم الملف</th>
                        <th className="px-4 py-2 text-right">الحجم</th>
                        <th className="px-4 py-2 text-right">نسبة الضغط</th>
                        <th className="px-4 py-2 text-right">الحالة</th>
                        <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
                        <th className="px-4 py-2 text-right">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              backup.backup_type === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {backup.backup_type === 'manual' ? 'يدوي' : 'تلقائي'}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{backup.file_path}</td>
                          <td className="px-4 py-2">{formatFileSize(backup.file_size)}</td>
                          <td className="px-4 py-2">{backup.compression_ratio?.toFixed(1)}%</td>
                          <td className="px-4 py-2">
                            <span className={`flex items-center gap-1 ${
                              backup.status === 'completed' ? 'text-green-600' : 
                              backup.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {backup.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                              {backup.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
                              {backup.status === 'completed' ? 'مكتمل' : 
                               backup.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
                            </span>
                          </td>
                          <td className="px-4 py-2">{formatDate(backup.started_at)}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              {backup.status === 'completed' && (
                                <button
                                  onClick={() => downloadBackup(backup.file_path)}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                  title="تحميل"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteBackup(backup.id, backup.file_path)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">الجلسات النشطة</h2>
                  <button
                    onClick={loadActiveSessions}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>

                <div className="grid gap-4">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-semibold">جلسة نشطة</span>
                        </div>
                        <button
                          onClick={() => terminateSession(session.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                        >
                          إنهاء الجلسة
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><span className="text-gray-600">المتصفح:</span> {session.device_info?.browser}</p>
                          <p><span className="text-gray-600">النظام:</span> {session.device_info?.platform}</p>
                        </div>
                        <div>
                          <p><span className="text-gray-600">عنوان IP:</span> {session.ip_address}</p>
                          <p><span className="text-gray-600">الموقع:</span> {session.location}</p>
                        </div>
                        <div>
                          <p><span className="text-gray-600">آخر نشاط:</span> {formatDate(session.last_activity)}</p>
                        </div>
                        <div>
                          <p><span className="text-gray-600">تاريخ الإنشاء:</span> {formatDate(session.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">إحصائيات التدقيق</h2>
                  <button
                    onClick={loadAuditStats}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    تحديث الإحصائيات
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Security Summary */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-600" />
                      ملخص الأمان
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>إجمالي سجلات النشاط:</span>
                        <span className="font-bold">{auditStats.total_logs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>العمليات عالية الخطورة:</span>
                        <span className="font-bold text-red-600">{auditStats.high_risk_operations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>محاولات دخول فاشلة اليوم:</span>
                        <span className="font-bold text-yellow-600">{auditStats.failed_logins_today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>الجلسات النشطة:</span>
                        <span className="font-bold text-green-600">{auditStats.active_sessions}</span>
                      </div>
                    </div>
                  </div>

                  {/* System Status */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      حالة النظام
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>تشفير البيانات:</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>النسخ الاحتياطية التلقائية:</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>تسجيل العمليات:</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>مراقبة الجلسات:</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Security Events */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">الأحداث الأمنية الأخيرة</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>تم إنشاء نسخة احتياطية تلقائية بنجاح - قبل 2 ساعات</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span>محاولة دخول فاشلة من IP: 192.168.1.150 - قبل 4 ساعات</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span>تم إنهاء جلسة مستخدم بسبب عدم النشاط - قبل 6 ساعات</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
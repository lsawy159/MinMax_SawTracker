import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Database, Play, Pause, RotateCw, Clock, CheckCircle, AlertCircle, Loader, Mail, Plus, X } from 'lucide-react'

interface BackupJob {
  id: string
  job_name: string
  job_description: string
  function_name: string
  schedule: string
  is_enabled: boolean
  is_paused: boolean
  created_at: string
  updated_at: string
}

interface BackupLog {
  id: string
  job_name: string
  execution_start: string
  execution_end: string | null
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  execution_time_ms: number | null
  error_message: string | null
}

export default function BackupManagement() {
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [logs, setLogs] = useState<BackupLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExecutingManual, setIsExecutingManual] = useState(false)
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs' | 'settings'>('jobs')
  
  // إدارة الإيميلات
  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [isLoadingEmails, setIsLoadingEmails] = useState(false)
  const [enableNotifications, setEnableNotifications] = useState(false)

  // تحميل المهام والسجلات والإيميلات
  const loadData = async () => {
    setIsLoading(true)
    try {
      // تحميل المهام المجدولة
      const { data: jobsData, error: jobsError } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (jobsError && jobsError.code !== 'PGRST116') {
        console.error('Error loading jobs:', jobsError)
        toast.error('فشل تحميل المهام المجدولة')
      } else if (jobsData) {
        setJobs(jobsData as BackupJob[])
      }

      // تحميل آخر السجلات
      const { data: logsData, error: logsError } = await supabase
        .from('cron_jobs_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (logsError && logsError.code !== 'PGRST116') {
        console.error('Error loading logs:', logsError)
      } else if (logsData) {
        setLogs(logsData as BackupLog[])
      }

      // تحميل الإيميلات والإشعارات
      await loadEmailSettings()
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // تحميل إعدادات الإيميلات
  const loadEmailSettings = async () => {
    setIsLoadingEmails(true)
    try {
      // تحميل قائمة الإيميلات
      const { data: emailData } = await supabase
        .from('security_settings')
        .select('setting_value')
        .eq('setting_key', 'backup_email_recipients')
        .maybeSingle()

      if (emailData?.setting_value) {
        try {
          let recipients: string[] = []
          const value = emailData.setting_value
          
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value)
              recipients = Array.isArray(parsed) ? parsed : [value]
            } catch {
              recipients = value.split(',').map(e => e.trim()).filter(e => e && e.includes('@'))
            }
          } else if (Array.isArray(value)) {
            recipients = value
          }
          
          setEmailRecipients(recipients)
        } catch (e) {
          console.warn('Error parsing email recipients:', e)
        }
      }

      // تحميل حالة الإشعارات
      const { data: notificationData } = await supabase
        .from('security_settings')
        .select('setting_value')
        .eq('setting_key', 'backup_email_notifications')
        .maybeSingle()

      if (notificationData?.setting_value) {
        setEnableNotifications(notificationData.setting_value === true || notificationData.setting_value === 'true')
      }
    } catch (error) {
      console.error('Error loading email settings:', error)
    } finally {
      setIsLoadingEmails(false)
    }
  }

  useEffect(() => {
    loadData()
    // تحديث البيانات كل 30 ثانية
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تشغيل النسخ الاحتياطي يدوياً
  const triggerManualBackup = async () => {
    setIsExecutingManual(true)
    try {
      const response = await supabase.functions.invoke('trigger-backup', {
        body: {
          backup_type: 'full',
          triggered_by: 'manual'
        }
      })

      if (response.error) {
        toast.error('فشل تشغيل النسخ الاحتياطي')
        console.error('Error:', response.error)
      } else {
        toast.success('تم بدء النسخ الاحتياطي بنجاح')
        // تحديث السجلات فوراً
        setTimeout(loadData, 2000)
      }
    } catch (error) {
      console.error('Error triggering backup:', error)
      toast.error('حدث خطأ أثناء تشغيل النسخ الاحتياطي')
    } finally {
      setIsExecutingManual(false)
    }
  }

  // تفعيل/تعطيل المهمة
  const toggleJobStatus = async (jobName: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .update({ is_enabled: !currentStatus })
        .eq('job_name', jobName)

      if (error) {
        toast.error('فشل تحديث حالة المهمة')
        return
      }

      toast.success(currentStatus ? 'تم تعطيل المهمة' : 'تم تفعيل المهمة')
      loadData()
    } catch (error) {
      console.error('Error updating job:', error)
      toast.error('حدث خطأ أثناء تحديث المهمة')
    }
  }

  // إيقاف مؤقت للمهمة
  const pauseJob = async (jobName: string) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .update({ is_paused: true })
        .eq('job_name', jobName)

      if (error) {
        toast.error('فشل إيقاف المهمة')
        return
      }

      toast.success('تم إيقاف المهمة مؤقتاً')
      loadData()
    } catch (error) {
      console.error('Error pausing job:', error)
      toast.error('حدث خطأ أثناء إيقاف المهمة')
    }
  }

  // استئناف المهمة
  const resumeJob = async (jobName: string) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .update({ is_paused: false })
        .eq('job_name', jobName)

      if (error) {
        toast.error('فشل استئناف المهمة')
        return
      }

      toast.success('تم استئناف المهمة')
      loadData()
    } catch (error) {
      console.error('Error resuming job:', error)
      toast.error('حدث خطأ أثناء استئناف المهمة')
    }
  }

  // إضافة إيميل جديد
  const addEmail = async () => {
    const trimmedEmail = newEmail.trim()
    
    if (!trimmedEmail) {
      toast.error('يرجى إدخال عنوان بريد إلكتروني')
      return
    }

    if (!trimmedEmail.includes('@')) {
      toast.error('البريد الإلكتروني غير صحيح')
      return
    }

    if (emailRecipients.includes(trimmedEmail)) {
      toast.error('هذا البريد مضاف بالفعل')
      return
    }

    try {
      const updatedEmails = [...emailRecipients, trimmedEmail]
      
      // حفظ في قاعدة البيانات
      const { error } = await supabase
        .from('security_settings')
        .upsert({
          setting_key: 'backup_email_recipients',
          setting_value: JSON.stringify(updatedEmails),
          description: 'قائمة الإيميلات لاستقبال روابط النسخ الاحتياطية'
        }, { onConflict: 'setting_key' })

      if (error) throw error

      setEmailRecipients(updatedEmails)
      setNewEmail('')
      toast.success('تم إضافة البريد الإلكتروني بنجاح')
    } catch (error) {
      console.error('Error adding email:', error)
      toast.error('فشل إضافة البريد الإلكتروني')
    }
  }

  // حذف إيميل
  const removeEmail = async (emailToRemove: string) => {
    try {
      const updatedEmails = emailRecipients.filter(e => e !== emailToRemove)
      
      // حفظ في قاعدة البيانات
      const { error } = await supabase
        .from('security_settings')
        .upsert({
          setting_key: 'backup_email_recipients',
          setting_value: JSON.stringify(updatedEmails),
          description: 'قائمة الإيميلات لاستقبال روابط النسخ الاحتياطية'
        }, { onConflict: 'setting_key' })

      if (error) throw error

      setEmailRecipients(updatedEmails)
      toast.success('تم حذف البريد الإلكتروني بنجاح')
    } catch (error) {
      console.error('Error removing email:', error)
      toast.error('فشل حذف البريد الإلكتروني')
    }
  }

  // تفعيل/تعطيل الإشعارات
  const toggleNotifications = async () => {
    try {
      const newValue = !enableNotifications

      const { error } = await supabase
        .from('security_settings')
        .upsert({
          setting_key: 'backup_email_notifications',
          setting_value: newValue,
          description: 'تفعيل إرسال إشعارات بالبريد بعد كل نسخ احتياطي'
        }, { onConflict: 'setting_key' })

      if (error) throw error

      setEnableNotifications(newValue)
      toast.success(newValue ? 'تم تفعيل الإشعارات' : 'تم تعطيل الإشعارات')
    } catch (error) {
      console.error('Error toggling notifications:', error)
      toast.error('فشل تحديث إعدادات الإشعارات')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3.5 h-3.5" />
            نجح
          </span>
        )
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Loader className="w-3.5 h-3.5 animate-spin" />
            جاري
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="w-3.5 h-3.5" />
            فشل
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            ملغى
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* زر النسخ الاحتياطي اليدوي */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">نسخ احتياطي يدوي</h3>
            <p className="text-xs text-gray-600">قم بتشغيل النسخ الاحتياطي الكامل الآن بدلاً من انتظار الجدولة</p>
          </div>
          <button
            onClick={triggerManualBackup}
            disabled={isExecutingManual}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            <Play className="w-4 h-4" />
            {isExecutingManual ? 'جاري التشغيل...' : 'تشغيل الآن'}
          </button>
        </div>
      </div>

      {/* الأتباب */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            المهام المجدولة ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Database className="w-4 h-4" />
            سجل التنفيذات ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            إعدادات البريد
          </button>
        </div>
      </div>

      {/* المهام المجدولة */}
      {activeTab === 'jobs' && (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 text-sm">لا توجد مهام مجدولة</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{job.job_description}</h3>
                    <p className="text-xs text-gray-600 mb-2">
                      الدالة: <code className="bg-gray-100 px-1 py-0.5 rounded">{job.function_name}</code>
                    </p>
                    <p className="text-xs text-gray-600">
                      الجدولة: <code className="bg-gray-100 px-1 py-0.5 rounded">{job.schedule}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* حالة التفعيل */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      job.is_enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {job.is_enabled ? '✓ مفعل' : '✗ معطل'}
                    </div>

                    {/* حالة الإيقاف */}
                    {job.is_paused && (
                      <div className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        ⏸ موقوف
                      </div>
                    )}

                    {/* الأزرار */}
                    <div className="flex items-center gap-1">
                      {job.is_paused ? (
                        <button
                          onClick={() => resumeJob(job.job_name)}
                          title="استئناف"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => pauseJob(job.job_name)}
                          title="إيقاف مؤقت"
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded transition"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleJobStatus(job.job_name, job.is_enabled)}
                        title={job.is_enabled ? 'تعطيل' : 'تفعيل'}
                        className={`p-2 rounded transition ${
                          job.is_enabled
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* سجل التنفيذات */}
      {activeTab === 'logs' && (
        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 text-sm">لا توجد تنفيذات مسجلة</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">المهمة</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">الحالة</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">وقت البدء</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">المدة</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">الخطأ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 font-medium">{log.job_name}</td>
                    <td className="px-3 py-2">{getStatusBadge(log.status)}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(log.execution_start)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {log.execution_time_ms ? `${(log.execution_time_ms / 1000).toFixed(2)}s` : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {log.error_message ? (
                        <div className="text-red-600 text-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* إعدادات البريد */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* تفعيل الإشعارات */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">تفعيل إشعارات البريد</h3>
                <p className="text-xs text-gray-600">إرسال إشعار بالبريد عند اكتمال النسخ الاحتياطية</p>
              </div>
              <button
                onClick={toggleNotifications}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                  enableNotifications
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {enableNotifications ? '✓ مفعل' : '✗ معطل'}
              </button>
            </div>
          </div>

          {/* إضافة إيميلات */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">إدارة عناوين البريد الإلكتروني</h3>
            
            <div className="space-y-3">
              {/* حقل إدخال البريل الجديد */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                  placeholder="أدخل البريد الإلكتروني..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={addEmail}
                  disabled={isLoadingEmails}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  إضافة
                </button>
              </div>

              {/* قائمة الإيميلات */}
              {emailRecipients.length === 0 ? (
                <div className="text-center py-6">
                  <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">لم تقم بإضافة أي عناوين بريد إلكترونية</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailRecipients.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{email}</span>
                      </div>
                      <button
                        onClick={() => removeEmail(email)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition flex-shrink-0"
                        title="حذف"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ملاحظات */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-semibold mb-1">ملاحظة:</p>
                <p>الإشعارات سيتم إرسالها إلى جميع العناوين المضافة عند اكتمال كل نسخة احتياطية بنجاح أو فشلها</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* معلومات إضافية */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
        <p className="font-semibold text-gray-900 mb-2">ملاحظات مهمة:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>المهام المجدولة تعمل على Supabase Cloud تلقائياً</li>
          <li>النسخ الاحتياطي يومياً الساعة 12 ظهراً UTC (3 صباحاً السعودية)</li>
          <li>معالجة البريد كل 5 دقائق</li>
          <li>يتم تحديث السجلات تلقائياً كل 30 ثانية</li>
        </ul>
      </div>
    </div>
  )
}

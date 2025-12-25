import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { RefreshCw, Mail, AlertTriangle } from 'lucide-react'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { logger } from '@/utils/logger'

interface EmailQueueItem {
  id: string
  to_emails: string[]
  subject: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  retry_count: number
  max_retries: number
  error_message: string | null
  created_at: string
  processed_at: string | null
  completed_at: string | null
}

export default function EmailQueueMonitor() {
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([])
  const [isLoadingEmailQueue, setIsLoadingEmailQueue] = useState(false)

  const loadEmailQueue = useCallback(async () => {
    setIsLoadingEmailQueue(true)
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Email Queue] Error loading queue:', error)
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setEmailQueue([])
          return
        }
        throw error
      }

      setEmailQueue(data || [])
      logger.debug('[Email Queue] Queue loaded successfully, count:', data?.length || 0)
    } catch (error) {
      console.error('[Email Queue] Error loading queue:', error)
      setEmailQueue([])
    } finally {
      setIsLoadingEmailQueue(false)
    }
  }, [])

  const retryFailedEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          error_message: null
        })
        .eq('id', emailId)
        .eq('status', 'failed')

      if (error) throw error

      toast.success('تمت إعادة إضافة البريد إلى قائمة الانتظار')
      await loadEmailQueue()
    } catch (error) {
      console.error('[Email Queue] Error retrying email:', error)
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      toast.error('فشل في إعادة المحاولة: ' + errorMessage)
    }
  }

  useEffect(() => {
    loadEmailQueue()
  }, [loadEmailQueue])

  useEffect(() => {
    const interval = setInterval(() => {
      loadEmailQueue()
    }, 10000)

    return () => clearInterval(interval)
  }, [loadEmailQueue])

  const formatDate = (dateString: string) => formatDateWithHijri(dateString, true)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <h3 className="text-md font-semibold">قائمة انتظار البريد الإلكتروني</h3>
        </div>
        <button
          onClick={loadEmailQueue}
          disabled={isLoadingEmailQueue}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingEmailQueue ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {emailQueue.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">لا توجد بريد في قائمة الانتظار</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right">الإيميلات المستلمة</th>
                <th className="px-4 py-2 text-right">الموضوع</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
                <th className="px-4 py-2 text-right">تاريخ المعالجة</th>
                <th className="px-4 py-2 text-right">المحاولات</th>
                <th className="px-4 py-2 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {emailQueue.map((item) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return 'text-yellow-600 bg-yellow-50'
                    case 'processing':
                      return 'text-blue-600 bg-blue-50'
                    case 'completed':
                      return 'text-green-600 bg-green-50'
                    case 'failed':
                      return 'text-red-600 bg-red-50'
                    default:
                      return 'text-gray-600 bg-gray-50'
                  }
                }

                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return '🟡'
                    case 'processing':
                      return '🔵'
                    case 'completed':
                      return '🟢'
                    case 'failed':
                      return '🔴'
                    default:
                      return '⚪'
                  }
                }

                const getStatusText = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return 'قيد الانتظار'
                    case 'processing':
                      return 'قيد المعالجة'
                    case 'completed':
                      return 'نجح'
                    case 'failed':
                      return 'فشل'
                    default:
                      return status
                  }
                }

                return (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {item.to_emails.slice(0, 2).map((email, idx) => (
                          <span key={idx} className="text-xs font-mono">{email}</span>
                        ))}
                        {item.to_emails.length > 2 && (
                          <span className="text-xs text-gray-500">+{item.to_emails.length - 2} آخر</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate" title={item.subject}>
                      {item.subject}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 w-fit ${getStatusColor(item.status)}`}>
                        <span>{getStatusIcon(item.status)}</span>
                        {getStatusText(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <HijriDateDisplay date={item.created_at}>
                        {formatDate(item.created_at)}
                      </HijriDateDisplay>
                    </td>
                    <td className="px-4 py-2">
                      {item.processed_at ? (
                        <HijriDateDisplay date={item.processed_at}>
                          {formatDate(item.processed_at)}
                        </HijriDateDisplay>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.retry_count >= item.max_retries ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.retry_count} / {item.max_retries}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryFailedEmail(item.id)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="إعادة المحاولة"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {item.error_message && (
                          <button
                            onClick={() => {
                              toast.error(item.error_message || 'خطأ غير معروف', {
                                description: 'تفاصيل الخطأ',
                                duration: 10000
                              })
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="عرض الخطأ"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

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
  const [stats, setStats] = useState<{
    pending: number
    processing: number
    completed: number
    failed: number
    total: number
  }>({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 })

  const loadEmailQueue = useCallback(async () => {
    setIsLoadingEmailQueue(true)
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('id')
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
      
      // Calculate statistics
      const pending = data?.filter(item => item.status === 'pending').length || 0
      const processing = data?.filter(item => item.status === 'processing').length || 0
      const completed = data?.filter(item => item.status === 'completed' || item.status === 'sent').length || 0
      const failed = data?.filter(item => item.status === 'failed').length || 0
      setStats({ pending, processing, completed, failed, total: data?.length || 0 })
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

      toast.success('طھظ…طھ ط¥ط¹ط§ط¯ط© ط¥ط¶ط§ظپط© ط§ظ„ط¨ط±ظٹط¯ ط¥ظ„ظ‰ ظ‚ط§ط¦ظ…ط© ط§ظ„ط§ظ†طھط¸ط§ط±')
      await loadEmailQueue()
    } catch (error) {
      console.error('[Email Queue] Error retrying email:', error)
      const errorMessage = error instanceof Error ? error.message : 'ط®ط·ط£ ط؛ظٹط± ظ…ط¹ط±ظˆظپ'
      toast.error('ظپط´ظ„ ظپظٹ ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©: ' + errorMessage)
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
          <h3 className="text-md font-semibold">ظ‚ط§ط¦ظ…ط© ط§ظ†طھط¸ط§ط± ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ</h3>
        </div>
        <button
          onClick={loadEmailQueue}
          disabled={isLoadingEmailQueue}
          className="app-button-secondary text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingEmailQueue ? 'animate-spin' : ''}`} />
          طھط­ط¯ظٹط«
        </button>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg border">
          <div className="text-xs text-gray-500 mb-1">ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</div>
          <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <div className="text-xs text-yellow-700 mb-1 flex items-center gap-1">
            <span>ًںں،</span> ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط±
          </div>
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-700 mb-1 flex items-center gap-1">
            <span>ًں”µ</span> ظ‚ظٹط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.processing}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <div className="text-xs text-green-700 mb-1 flex items-center gap-1">
            <span>ًںں¢</span> ظ†ط¬ط­طھ
          </div>
          <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <div className="text-xs text-red-700 mb-1 flex items-center gap-1">
            <span>ًں”´</span> ظپط´ظ„طھ
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
        </div>
      </div>

      {emailQueue.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">ظ„ط§ طھظˆط¬ط¯ ط¨ط±ظٹط¯ ظپظٹ ظ‚ط§ط¦ظ…ط© ط§ظ„ط§ظ†طھط¸ط§ط±</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right">ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ظ…ط³طھظ„ظ…ط©</th>
                <th className="px-4 py-2 text-right">ط§ظ„ظ…ظˆط¶ظˆط¹</th>
                <th className="px-4 py-2 text-right">ط§ظ„ط­ط§ظ„ط©</th>
                <th className="px-4 py-2 text-right">طھط§ط±ظٹط® ط§ظ„ط¥ظ†ط´ط§ط،</th>
                <th className="px-4 py-2 text-right">طھط§ط±ظٹط® ط§ظ„ظ…ط¹ط§ظ„ط¬ط©</th>
                <th className="px-4 py-2 text-right">ط§ظ„ظ…ط­ط§ظˆظ„ط§طھ</th>
                <th className="px-4 py-2 text-right">ط§ظ„ط¥ط¬ط±ط§ط،ط§طھ</th>
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
                    case 'sent':
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
                      return 'ًںں،'
                    case 'processing':
                      return 'ًں”µ'
                    case 'completed':
                    case 'sent':
                      return 'ًںں¢'
                    case 'failed':
                      return 'ًں”´'
                    default:
                      return 'âڑھ'
                  }
                }

                const getStatusText = (status: string) => {
                  switch (status) {
                    case 'pending':
                      return 'ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط±'
                    case 'processing':
                      return 'ظ‚ظٹط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©'
                    case 'completed':
                    case 'sent':
                      return 'ظ†ط¬ط­'
                    case 'failed':
                      return 'ظپط´ظ„'
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
                          <span className="text-xs text-gray-500">+{item.to_emails.length - 2} ط¢ط®ط±</span>
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
                            title="ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {item.error_message && (
                          <button
                            onClick={() => {
                              toast.error(item.error_message || 'ط®ط·ط£ ط؛ظٹط± ظ…ط¹ط±ظˆظپ', {
                                description: 'طھظپط§طµظٹظ„ ط§ظ„ط®ط·ط£',
                                duration: 10000
                              })
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="ط¹ط±ط¶ ط§ظ„ط®ط·ط£"
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


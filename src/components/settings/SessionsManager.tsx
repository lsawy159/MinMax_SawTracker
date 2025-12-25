import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Users } from 'lucide-react'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'

interface UserSession {
  id: string
  user_id: string
  device_info: Record<string, unknown>
  ip_address: string
  location: string
  last_activity: string
  created_at: string
  logged_out_at?: string
  is_active: boolean
  users?: {
    id: string
    email: string
    full_name: string
  }
}

export default function SessionsManager() {
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([])
  const [sessionHistory, setSessionHistory] = useState<UserSession[]>([])
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingSessions, setIsDeletingSessions] = useState(false)

  const [showConfirmTerminate, setShowConfirmTerminate] = useState(false)
  const [sessionToTerminate, setSessionToTerminate] = useState<UserSession | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<UserSession | null>(null)
  const [showConfirmDeleteMultiple, setShowConfirmDeleteMultiple] = useState(false)

  const loadActiveSessions = async () => {
    try {
      setIsLoading(true)
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (
            id,
            email,
            full_name
          )
        `)
        .eq('is_active', true)
        .gt('expires_at', now)
        .order('last_activity', { ascending: false })

      if (error) {
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setActiveSessions([])
          return
        }
        throw error
      }

      setActiveSessions(data || [])
    } catch (error) {
      console.error('Error loading active sessions:', error)
      setActiveSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadSessionHistory = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (
            id,
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setSessionHistory([])
          return
        }
        throw error
      }

      setSessionHistory(data || [])
    } catch (error) {
      console.error('Error loading session history:', error)
      setSessionHistory([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadActiveSessions()
    loadSessionHistory()
  }, [])

  const terminateSession = (session: UserSession) => {
    setSessionToTerminate(session)
    setShowConfirmTerminate(true)
  }

  const handleConfirmTerminate = async () => {
    if (!sessionToTerminate) return

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          logged_out_at: new Date().toISOString()
        })
        .eq('id', sessionToTerminate.id)

      if (error) throw error

      setActiveSessions(prev => prev.filter(s => s.id !== sessionToTerminate.id))
      if (sessionHistory.length > 0) {
        await loadSessionHistory()
      }

      toast.success('تم إنهاء الجلسة بنجاح')
    } catch (error) {
      console.error('Error terminating session:', error)
      toast.error('فشل في إنهاء الجلسة')
    } finally {
      setShowConfirmTerminate(false)
      setSessionToTerminate(null)
    }
  }

  const deleteSession = (session: UserSession) => {
    setSessionToDelete(session)
    setShowConfirmDelete(true)
  }

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return

    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionToDelete.id)

      if (error) throw error

      setSessionHistory(prev => prev.filter(s => s.id !== sessionToDelete.id))
      setActiveSessions(prev => prev.filter(s => s.id !== sessionToDelete.id))
      setSelectedSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionToDelete.id)
        return newSet
      })

      toast.success('تم حذف الجلسة بنجاح')
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('فشل في حذف الجلسة')
    } finally {
      setShowConfirmDelete(false)
      setSessionToDelete(null)
    }
  }

  const deleteSelectedSessions = () => {
    if (selectedSessions.size === 0) {
      toast.warning('لم يتم تحديد أي جلسات للحذف')
      return
    }
    setShowConfirmDeleteMultiple(true)
  }

  const handleConfirmDeleteMultipleSessions = async () => {
    setIsDeletingSessions(true)
    try {
      const sessionIds = Array.from(selectedSessions)
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .in('id', sessionIds)

      if (error) throw error

      setSessionHistory(prev => prev.filter(s => !selectedSessions.has(s.id)))
      setActiveSessions(prev => prev.filter(s => !selectedSessions.has(s.id)))
      setSelectedSessions(new Set())

      toast.success(`تم حذف ${sessionIds.length} جلسة بنجاح`)
      setShowConfirmDeleteMultiple(false)
    } catch (error) {
      console.error('Error deleting sessions:', error)
      toast.error('فشل في حذف الجلسات')
    } finally {
      setIsDeletingSessions(false)
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId)
      } else {
        newSet.add(sessionId)
      }
      return newSet
    })
  }

  const toggleAllSessions = () => {
    if (selectedSessions.size === sessionHistory.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessionHistory.map(s => s.id)))
    }
  }

  const formatDate = (dateString: string) => formatDateWithHijri(dateString, true)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">الجلسات</h2>
        </div>
        <div className="flex items-center gap-2">
          {selectedSessions.size > 0 && (
            <button
              onClick={deleteSelectedSessions}
              disabled={isDeletingSessions}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              حذف المحدد ({selectedSessions.size})
            </button>
          )}
          <button
            onClick={() => {
              loadActiveSessions()
              loadSessionHistory()
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
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
                onClick={() => terminateSession(session)}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
              >
                إنهاء الجلسة
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="text-gray-600">المستخدم:</span> {session.users?.full_name || 'غير محدد'}</p>
                <p><span className="text-gray-600">البريد الإلكتروني:</span> {session.users?.email || 'غير محدد'}</p>
              </div>
              <div>
                <p><span className="text-gray-600">المتصفح:</span> {(session.device_info as Record<string, unknown>)?.browser ? String((session.device_info as Record<string, unknown>).browser) : 'غير محدد'}</p>
                <p><span className="text-gray-600">النظام:</span> {(session.device_info as Record<string, unknown>)?.platform ? String((session.device_info as Record<string, unknown>).platform) : 'غير محدد'}</p>
              </div>
              <div>
                <p>
                  <span className="text-gray-600">آخر نشاط:</span>{' '}
                  <HijriDateDisplay date={session.last_activity}>
                    {formatDate(session.last_activity)}
                  </HijriDateDisplay>
                </p>
              </div>
              <div>
                <p>
                  <span className="text-gray-600">تاريخ تسجيل الدخول:</span>{' '}
                  <HijriDateDisplay date={session.created_at}>
                    {formatDate(session.created_at)}
                  </HijriDateDisplay>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">سجل الجلسات</h2>
          <div className="flex items-center gap-2">
            {selectedSessions.size > 0 && (
              <button
                onClick={deleteSelectedSessions}
                disabled={isDeletingSessions}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                حذف المحدد ({selectedSessions.size})
              </button>
            )}
            <button
              onClick={() => {
                loadActiveSessions()
                loadSessionHistory()
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {sessionHistory.length === 0 ? (
          <div className="text-center py-6 text-gray-500">لا توجد جلسات مسجلة</div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right">
                      <input
                        type="checkbox"
                        checked={selectedSessions.size === sessionHistory.length && sessionHistory.length > 0}
                        onChange={toggleAllSessions}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المستخدم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">وقت تسجيل الدخول</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">وقت تسجيل الخروج</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessionHistory.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.id)}
                          onChange={() => toggleSessionSelection(session.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {session.users?.full_name || 'غير محدد'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {session.users?.email || 'غير محدد'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <HijriDateDisplay date={session.created_at}>
                          {formatDate(session.created_at)}
                        </HijriDateDisplay>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {session.logged_out_at ? (
                          <HijriDateDisplay date={session.logged_out_at}>
                            {formatDate(session.logged_out_at)}
                          </HijriDateDisplay>
                        ) : session.is_active ? (
                          <span className="text-green-600">نشطة</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          session.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.is_active ? 'نشطة' : 'منتهية'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteSession(session)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3 p-3">
              {sessionHistory.map((session) => (
                <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      session.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.is_active ? 'نشطة' : 'منتهية'}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.id)}
                      onChange={() => toggleSessionSelection(session.id)}
                      className="w-4 h-4"
                    />
                  </div>

                  <div className="py-2 px-2 bg-blue-50 rounded text-xs space-y-1">
                    <div className="font-medium text-gray-600">المستخدم</div>
                    <div className="font-medium text-gray-900">{session.users?.full_name || 'غير محدد'}</div>
                    <div className="text-gray-600">{session.users?.email || 'غير محدد'}</div>
                  </div>

                  <div className="py-2 px-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-600 mb-0.5">وقت الدخول</div>
                    <HijriDateDisplay date={session.created_at}>
                      {formatDate(session.created_at)}
                    </HijriDateDisplay>
                  </div>

                  <div className="py-2 px-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-600 mb-0.5">وقت الخروج</div>
                    {session.logged_out_at ? (
                      <HijriDateDisplay date={session.logged_out_at}>
                        {formatDate(session.logged_out_at)}
                      </HijriDateDisplay>
                    ) : session.is_active ? (
                      <span className="text-green-600 font-medium">جاري الآن</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>

                  <div className="pt-1 border-t border-gray-100">
                    <button
                      onClick={() => deleteSession(session)}
                      className="w-full px-2 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showConfirmTerminate}
        onClose={() => {
          setShowConfirmTerminate(false)
          setSessionToTerminate(null)
        }}
        onConfirm={handleConfirmTerminate}
        title="إنهاء الجلسة"
        message={`هل أنت متأكد من إنهاء جلسة ${sessionToTerminate?.users?.email}؟ سيتم تسجيل خروج المستخدم من هذا الجهاز.`}
        confirmText="إنهاء"
        cancelText="إلغاء"
        isDangerous={true}
        icon="alert"
      />

      <ConfirmationDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setSessionToDelete(null)
        }}
        onConfirm={handleConfirmDeleteSession}
        title="حذف الجلسة"
        message={`هل أنت متأكد من حذف جلسة ${sessionToDelete?.users?.email}؟ سيتم حذفها من السجل بشكل نهائي.`}
        confirmText="حذف"
        cancelText="إلغاء"
        isDangerous={true}
        icon="alert"
      />

      <ConfirmationDialog
        isOpen={showConfirmDeleteMultiple}
        onClose={() => setShowConfirmDeleteMultiple(false)}
        onConfirm={handleConfirmDeleteMultipleSessions}
        title="حذف جلسات متعددة"
        message={`هل أنت متأكد من حذف ${selectedSessions.size} جلسة؟ سيتم حذفها من السجل بشكل نهائي.`}
        confirmText="حذف"
        cancelText="إلغاء"
        isDangerous={true}
        icon="alert"
      />
    </div>
  )
}

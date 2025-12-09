import { useState, useEffect } from 'react'
import { supabase, Notification } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import { 
  Bell, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Check, 
  Trash2, 
  RefreshCw,
  Search,
  Mail
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'

type FilterType = 'all' | 'unread' | 'read'
type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low'

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadNotifications()

    // الاشتراك في التحديثات الفورية
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast.error('فشل تحميل التنبيهات')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateNotifications = async () => {
    setGenerating(true)
    try {
      const { data, error } = await supabase.rpc('generate_expiry_notifications')
      
      if (error) throw error
      
      toast.success(`تم توليد ${data?.length || 0} تنبيه جديد`)
      loadNotifications()
    } catch (error) {
      console.error('Error generating notifications:', error)
      toast.error('فشل توليد التنبيهات')
    } finally {
      setGenerating(false)
    }
  }

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error
      loadNotifications()
      toast.success('تم تحديد التنبيه كمقروء')
    } catch {
      toast.error('فشل تحديث التنبيه')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false)
        .eq('is_archived', false)

      if (error) throw error
      loadNotifications()
      toast.success('تم تحديد جميع التنبيهات كمقروءة')
    } catch {
      toast.error('فشل تحديث التنبيهات')
    }
  }

  const handleMarkAsUnread = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false, read_at: null })
        .eq('id', notificationId)

      if (error) throw error
      loadNotifications()
      toast.success('تم تحديد التنبيه كغير مقروء')
    } catch {
      toast.error('فشل تحديث التنبيه')
    }
  }

  const handleMarkAllAsUnread = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false, read_at: null })
        .eq('is_read', true)
        .eq('is_archived', false)

      if (error) throw error
      loadNotifications()
      toast.success('تم تحديد جميع التنبيهات كغير مقروءة')
    } catch {
      toast.error('فشل تحديث التنبيهات')
    }
  }

  const handleDelete = async (notificationId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا التنبيه؟')) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('id', notificationId)

      if (error) throw error
      loadNotifications()
      toast.success('تم حذف التنبيه')
    } catch {
      toast.error('فشل حذف التنبيه')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع التنبيهات؟')) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('is_archived', false)

      if (error) throw error
      loadNotifications()
      toast.success('تم حذف جميع التنبيهات')
    } catch {
      toast.error('فشل حذف التنبيهات')
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'text-red-600 bg-red-50 border-red-200',
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-blue-600 bg-blue-50 border-blue-200'
    }
    return colors[priority as keyof typeof colors] || colors.low
  }

  const getPriorityIcon = (priority: string) => {
    if (priority === 'urgent') return <AlertTriangle className="w-5 h-5" />
    if (priority === 'high') return <Clock className="w-5 h-5" />
    return <Calendar className="w-5 h-5" />
  }

  const getPriorityLabel = (priority: string) => {
    const labels = {
      urgent: 'عاجل',
      high: 'عاجل',
      medium: 'متوسط',
      low: 'منخفض'
    }
    return labels[priority as keyof typeof labels] || priority
  }

  // تطبيق الفلاتر
  const filteredNotifications = notifications.filter(notification => {
    // فلتر القراءة
    if (filterType === 'read' && !notification.is_read) return false
    if (filterType === 'unread' && notification.is_read) return false

    // فلتر الأولوية
    if (priorityFilter !== 'all' && notification.priority !== priorityFilter) return false

    // فلتر البحث
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        notification.title.toLowerCase().includes(search) ||
        notification.message.toLowerCase().includes(search)
      )
    }

    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length
  const readCount = notifications.filter(n => n.is_read).length
  const stats = {
    total: notifications.length,
    unread: unreadCount,
    urgent: notifications.filter(n => n.priority === 'urgent' && !n.is_read).length,
    high: notifications.filter(n => n.priority === 'high' && !n.is_read).length,
    medium: notifications.filter(n => n.priority === 'medium' && !n.is_read).length
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">التنبيهات</h1>
              <p className="text-gray-600 mt-1">
                {unreadCount > 0 ? `لديك ${unreadCount} تنبيه غير مقروء` : 'جميع التنبيهات مقروءة'}
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerateNotifications}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400"
          >
            <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'جاري التوليد...' : 'توليد تنبيهات جديدة'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">إجمالي التنبيهات</div>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
            <div className="text-sm text-blue-700">غير مقروء</div>
          </div>
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-red-700">عاجل</div>
          </div>
          <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-sm text-orange-700">عاجل</div>
          </div>
          <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-yellow-700">متوسط</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث في التنبيهات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filter by Read Status */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">جميع التنبيهات</option>
                <option value="unread">غير مقروء</option>
                <option value="read">مقروء</option>
              </select>
            </div>

            {/* Filter by Priority */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">جميع الأولويات</option>
                <option value="urgent">عاجل فقط</option>
                <option value="high">عاجل فقط</option>
                <option value="medium">متوسط فقط</option>
                <option value="low">منخفض فقط</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                تحديد الكل كمقروء
              </button>
            )}
            {readCount > 0 && (
              <button
                onClick={handleMarkAllAsUnread}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
              >
                <Mail className="w-4 h-4" />
                تحديد الكل كغير مقروء
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد تنبيهات</h3>
            <p className="text-gray-600">
              {notifications.length === 0 
                ? 'لم يتم توليد أي تنبيهات بعد. اضغط على "توليد تنبيهات جديدة" أعلاه.'
                : 'لا توجد نتائج تطابق الفلاتر المحددة'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 transition ${
                  !notification.is_read 
                    ? 'border-blue-200 bg-blue-50/30' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Priority Icon */}
                  <div className={`p-3 rounded-xl ${getPriorityColor(notification.priority)}`}>
                    {getPriorityIcon(notification.priority)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className={`text-lg font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="flex-shrink-0 w-3 h-3 bg-blue-600 rounded-full"></span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-3">{notification.message}</p>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(notification.priority)}`}>
                        {getPriorityLabel(notification.priority)}
                      </span>
                      
                      {notification.days_remaining !== null && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          notification.days_remaining < 0 
                            ? 'bg-red-100 text-red-700'
                            : notification.days_remaining <= 7
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {notification.days_remaining < 0 
                            ? `منتهي منذ ${String(Math.abs(notification.days_remaining))} يوم`
                            : `باقي ${String(notification.days_remaining)} يوم`
                          }
                        </span>
                      )}

                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true, 
                          locale: ar 
                        })}
                      </span>

                      {notification.target_date && (
                        <span className="text-sm text-gray-500">
                          <HijriDateDisplay date={notification.target_date}>
                            التاريخ المستهدف: {formatDateShortWithHijri(notification.target_date)}
                          </HijriDateDisplay>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      {!notification.is_read ? (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition"
                        >
                          <Check className="w-4 h-4" />
                          تحديد كمقروء
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsUnread(notification.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
                        >
                          <Mail className="w-4 h-4" />
                          تحديد كغير مقروء
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

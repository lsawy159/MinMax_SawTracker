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
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

type FilterType = 'all' | 'unread' | 'read'
type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low'

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [generating, setGenerating] = useState(false)

  // Confirmation Dialogs
  const [showConfirmDeleteOne, setShowConfirmDeleteOne] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null)
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false)

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

  const handleDelete = async (notification: Notification) => {
    setNotificationToDelete(notification)
    setShowConfirmDeleteOne(true)
  }

  const handleConfirmDeleteOne = async () => {
    if (!notificationToDelete) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('id', notificationToDelete.id)

      if (error) throw error
      loadNotifications()
      toast.success('تم حذف التنبيه')
      setShowConfirmDeleteOne(false)
      setNotificationToDelete(null)
    } catch {
      toast.error('فشل حذف التنبيه')
    }
  }

  const handleDeleteAll = async () => {
    setShowConfirmDeleteAll(true)
  }

  const handleConfirmDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('is_archived', false)

      if (error) throw error
      loadNotifications()
      toast.success('تم حذف جميع التنبيهات')
      setShowConfirmDeleteAll(false)
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
          <Button
            onClick={handleGenerateNotifications}
            disabled={generating}
          >
            <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'جاري التوليد...' : 'توليد تنبيهات جديدة'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="app-panel p-4">
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
        <div className="app-panel mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="البحث في التنبيهات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-4 pr-10"
                />
              </div>
            </div>

            {/* Filter by Read Status */}
            <div>
              <Select
                value={filterType}
                onValueChange={(value) => setFilterType(value as FilterType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="حالة القراءة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التنبيهات</SelectItem>
                  <SelectItem value="unread">غير مقروء</SelectItem>
                  <SelectItem value="read">مقروء</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Priority */}
            <div>
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجل فقط</SelectItem>
                  <SelectItem value="high">عاجل فقط</SelectItem>
                  <SelectItem value="medium">متوسط فقط</SelectItem>
                  <SelectItem value="low">منخفض فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="success"
                size="sm"
              >
                <Check className="w-4 h-4" />
                تحديد الكل كمقروء
              </Button>
            )}
            {readCount > 0 && (
              <Button
                onClick={handleMarkAllAsUnread}
                variant="secondary"
                size="sm"
              >
                <Mail className="w-4 h-4" />
                تحديد الكل كغير مقروء
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                onClick={handleDeleteAll}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </Button>
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
                        <Button
                          onClick={() => handleMarkAsRead(notification.id)}
                          variant="success"
                          size="sm"
                        >
                          <Check className="w-4 h-4" />
                          تحديد كمقروء
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleMarkAsUnread(notification.id)}
                          variant="secondary"
                          size="sm"
                        >
                          <Mail className="w-4 h-4" />
                          تحديد كغير مقروء
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(notification)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialogs */}
        <ConfirmationDialog
          isOpen={showConfirmDeleteOne}
          onClose={() => {
            setShowConfirmDeleteOne(false)
            setNotificationToDelete(null)
          }}
          onConfirm={handleConfirmDeleteOne}
          title="حذف التنبيه"
          message={`هل أنت متأكد من حذف هذا التنبيه: "${notificationToDelete?.title}"؟`}
          confirmText="حذف"
          cancelText="إلغاء"
          isDangerous={true}
          icon="alert"
        />

        <ConfirmationDialog
          isOpen={showConfirmDeleteAll}
          onClose={() => setShowConfirmDeleteAll(false)}
          onConfirm={handleConfirmDeleteAll}
          title="حذف جميع التنبيهات"
          message="هل أنت متأكد من حذف جميع التنبيهات؟ هذا الإجراء لا يمكن التراجع عنه."
          confirmText="حذف"
          cancelText="إلغاء"
          isDangerous={true}
          icon="alert"
        />
      </div>
    </Layout>
  )
}

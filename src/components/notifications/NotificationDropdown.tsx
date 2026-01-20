import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, Notification } from '@/lib/supabase'
import { Bell, X, AlertTriangle, Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    
    // الاشتراك في التحديثات الفورية
    const channel = supabase
      .channel('notifications-channel')
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
        .limit(10)

      if (error) throw error
      
      setNotifications(data || [])
      const unread = (data || []).filter(n => !n.is_read).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
      
      loadNotifications()
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false)
      
      loadNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
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
    if (priority === 'urgent') return <AlertTriangle className="w-4 h-4" />
    if (priority === 'high') return <Clock className="w-4 h-4" />
    return <Calendar className="w-4 h-4" />
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

  return (
    <div className="relative">
      {/* Bell Icon with Badge - Material Design */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 ease-in-out hover:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.2),0_4px_5px_0_rgba(0,0,0,0.14)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <Bell className="w-6 h-6 transition-transform duration-200 hover:scale-110" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Dropdown Panel - Material Design */}
          <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2),0_6px_12px_0_rgba(0,0,0,0.14),0_2px_4px_0_rgba(0,0,0,0.12)] border border-gray-200 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">التنبيهات</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/50 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Actions */}
            {unreadCount > 0 && (
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  تحديد الكل كمقروء
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">لا توجد تنبيهات جديدة</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                      className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Priority Badge */}
                        <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                          {getPriorityIcon(notification.priority)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(notification.priority)}`}>
                              {getPriorityLabel(notification.priority)}
                            </span>
                            {notification.days_remaining !== null && notification.days_remaining !== undefined && (
                              <span className="text-xs text-gray-500">
                                {notification.days_remaining < 0 
                                  ? `منتهي منذ ${String(Math.abs(notification.days_remaining))} يوم`
                                  : `باقي ${String(notification.days_remaining)} يوم`
                                }
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(notification.created_at), { 
                                addSuffix: true, 
                                locale: ar 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                عرض جميع التنبيهات
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

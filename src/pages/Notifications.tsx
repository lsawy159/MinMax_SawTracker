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

    // ط§ظ„ط§ط´طھط±ط§ظƒ ظپظٹ ط§ظ„طھط­ط¯ظٹط«ط§طھ ط§ظ„ظپظˆط±ظٹط©
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
        .from('notifications').select('id,type,title,message,entity_type,entity_id,priority,days_remaining,is_read,is_archived,created_at,read_at,target_date')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateNotifications = async () => {
    setGenerating(true)
    try {
      const { data, error } = await supabase.rpc('generate_expiry_notifications')
      
      if (error) throw error
      
      toast.success(`طھظ… طھظˆظ„ظٹط¯ ${data?.length || 0} طھظ†ط¨ظٹظ‡ ط¬ط¯ظٹط¯`)
      loadNotifications()
    } catch (error) {
      console.error('Error generating notifications:', error)
      toast.error('ظپط´ظ„ طھظˆظ„ظٹط¯ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
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
      toast.success('طھظ… طھط­ط¯ظٹط¯ ط§ظ„طھظ†ط¨ظٹظ‡ ظƒظ…ظ‚ط±ظˆط،')
    } catch {
      toast.error('ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„طھظ†ط¨ظٹظ‡')
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
      toast.success('طھظ… طھط­ط¯ظٹط¯ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ظƒظ…ظ‚ط±ظˆط،ط©')
    } catch {
      toast.error('ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
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
      toast.success('طھظ… طھط­ط¯ظٹط¯ ط§ظ„طھظ†ط¨ظٹظ‡ ظƒط؛ظٹط± ظ…ظ‚ط±ظˆط،')
    } catch {
      toast.error('ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„طھظ†ط¨ظٹظ‡')
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
      toast.success('طھظ… طھط­ط¯ظٹط¯ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ظƒط؛ظٹط± ظ…ظ‚ط±ظˆط،ط©')
    } catch {
      toast.error('ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
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
      toast.success('طھظ… ط­ط°ظپ ط§ظ„طھظ†ط¨ظٹظ‡')
      setShowConfirmDeleteOne(false)
      setNotificationToDelete(null)
    } catch {
      toast.error('ظپط´ظ„ ط­ط°ظپ ط§ظ„طھظ†ط¨ظٹظ‡')
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
      toast.success('طھظ… ط­ط°ظپ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
      setShowConfirmDeleteAll(false)
    } catch {
      toast.error('ظپط´ظ„ ط­ط°ظپ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ')
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
      urgent: 'ط¹ط§ط¬ظ„',
      high: 'ط¹ط§ط¬ظ„',
      medium: 'ظ…طھظˆط³ط·',
      low: 'ظ…ظ†ط®ظپط¶'
    }
    return labels[priority as keyof typeof labels] || priority
  }

  // طھط·ط¨ظٹظ‚ ط§ظ„ظپظ„ط§طھط±
  const filteredNotifications = notifications.filter(notification => {
    // ظپظ„طھط± ط§ظ„ظ‚ط±ط§ط،ط©
    if (filterType === 'read' && !notification.is_read) return false
    if (filterType === 'unread' && notification.is_read) return false

    // ظپظ„طھط± ط§ظ„ط£ظˆظ„ظˆظٹط©
    if (priorityFilter !== 'all' && notification.priority !== priorityFilter) return false

    // ظپظ„طھط± ط§ظ„ط¨ط­ط«
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
              <h1 className="text-3xl font-bold text-gray-900">ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ</h1>
              <p className="text-gray-600 mt-1">
                {unreadCount > 0 ? `ظ„ط¯ظٹظƒ ${unreadCount} طھظ†ط¨ظٹظ‡ ط؛ظٹط± ظ…ظ‚ط±ظˆط،` : 'ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ظ…ظ‚ط±ظˆط،ط©'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleGenerateNotifications}
            disabled={generating}
          >
            <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'ط¬ط§ط±ظٹ ط§ظ„طھظˆظ„ظٹط¯...' : 'طھظˆظ„ظٹط¯ طھظ†ط¨ظٹظ‡ط§طھ ط¬ط¯ظٹط¯ط©'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="app-panel p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ</div>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
            <div className="text-sm text-blue-700">ط؛ظٹط± ظ…ظ‚ط±ظˆط،</div>
          </div>
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-red-700">ط¹ط§ط¬ظ„</div>
          </div>
          <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-sm text-orange-700">ط¹ط§ط¬ظ„</div>
          </div>
          <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-yellow-700">ظ…طھظˆط³ط·</div>
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
                  placeholder="ط§ظ„ط¨ط­ط« ظپظٹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ..."
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
                  <SelectValue placeholder="ط­ط§ظ„ط© ط§ظ„ظ‚ط±ط§ط،ط©" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ</SelectItem>
                  <SelectItem value="unread">ط؛ظٹط± ظ…ظ‚ط±ظˆط،</SelectItem>
                  <SelectItem value="read">ظ…ظ‚ط±ظˆط،</SelectItem>
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
                  <SelectValue placeholder="ط§ظ„ط£ظˆظ„ظˆظٹط©" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ط¬ظ…ظٹط¹ ط§ظ„ط£ظˆظ„ظˆظٹط§طھ</SelectItem>
                  <SelectItem value="urgent">ط¹ط§ط¬ظ„ ظپظ‚ط·</SelectItem>
                  <SelectItem value="high">ط¹ط§ط¬ظ„ ظپظ‚ط·</SelectItem>
                  <SelectItem value="medium">ظ…طھظˆط³ط· ظپظ‚ط·</SelectItem>
                  <SelectItem value="low">ظ…ظ†ط®ظپط¶ ظپظ‚ط·</SelectItem>
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
                طھط­ط¯ظٹط¯ ط§ظ„ظƒظ„ ظƒظ…ظ‚ط±ظˆط،
              </Button>
            )}
            {readCount > 0 && (
              <Button
                onClick={handleMarkAllAsUnread}
                variant="secondary"
                size="sm"
              >
                <Mail className="w-4 h-4" />
                طھط­ط¯ظٹط¯ ط§ظ„ظƒظ„ ظƒط؛ظٹط± ظ…ظ‚ط±ظˆط،
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                onClick={handleDeleteAll}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4" />
                ط­ط°ظپ ط§ظ„ظƒظ„
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">ظ„ط§ طھظˆط¬ط¯ طھظ†ط¨ظٹظ‡ط§طھ</h3>
            <p className="text-gray-600">
              {notifications.length === 0 
                ? 'ظ„ظ… ظٹطھظ… طھظˆظ„ظٹط¯ ط£ظٹ طھظ†ط¨ظٹظ‡ط§طھ ط¨ط¹ط¯. ط§ط¶ط؛ط· ط¹ظ„ظ‰ "طھظˆظ„ظٹط¯ طھظ†ط¨ظٹظ‡ط§طھ ط¬ط¯ظٹط¯ط©" ط£ط¹ظ„ط§ظ‡.'
                : 'ظ„ط§ طھظˆط¬ط¯ ظ†طھط§ط¦ط¬ طھط·ط§ط¨ظ‚ ط§ظ„ظپظ„ط§طھط± ط§ظ„ظ…ط­ط¯ط¯ط©'
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
                            ? `ظ…ظ†طھظ‡ظٹ ظ…ظ†ط° ${String(Math.abs(notification.days_remaining))} ظٹظˆظ…`
                            : `ط¨ط§ظ‚ظٹ ${String(notification.days_remaining)} ظٹظˆظ…`
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
                            ط§ظ„طھط§ط±ظٹط® ط§ظ„ظ…ط³طھظ‡ط¯ظپ: {formatDateShortWithHijri(notification.target_date)}
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
                          طھط­ط¯ظٹط¯ ظƒظ…ظ‚ط±ظˆط،
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleMarkAsUnread(notification.id)}
                          variant="secondary"
                          size="sm"
                        >
                          <Mail className="w-4 h-4" />
                          طھط­ط¯ظٹط¯ ظƒط؛ظٹط± ظ…ظ‚ط±ظˆط،
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(notification)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        ط­ط°ظپ
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
          title="ط­ط°ظپ ط§ظ„طھظ†ط¨ظٹظ‡"
          message={`ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ظ‡ط°ط§ ط§ظ„طھظ†ط¨ظٹظ‡: "${notificationToDelete?.title}"طں`}
          confirmText="ط­ط°ظپ"
          cancelText="ط¥ظ„ط؛ط§ط،"
          isDangerous={true}
          icon="alert"
        />

        <ConfirmationDialog
          isOpen={showConfirmDeleteAll}
          onClose={() => setShowConfirmDeleteAll(false)}
          onConfirm={handleConfirmDeleteAll}
          title="ط­ط°ظپ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ"
          message="ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھطں ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط، ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط±ط§ط¬ط¹ ط¹ظ†ظ‡."
          confirmText="ط­ط°ظپ"
          cancelText="ط¥ظ„ط؛ط§ط،"
          isDangerous={true}
          icon="alert"
        />
      </div>
    </Layout>
  )
}


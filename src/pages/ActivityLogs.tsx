import { useState, useEffect } from 'react'
import { supabase, ActivityLog } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import { 
  Activity, 
  User, 
  Calendar, 
  Filter, 
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Download
} from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'login' | 'logout'
type EntityFilter = 'all' | 'employee' | 'company' | 'user' | 'settings'

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error loading activity logs:', error)
      toast.error('فشل تحميل سجل النشاطات')
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) return <Plus className="w-4 h-4" />
    if (action.includes('update') || action.includes('edit')) return <Edit className="w-4 h-4" />
    if (action.includes('delete') || action.includes('remove')) return <Trash2 className="w-4 h-4" />
    if (action.includes('view') || action.includes('read')) return <Eye className="w-4 h-4" />
    if (action.includes('login')) return <User className="w-4 h-4" />
    return <Activity className="w-4 h-4" />
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50 border-green-200'
    if (action.includes('update') || action.includes('edit')) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50 border-red-200'
    if (action.includes('login')) return 'text-purple-600 bg-purple-50 border-purple-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'create': 'إنشاء',
      'update': 'تحديث',
      'delete': 'حذف',
      'login': 'تسجيل دخول',
      'logout': 'تسجيل خروج',
      'view': 'عرض',
      'export': 'تصدير',
      'import': 'استيراد'
    }
    return labels[action.toLowerCase()] || action
  }

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      'employee': 'موظف',
      'company': 'مؤسسة',
      'user': 'مستخدم',
      'settings': 'إعدادات',
      'notification': 'تنبيه',
      'custom_field': 'حقل مخصص'
    }
    return labels[entity?.toLowerCase()] || entity
  }

  const filteredLogs = logs.filter(log => {
    // فلتر البحث
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesAction = log.action.toLowerCase().includes(search)
      const matchesEntity = log.entity_type?.toLowerCase().includes(search)
      const matchesDetails = JSON.stringify(log.details).toLowerCase().includes(search)
      if (!matchesAction && !matchesEntity && !matchesDetails) return false
    }

    // فلتر العملية
    if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter)) return false

    // فلتر نوع الكيان
    if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false

    return true
  })

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">سجل النشاطات</h1>
              <p className="text-gray-600 mt-1">تتبع جميع الإجراءات في النظام</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadLogs}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث
            </button>
            <button
              onClick={() => toast.info('ميزة التصدير قيد التطوير')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Download className="w-5 h-5" />
              تصدير Excel
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
            <div className="text-sm text-gray-600">إجمالي السجلات</div>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.action.includes('create') || l.action.includes('add')).length}
            </div>
            <div className="text-sm text-green-700">عمليات إنشاء</div>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-600">
              {logs.filter(l => l.action.includes('update') || l.action.includes('edit')).length}
            </div>
            <div className="text-sm text-blue-700">عمليات تحديث</div>
          </div>
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-600">
              {logs.filter(l => l.action.includes('delete') || l.action.includes('remove')).length}
            </div>
            <div className="text-sm text-red-700">عمليات حذف</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث في السجلات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="all">جميع العمليات</option>
                <option value="create">إنشاء فقط</option>
                <option value="update">تحديث فقط</option>
                <option value="delete">حذف فقط</option>
                <option value="login">تسجيل دخول/خروج</option>
              </select>
            </div>

            {/* Entity Filter */}
            <div>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="all">جميع الأنواع</option>
                <option value="employee">موظفين</option>
                <option value="company">مؤسسات</option>
                <option value="user">مستخدمين</option>
                <option value="settings">إعدادات</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد سجلات</h3>
            <p className="text-gray-600">
              {logs.length === 0 
                ? 'لم يتم تسجيل أي نشاطات بعد'
                : 'لا توجد نتائج تطابق الفلاتر المحددة'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">العملية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">نوع الكيان</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المستخدم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">عنوان IP</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التاريخ والوقت</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(log.action)}`}>
                          {getActionIcon(log.action)}
                          {getActionLabel(log.action)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {log.entity_type ? getEntityLabel(log.entity_type) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {log.user_id ? (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-xs">{String(log.user_id).slice(0, 8)}...</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">النظام</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                        >
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold">تفاصيل النشاط</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العملية</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(selectedLog.action)}`}>
                    {getActionIcon(selectedLog.action)}
                    {getActionLabel(selectedLog.action)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع الكيان</label>
                  <p className="text-gray-900">{selectedLog.entity_type ? getEntityLabel(selectedLog.entity_type) : '-'}</p>
                </div>

                {selectedLog.entity_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">معرف الكيان</label>
                    <p className="text-gray-900 font-mono text-sm">{selectedLog.entity_id}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ والوقت</label>
                  <p className="text-gray-900">{format(new Date(selectedLog.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ar })}</p>
                </div>

                {selectedLog.user_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">معرف المستخدم</label>
                    <p className="text-gray-900 font-mono text-sm">{selectedLog.user_id}</p>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">عنوان IP</label>
                    <p className="text-gray-900 font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">التفاصيل الكاملة</label>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

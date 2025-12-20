import { useState, useEffect } from 'react'
import { supabase, ActivityLog, User } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'
import { 
  Activity, 
  User as UserIcon, 
  Calendar, 
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  Building2,
  Clock,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  AlertCircle,
  X
} from 'lucide-react'
import { formatDateTimeWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { usePermissions } from '@/utils/permissions'

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'login' | 'logout'
type EntityFilter = 'all' | 'employee' | 'company' | 'user' | 'settings'
type DateFilter = 'all' | 'today' | 'week' | 'month'

export default function ActivityLogs() {
  const { user } = useAuth()
  const { canView } = usePermissions()
  const isAdmin = user?.role === 'admin'
  
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteAllMode, setDeleteAllMode] = useState(false)
  const [deleteFromDatabase, setDeleteFromDatabase] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  useEffect(() => {
    loadLogs()
  }, [])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, actionFilter, entityFilter, dateFilter])

  // إغلاق بطاقة التفاصيل عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedLog) {
        setSelectedLog(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedLog])

  // التحقق من صلاحية العرض - بعد جميع الـ hooks
  if (!canView('activityLogs')) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

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

      // جلب بيانات المستخدمين
      const userIds = new Set<string>()
      data?.forEach(log => {
        if (log.user_id) {
          userIds.add(log.user_id)
        }
      })

      if (userIds.size > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', Array.from(userIds))

        if (usersError) {
          console.error('Error loading users:', usersError)
        } else if (usersData) {
          const users = new Map<string, User>()
          usersData.forEach(user => {
            users.set(user.id, {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: 'user' as const,
              permissions: {},
              is_active: true,
              created_at: new Date().toISOString()
            })
          })
          setUsersMap(users)
        }
      }
    } catch (error) {
      console.error('Error loading activity logs:', error)
      toast.error('فشل تحميل سجل النشاطات')
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase()
    if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('إنشاء') || actionLower.includes('إضافة')) 
      return <Plus className="w-5 h-5" />
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('تحديث') || actionLower.includes('تعديل')) 
      return <Edit className="w-5 h-5" />
    if (actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('حذف')) 
      return <Trash2 className="w-5 h-5" />
    if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('عرض')) 
      return <Eye className="w-5 h-5" />
    if (actionLower.includes('login') || actionLower.includes('دخول')) 
      return <LogIn className="w-5 h-5" />
    if (actionLower.includes('logout') || actionLower.includes('خروج')) 
      return <LogOut className="w-5 h-5" />
    return <Activity className="w-5 h-5" />
  }

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase()
    if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('إنشاء') || actionLower.includes('إضافة')) 
      return {
        bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
        border: 'border-l-4 border-green-500',
        text: 'text-green-700',
        badge: 'bg-green-100 text-green-800',
        icon: 'bg-green-100 text-green-600'
      }
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('تحديث') || actionLower.includes('تعديل')) 
      return {
        bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
        border: 'border-l-4 border-blue-500',
        text: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800',
        icon: 'bg-blue-100 text-blue-600'
      }
    if (actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('حذف')) 
      return {
        bg: 'bg-gradient-to-br from-red-50 to-rose-50',
        border: 'border-l-4 border-red-500',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-800',
        icon: 'bg-red-100 text-red-600'
      }
    if (actionLower.includes('login') || actionLower.includes('دخول')) 
      return {
        bg: 'bg-gradient-to-br from-purple-50 to-violet-50',
        border: 'border-l-4 border-purple-500',
        text: 'text-purple-700',
        badge: 'bg-purple-100 text-purple-800',
        icon: 'bg-purple-100 text-purple-600'
      }
    if (actionLower.includes('logout') || actionLower.includes('خروج')) 
      return {
        bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
        border: 'border-l-4 border-orange-500',
        text: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-800',
        icon: 'bg-orange-100 text-orange-600'
      }
    return {
      bg: 'bg-gray-50',
      border: 'border-l-4 border-gray-300',
      text: 'text-gray-700',
      badge: 'bg-gray-100 text-gray-800',
      icon: 'bg-gray-100 text-gray-600'
    }
  }

  const isImportantAction = (action: string) => {
    const actionLower = action.toLowerCase()
    return actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('حذف')
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

  const getFieldLabel = (key: string): string => {
    const fieldLabels: Record<string, string> = {
      'name': 'الاسم',
      'phone': 'رقم الهاتف',
      'profession': 'المهنة',
      'nationality': 'الجنسية',
      'residence_number': 'رقم الإقامة',
      'passport_number': 'رقم الجواز',
      'bank_account': 'الحساب البنكي',
      'salary': 'الراتب',
      'project_id': 'المشروع',
      'company_id': 'المؤسسة',
      'birth_date': 'تاريخ الميلاد',
      'joining_date': 'تاريخ الالتحاق',
      'residence_expiry': 'تاريخ انتهاء الإقامة',
      'contract_expiry': 'تاريخ انتهاء العقد',
      'hired_worker_contract_expiry': 'تاريخ انتهاء عقد أجير',
      'ending_subscription_insurance_date': 'تاريخ انتهاء اشتراك التأمين',
      'health_insurance_expiry': 'تاريخ انتهاء التأمين الصحي',
      'notes': 'الملاحظات',
      'unified_number': 'الرقم الموحد',
      'tax_number': 'الرقم الضريبي',
      'commercial_registration_number': 'رقم السجل التجاري',
      'exemptions': 'الاعفاءات',
      'additional_fields': 'حقول إضافية',
      'residence_image_url': 'صورة الإقامة'
    }
    return fieldLabels[key] || key
  }

  const isUselessSystemId = (value: unknown): boolean => {
    if (value === null || value === undefined || value === '') return true
    const strValue = String(value).trim()
    // UUID أو معرفات طويلة بدون معنى للمستخدم
    if (strValue.length > 20 && /^[a-f0-9-]{20,}$/.test(strValue)) return true
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/.test(strValue)) return true
    return false
  }

  const formatDisplayValue = (value: unknown): string | null => {
    // إذا كانت القيمة معرف نظام بدون فائدة
    if (isUselessSystemId(value)) {
      return null
    }

    // تحويل إلى string
    const strValue = String(value).trim()

    // حالات خاصة:
    // 1. تاريخ ISO (YYYY-MM-DD أو مشابه)
    if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
      return strValue
    }

    // 2. قيمة عادية وواضحة - عرضها كما هي
    if (strValue && strValue.length < 200) {
      return strValue
    }

    // 3. JSON أو بيانات معقدة - لا نعرضها
    if (strValue.startsWith('{') || strValue.startsWith('[')) {
      return null
    }

    return strValue
  }

  const renderUpdateDetails = (log: ActivityLog): JSX.Element => {
    const entityType = log.entity_type?.toLowerCase() || ''
    const entityLabel = getEntityLabel(entityType)
    const details = log.details || {}
    const employeeName = details.employee_name || details.name
    const companyName = details.company_name || details.company
    
    // محاولة استخراج old_data و new_data
    let oldData: Record<string, unknown> | null = null
    let newData: Record<string, unknown> | null = null
    let hasValidData = false
    
    try {
      if (typeof log.old_data === 'string') {
        oldData = JSON.parse(log.old_data) as Record<string, unknown>
      } else if (log.old_data && typeof log.old_data === 'object') {
        oldData = log.old_data as Record<string, unknown>
      }
      
      if (typeof log.new_data === 'string') {
        newData = JSON.parse(log.new_data) as Record<string, unknown>
      } else if (log.new_data && typeof log.new_data === 'object') {
        newData = log.new_data as Record<string, unknown>
      }
      
      // التحقق من أن البيانات صحيحة وليست فارغة
      hasValidData = (oldData && Object.keys(oldData).length > 0) || 
                     (newData && Object.keys(newData).length > 0)
    } catch {
      // تجاهل أخطاء التحليل
    }
    
    // جمع التغييرات
    const changeList: Array<{ field: string; fieldKey: string; oldValue: string | null; newValue: string | null; hasActualChange: boolean }> = []
    
    // استخراج التغييرات من old_data و new_data - الأكثر موثوقية
    if (oldData && newData) {
      // أحصل على جميع المفاتيح من oldData و newData
      const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
      
      allKeys.forEach(key => {
        const oldValue = oldData?.[key]
        const newValue = newData?.[key]
        
        // تخطي معرفات النظام
        if (isUselessSystemId(oldValue) && isUselessSystemId(newValue)) {
          return
        }
        
        // فقط أضف إذا كانت القيم مختلفة فعلاً
        if (oldValue !== newValue) {
          const fieldLabel = getFieldLabel(key)
          const displayedOldValue = formatDisplayValue(oldValue)
          const displayedNewValue = formatDisplayValue(newValue)
          
          // تحديد ما إذا كان هناك تغيير فعلي
          const oldEmpty = !oldValue || oldValue === '' || displayedOldValue === null
          const newEmpty = !newValue || newValue === '' || displayedNewValue === null
          
          // تجنب التكرار
          if (!changeList.some(c => c.field === fieldLabel)) {
            changeList.push({
              field: fieldLabel,
              fieldKey: key,
              oldValue: displayedOldValue,
              newValue: displayedNewValue,
              hasActualChange: !oldEmpty || !newEmpty // هناك تغيير إذا لم تكن كلاهما فارغة
            })
          }
        }
      })
    }
    
    // تصفية التغييرات الفعلية فقط
    const actualChanges = changeList.filter(c => c.hasActualChange)

    // تحديد اسم الكيان وعنوان محسّن
    let entityName = ''
    let changedFieldsText = ''
    
    if (actualChanges.length > 0) {
      const fieldNames = actualChanges.map(c => c.field).join(' و ')
      changedFieldsText = ` (تحديث ${fieldNames})`
    }
    
    if (entityType === 'employee' && employeeName) {
      entityName = String(employeeName)
    } else if (entityType === 'company' && companyName) {
      entityName = String(companyName)
    }

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            {entityName 
              ? `تم تحديث ${entityLabel} "${entityName}"${changedFieldsText}`
              : `تم تحديث ${entityLabel}${changedFieldsText}`
            }
          </h4>
        </div>
        
        {actualChanges.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800 font-medium">التفاصيل ({actualChanges.length})</p>
            </div>
            <div className="space-y-3">
              {actualChanges.map((change, index) => (
                <div key={index} className="border-r-4 border-purple-400 bg-purple-50 p-4 rounded-lg">
                  <div className="font-semibold text-gray-900 mb-3 text-base">
                    ✏️ {change.field}
                  </div>
                  <div className="space-y-3 ml-4">
                    {/* حالة: تم تغيير القيمة من قيمة قديمة إلى جديدة */}
                    {change.oldValue && change.newValue && (
                      <>
                        <div>
                          <span className="text-xs font-medium text-gray-600 block mb-2">كان:</span>
                          <div className="px-3 py-2 bg-red-50 text-red-700 rounded-md text-sm border border-red-200 font-medium break-words">
                            {change.oldValue}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="inline-block text-gray-400 text-lg">↓</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-600 block mb-2">أصبح:</span>
                          <div className="px-3 py-2 bg-green-50 text-green-700 rounded-md text-sm border border-green-200 font-medium break-words">
                            {change.newValue}
                          </div>
                        </div>
                      </>
                    )}

                    {/* حالة: تم إضافة قيمة جديدة (لم تكن موجودة من قبل) */}
                    {!change.oldValue && change.newValue && (
                      <div>
                        <span className="text-xs font-medium text-gray-600 block mb-2">تم الإضافة (لم يكن هناك قيمة من قبل)</span>
                        <div className="px-3 py-2 bg-green-50 text-green-700 rounded-md text-sm border border-green-200 font-medium break-words">
                          {change.newValue}
                        </div>
                      </div>
                    )}

                    {/* حالة: تم حذف القيمة (كانت موجودة وتم حذفها) */}
                    {change.oldValue && !change.newValue && (
                      <div>
                        <span className="text-xs font-medium text-gray-600 block mb-2">تم الحذف</span>
                        <div className="px-3 py-2 bg-orange-50 text-orange-700 rounded-md text-sm border border-orange-200 font-medium">
                          (تم مسح القيمة: {change.oldValue})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !hasValidData ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900 text-sm mb-1">⚠️ لم يتم حفظ تفاصيل التغييرات</p>
                <p className="text-yellow-800 text-xs leading-relaxed">
                  تم تسجيل عملية التحديث لكن لم يتم حفظ البيانات القديمة والجديدة. تأكد من أن النظام يحفظ old_data و new_data بشكل صحيح.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-700 text-sm mb-1">تم التحديث</p>
                <p className="text-gray-600 text-xs leading-relaxed">
                  لم يتم العثور على حقول محددة تم تغييرها، لكن تم تسجيل العملية بنجاح.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const generateActivityDescription = (log: ActivityLog): string | JSX.Element => {
    const action = log.action.toLowerCase()
    const entityType = log.entity_type?.toLowerCase() || ''
    const entityLabel = getEntityLabel(entityType)
    
    // استخراج المعلومات من details
    const details = log.details || {}
    const employeeName = details.employee_name || details.name
    const companyName = details.company_name || details.company
    const unifiedNumber = details.unified_number
    
    // استخراج التغييرات المحددة من details.changes إذا كانت موجودة
    let changedFieldLabels: string[] = []
    
    try {
      // حاول الحصول على الأسماء المترجمة من details.changes أولاً
      if (details.changes && typeof details.changes === 'object') {
        const detailsChanges = details.changes as Record<string, unknown>
        // إذا كانت لدينا التغييرات المترجمة من details، استخدمها مباشرة
        changedFieldLabels = Object.keys(detailsChanges)
      } else {
        // إذا لم نجد التغييرات المترجمة، حاول قراءة old_data و new_data
        let oldData: Record<string, unknown> | null = null
        let newData: Record<string, unknown> | null = null
        
        if (typeof log.old_data === 'string') {
          oldData = JSON.parse(log.old_data) as Record<string, unknown>
        } else if (log.old_data && typeof log.old_data === 'object') {
          oldData = log.old_data as Record<string, unknown>
        }
        
        if (typeof log.new_data === 'string') {
          newData = JSON.parse(log.new_data) as Record<string, unknown>
        } else if (log.new_data && typeof log.new_data === 'object') {
          newData = log.new_data as Record<string, unknown>
        }
        
        // استخراج الحقول المتغيرة
        if (oldData && newData) {
          const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
          allKeys.forEach(key => {
            const oldValue = oldData?.[key]
            const newValue = newData?.[key]
            
            // تخطي معرفات النظام
            if (isUselessSystemId(oldValue) && isUselessSystemId(newValue)) {
              return
            }
            
            if (oldValue !== newValue) {
              changedFieldLabels.push(getFieldLabel(key))
            }
          })
        }
      }
    } catch {
      // تجاهل الأخطاء
    }
    
    // بناء النص حسب نوع العملية
    if (action.includes('create') || action.includes('add') || action.includes('إنشاء') || action.includes('إضافة')) {
      if (entityType === 'employee' && employeeName) {
        return `تم إنشاء موظف جديد باسم "${employeeName}"${companyName ? ` في المؤسسة "${companyName}"` : ''}.`
      } else if (entityType === 'company' && companyName) {
        const companyDisplay = unifiedNumber ? `${companyName} (${unifiedNumber})` : companyName
        return `تم إنشاء مؤسسة جديدة باسم "${companyDisplay}".`
      } else if (entityType === 'user') {
        return `تم إنشاء مستخدم جديد.`
      } else {
        return `تم إنشاء ${entityLabel} جديد.`
      }
    }
    
    if (action.includes('update') || action.includes('edit') || action.includes('تحديث') || action.includes('تعديل')) {
      // إذا كان لدينا حقول محددة، استخدمها في الوصف
      if (changedFieldLabels.length > 0) {
        const fieldNames = changedFieldLabels.join(' و ')
        if (entityType === 'employee' && employeeName) {
          return `تم تحديث موظف "${employeeName}" - تحديث ${fieldNames}${companyName ? ` من ${companyName}` : ''}.`
        } else if (entityType === 'company' && companyName) {
          const companyDisplay = unifiedNumber ? `${companyName} (${unifiedNumber})` : companyName
          return `تم تحديث مؤسسة "${companyDisplay}" - تحديث ${fieldNames}.`
        }
      }
      // إرجع الدالة الكاملة للتفاصيل
      return renderUpdateDetails(log)
    }
    
    if (action.includes('delete') || action.includes('remove') || action.includes('حذف')) {
      if (entityType === 'employee' && employeeName) {
        return `تم حذف الموظف "${employeeName}"${companyName ? ` من المؤسسة "${companyName}"` : ''}.`
      } else if (entityType === 'company' && companyName) {
        const companyDisplay = unifiedNumber ? `${companyName} (${unifiedNumber})` : companyName
        return `تم حذف المؤسسة "${companyDisplay}".`
      } else if (entityType === 'user') {
        return `تم حذف مستخدم.`
      } else {
        return `تم حذف ${entityLabel}.`
      }
    }
    
    if (action.includes('login') || action.includes('دخول')) {
      return `تم تسجيل دخول المستخدم.`
    }
    
    if (action.includes('logout') || action.includes('خروج')) {
      return `تم تسجيل خروج المستخدم.`
    }
    
    if (action.includes('export') || action.includes('تصدير')) {
      return `تم تصدير البيانات.`
    }
    
    if (action.includes('import') || action.includes('استيراد')) {
      return `تم استيراد البيانات.`
    }
    
    // إذا لم يتم التعرف على العملية، إرجاع نص عام
    if (employeeName) {
      return `تم تنفيذ العملية "${getActionLabel(log.action)}" على الموظف "${employeeName}".`
    } else if (companyName) {
      return `تم تنفيذ العملية "${getActionLabel(log.action)}" على المؤسسة "${companyName}".`
    } else {
      return `تم تنفيذ العملية "${getActionLabel(log.action)}" على ${entityLabel}.`
    }
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

    // فلتر العملية - تحسين المطابقة
    if (actionFilter !== 'all') {
      const actionLower = log.action.toLowerCase()
      const filterLower = actionFilter.toLowerCase()
      
      // مطابقة دقيقة بدلاً من includes
      const isMatch = 
        actionLower === filterLower || // مطابقة دقيقة
        actionLower.includes(filterLower) || // احتواء
        // معالجة حالات خاصة للعربية والإنجليزية
        (filterLower === 'create' && (actionLower.includes('create') || actionLower.includes('إنشاء') || actionLower.includes('add') || actionLower.includes('إضافة'))) ||
        (filterLower === 'update' && (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('تحديث') || actionLower.includes('تعديل'))) ||
        (filterLower === 'delete' && (actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('حذف'))) ||
        (filterLower === 'login' && (actionLower.includes('login') || actionLower.includes('logout') || actionLower.includes('دخول') || actionLower.includes('خروج')))
      
      if (!isMatch) return false
    }

    // فلتر نوع الكيان - تصحيح حساسية الأحرف
    if (entityFilter !== 'all') {
      const entityTypeLower = log.entity_type?.toLowerCase() || ''
      const entityFilterLower = entityFilter.toLowerCase()
      
      if (entityTypeLower !== entityFilterLower) return false
    }

    // فلتر التاريخ - تحسين المنطق
    if (dateFilter !== 'all') {
      const logDate = new Date(log.created_at)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      if (dateFilter === 'today' && (logDate < today || logDate >= tomorrow)) return false
      if (dateFilter === 'week' && logDate < weekAgo) return false
      if (dateFilter === 'month' && logDate < monthAgo) return false
    }

    return true
  })

  // حساب الإحصائيات (باستخدام filteredLogs)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const todayLogs = filteredLogs.filter(log => {
    const logDate = new Date(log.created_at)
    return logDate >= today
  })
  const weekLogs = filteredLogs.filter(log => {
    const logDate = new Date(log.created_at)
    return logDate >= weekAgo
  })
  const employeeLogs = filteredLogs.filter(log => log.entity_type?.toLowerCase() === 'employee')
  const companyLogs = filteredLogs.filter(log => log.entity_type?.toLowerCase() === 'company')
  const createLogs = filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('create') || action.includes('add') || action.includes('إنشاء') || action.includes('إضافة')
  })
  const updateLogs = filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('update') || action.includes('edit') || action.includes('تحديث') || action.includes('تعديل')
  })
  const deleteLogs = filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('delete') || action.includes('remove') || action.includes('حذف')
  })

  // دوال التحديد والحذف
  const handleSelectAll = () => {
    if (selectedLogIds.size === paginatedLogs.length && paginatedLogs.every(log => selectedLogIds.has(log.id))) {
      // إلغاء تحديد جميع العناصر في الصفحة الحالية
      const newSelected = new Set(selectedLogIds)
      paginatedLogs.forEach(log => newSelected.delete(log.id))
      setSelectedLogIds(newSelected)
    } else {
      // تحديد جميع العناصر في الصفحة الحالية
      const newSelected = new Set(selectedLogIds)
      paginatedLogs.forEach(log => newSelected.add(log.id))
      setSelectedLogIds(newSelected)
    }
  }

  const handleSelectLog = (logId: number) => {
    const newSelected = new Set(selectedLogIds)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogIds(newSelected)
  }

  const handleDeleteSelected = () => {
    if (selectedLogIds.size === 0) {
      toast.error('لم يتم تحديد أي نشاطات للحذف')
      return
    }
    setDeleteAllMode(false)
    setDeleteFromDatabase(false) // افتراضي: حذف من العرض فقط
    setShowDeleteModal(true)
  }

  const handleDeleteAll = () => {
    if (filteredLogs.length === 0) {
      toast.error('لا توجد نشاطات للحذف')
      return
    }
    setDeleteAllMode(true)
    setDeleteFromDatabase(false) // افتراضي: حذف المعروض فقط
    setShowDeleteModal(true)
  }

  // دالة لحذف جميع السجلات من قاعدة البيانات
  const deleteAllFromDatabase = async (): Promise<number> => {
    let totalDeleted = 0
    const batchSize = 500
    
    // جلب جميع IDs من قاعدة البيانات بدون limit
    let hasMore = true
    let offset = 0
    
    while (hasMore) {
      const { data: batchData, error: fetchError } = await supabase
        .from('activity_log')
        .select('id')
        .order('id', { ascending: true })
        .range(offset, offset + batchSize - 1)
      
      if (fetchError) {
        console.error('[ActivityLogs] Error fetching batch for deletion:', fetchError)
        throw fetchError
      }
      
      if (!batchData || batchData.length === 0) {
        hasMore = false
        break
      }
      
      const batchIds = batchData.map(log => log.id)
      
      // حذف الدفعة
      const { data: deletedData, error: deleteError } = await supabase
        .from('activity_log')
        .delete()
        .in('id', batchIds)
        .select()
      
      if (deleteError) {
        console.error(`[ActivityLogs] Error deleting batch:`, deleteError)
        throw deleteError
      }
      
      const actualDeleted = deletedData?.length || 0
      totalDeleted += actualDeleted
      
      logger.debug(`[ActivityLogs] Deleted batch: ${actualDeleted} rows, Total: ${totalDeleted}`)
      
      // إذا كانت الدفعة أقل من batchSize، يعني وصلنا للنهاية
      if (batchData.length < batchSize) {
        hasMore = false
      } else {
        offset += batchSize
      }
    }
    
    return totalDeleted
  }

  const confirmDelete = async () => {
    if (!isAdmin) {
      toast.error('غير مصرح لك بحذف سجل النشاطات')
      return
    }

    setDeleting(true)
    try {
      if (deleteAllMode) {
        if (deleteFromDatabase) {
          // حذف جميع السجلات من قاعدة البيانات
          logger.debug('[ActivityLogs] Starting delete of ALL logs from database')
          
          const totalDeleted = await deleteAllFromDatabase()
          
          if (totalDeleted === 0) {
            toast.error('فشل حذف النشاطات. قد تكون هناك مشكلة في الصلاحيات أو RLS policies')
            console.error('[ActivityLogs] No rows were deleted. Check RLS policies for DELETE on activity_log table')
          } else {
            toast.success(`تم حذف جميع النشاطات من قاعدة البيانات (${totalDeleted} نشاط) بنجاح`)
          }
          
          setLogs([])
          setUsersMap(new Map())
          await loadLogs()
        } else {
          // حذف السجلات المعروضة فقط
          const allIds = logs.map(log => log.id)
          
          if (allIds.length === 0) {
            toast.error('لا توجد نشاطات للحذف')
            setDeleting(false)
            return
          }

          logger.debug(`[ActivityLogs] Starting delete of ${allIds.length} visible logs`)

          // حذف بالدفعات
          const batchSize = 500
          let deletedCount = 0
          let failedBatches = 0
          
          for (let i = 0; i < allIds.length; i += batchSize) {
            const batch = allIds.slice(i, i + batchSize)
            logger.debug(`[ActivityLogs] Deleting batch ${Math.floor(i / batchSize) + 1}, IDs: ${batch.length}`)
            
            const { data, error } = await supabase
              .from('activity_log')
              .delete()
              .in('id', batch)
              .select()

            if (error) {
              console.error(`[ActivityLogs] Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error)
              failedBatches++
              continue
            }
            
            const actualDeleted = data?.length || 0
            logger.debug(`[ActivityLogs] Batch ${Math.floor(i / batchSize) + 1} deleted: ${actualDeleted} rows`)
            deletedCount += actualDeleted
          }

          if (failedBatches > 0) {
            toast.error(`تم حذف ${deletedCount} نشاط من ${allIds.length}. فشل حذف ${failedBatches} دفعة`)
          } else if (deletedCount === 0) {
            toast.error('فشل حذف النشاطات. قد تكون هناك مشكلة في الصلاحيات أو RLS policies')
            console.error('[ActivityLogs] No rows were deleted. Check RLS policies for DELETE on activity_log table')
          } else {
            toast.success(`تم حذف السجلات المعروضة (${deletedCount} نشاط) بنجاح`)
          }

          setLogs([])
          setUsersMap(new Map())
          await loadLogs()
        }
      } else {
        // حذف النشاطات المحددة
        const idsToDelete = Array.from(selectedLogIds)
        if (idsToDelete.length === 0) {
          toast.error('لم يتم تحديد أي نشاطات للحذف')
          setDeleting(false)
          return
        }

        if (deleteFromDatabase) {
          // حذف من قاعدة البيانات
          logger.debug(`[ActivityLogs] Starting delete of ${idsToDelete.length} selected logs from database`)

          // حذف بالدفعات إذا كان العدد كبير (أكثر من 1000)
          const batchSize = 1000
          let deletedCount = 0
          
          if (idsToDelete.length > batchSize) {
            for (let i = 0; i < idsToDelete.length; i += batchSize) {
              const batch = idsToDelete.slice(i, i + batchSize)
              logger.debug(`[ActivityLogs] Deleting batch ${Math.floor(i / batchSize) + 1}, IDs: ${batch.length}`)
              
              const { data, error } = await supabase
                .from('activity_log')
                .delete()
                .in('id', batch)
                .select()

              if (error) {
                console.error(`[ActivityLogs] Error deleting batch:`, error)
                throw error
              }
              
              const actualDeleted = data?.length || 0
              logger.debug(`[ActivityLogs] Batch deleted: ${actualDeleted} rows`)
              deletedCount += actualDeleted
            }
          } else {
            const { data, error } = await supabase
              .from('activity_log')
              .delete()
              .in('id', idsToDelete)
              .select()

            if (error) {
              console.error('[ActivityLogs] Error deleting logs:', error)
              throw error
            }
            
            deletedCount = data?.length || 0
            logger.debug(`[ActivityLogs] Deleted: ${deletedCount} rows`)
          }

          if (deletedCount === 0) {
            toast.error('فشل حذف النشاطات. قد تكون هناك مشكلة في الصلاحيات أو RLS policies')
            console.error('[ActivityLogs] No rows were deleted. Check RLS policies for DELETE on activity_log table')
          } else if (deletedCount < idsToDelete.length) {
            toast.warning(`تم حذف ${deletedCount} نشاط من ${idsToDelete.length} محدد من قاعدة البيانات`)
          } else {
            toast.success(`تم حذف ${deletedCount} نشاط من قاعدة البيانات بنجاح`)
          }

          // إعادة تحميل البيانات للتأكد من التحديث
          await loadLogs()
          setSelectedLogIds(new Set())
        } else {
          // حذف من العرض فقط - إزالة السجلات المحددة من state فقط
          logger.debug(`[ActivityLogs] Removing ${idsToDelete.length} selected logs from display only`)
          
          const updatedLogs = logs.filter(log => !idsToDelete.includes(log.id))
          setLogs(updatedLogs)
          
          // إزالة المستخدمين الذين لم يعودوا موجودين في السجلات
          const remainingUserIds = new Set<string>()
          updatedLogs.forEach(log => {
            if (log.user_id) {
              remainingUserIds.add(log.user_id)
            }
          })
          
          const updatedUsersMap = new Map<string, User>()
          remainingUserIds.forEach(userId => {
            const user = usersMap.get(userId)
            if (user) {
              updatedUsersMap.set(userId, user)
            }
          })
          setUsersMap(updatedUsersMap)
          
          toast.success(`تم إزالة ${idsToDelete.length} نشاط من العرض`)
          setSelectedLogIds(new Set())
        }
      }

      setShowDeleteModal(false)
      setDeleteAllMode(false)
      setDeleteFromDatabase(false)
    } catch (error: unknown) {
      console.error('Error deleting logs:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'فشل في حذف النشاطات')
    } finally {
      setDeleting(false)
    }
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  const allSelected = paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogIds.has(log.id))
  const someSelected = paginatedLogs.some(log => selectedLogIds.has(log.id)) && !allSelected

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredLogs.map(log => {
      let userDisplay = 'النظام'
      if (log.user_id) {
        const user = usersMap.get(log.user_id)
        if (user) {
          userDisplay = `${user.full_name} (${user.email})`
        } else {
          userDisplay = String(log.user_id).slice(0, 8) + '...'
        }
      }
      return {
        'العملية': getActionLabel(log.action),
        'نوع الكيان': log.entity_type ? getEntityLabel(log.entity_type) : '-',
        'معرف الكيان': log.entity_id || '-',
        'المستخدم': userDisplay,
        'عنوان IP': log.ip_address || '-',
        'التاريخ والوقت': formatDateTimeWithHijri(log.created_at),
        'التفاصيل': JSON.stringify(log.details || {}, null, 2)
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل النشاطات')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `سجل_النشاطات_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('تم تصدير البيانات بنجاح')
  }

  return (
    <Layout>
      <div className="p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <Activity className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">سجل النشاطات</h1>
              <p className="text-xs text-gray-600 mt-0 sm:mt-0.5">تتبع الإجراءات</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            {isAdmin && selectedLogIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-600 text-white rounded hover:bg-red-700 transition whitespace-nowrap text-xs"
              >
                <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="hidden sm:inline">حذف ({selectedLogIds.size})</span>
                <span className="sm:hidden">حذف</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-600 text-white rounded hover:bg-red-700 transition whitespace-nowrap text-xs"
              >
                <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="hidden sm:inline">حذف الكل</span>
                <span className="sm:hidden">حذف</span>
              </button>
            )}
            <button
              onClick={loadLogs}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-xs"
            >
              <RefreshCw className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-xs"
            >
              <Download className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6 overflow-hidden">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">{filteredLogs.length}</div>
                  <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">السجلات</div>
                </div>
                <div className="bg-purple-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Activity className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-green-600">{createLogs.length}</div>
                  <div className="text-xs text-green-700 mt-0.5 line-clamp-1">إنشاء</div>
                </div>
                <div className="bg-green-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Plus className="w-3 sm:w-4 h-3 sm:h-4 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-blue-600">{updateLogs.length}</div>
                  <div className="text-xs text-blue-700 mt-0.5 line-clamp-1">تحديث</div>
                </div>
                <div className="bg-blue-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Edit className="w-3 sm:w-4 h-3 sm:h-4 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-red-600">{deleteLogs.length}</div>
                  <div className="text-xs text-red-700 mt-0.5 line-clamp-1">حذف</div>
                </div>
                <div className="bg-red-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Trash2 className="w-3 sm:w-4 h-3 sm:h-4 text-red-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-purple-600">{todayLogs.length}</div>
                  <div className="text-xs text-purple-700 mt-0.5 line-clamp-1">اليوم</div>
                </div>
                <div className="bg-purple-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Calendar className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-orange-600">{weekLogs.length}</div>
                  <div className="text-xs text-orange-700 mt-0.5 line-clamp-1">الأسبوع</div>
                </div>
                <div className="bg-orange-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-orange-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-50 rounded-lg shadow-sm border border-indigo-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-indigo-600">{employeeLogs.length}</div>
                  <div className="text-xs text-indigo-700 mt-0.5 line-clamp-1">الموظفين</div>
                </div>
                <div className="bg-indigo-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <UserIcon className="w-3 sm:w-4 h-3 sm:h-4 text-indigo-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-teal-50 rounded-lg shadow-sm border border-teal-200 p-2 sm:p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-teal-600">{companyLogs.length}</div>
                  <div className="text-xs text-teal-700 mt-0.5 line-clamp-1">المؤسسات</div>
                </div>
                <div className="bg-teal-100 p-1.5 sm:p-2 rounded flex-shrink-0">
                  <Building2 className="w-3 sm:w-4 h-3 sm:h-4 text-teal-600" />
                </div>
              </div>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">الفلاتر</h3>
              {(searchTerm || actionFilter !== 'all' || entityFilter !== 'all' || dateFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setActionFilter('all')
                    setEntityFilter('all')
                    setDateFilter('all')
                    setCurrentPage(1)
                  }}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  إعادة تعيين
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 sm:w-5 h-4 sm:h-5" />
                  <input
                    type="text"
                    placeholder="البحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 sm:pr-10 pl-3 sm:pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Action Filter */}
              <div>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
                  className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">جميع العمليات</option>
                  <option value="create">إنشاء</option>
                  <option value="update">تحديث</option>
                  <option value="delete">حذف</option>
                  <option value="login">دخول/خروج</option>
                </select>
              </div>

              {/* Entity Filter */}
              <div>
                <select
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
                  className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">جميع الأنواع</option>
                  <option value="employee">موظفين</option>
                  <option value="company">مؤسسات</option>
                  <option value="user">مستخدمين</option>
                  <option value="settings">إعدادات</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="w-full px-2 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">جميع التواريخ</option>
                  <option value="today">اليوم</option>
                  <option value="week">أسبوع</option>
                  <option value="month">شهر</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination Controls - Top */}
        {!loading && filteredLogs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-600">
                عرض {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} من {filteredLogs.length} سجل
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm text-gray-600">عرض:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-2 py-1 text-xs sm:text-sm border rounded"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-xs sm:text-sm text-gray-600">سجل</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
            {/* Desktop View - Table */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase w-10 sm:w-12">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center justify-center w-4 sm:w-5 h-4 sm:h-5"
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                          ) : someSelected ? (
                            <div className="w-4 sm:w-5 h-4 sm:h-5 border-2 border-purple-600 rounded bg-purple-100" />
                          ) : (
                            <Square className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">العملية</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">نوع الكيان</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المستخدم</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">عنوان IP</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التاريخ والوقت</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLogs.map((log) => {
                    const colors = getActionColor(log.action)
                    return (
                    <tr key={log.id} className={`${colors.bg} hover:shadow-md hover:cursor-pointer transition-all duration-300 border-l ${colors.border}`} onClick={() => setSelectedLog(log)}>
                      {isAdmin && (
                        <td className="px-3 sm:px-6 py-3 sm:py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectLog(log.id)}
                            className="flex items-center justify-center w-4 sm:w-5 h-4 sm:h-5"
                          >
                            {selectedLogIds.has(log.id) ? (
                              <CheckSquare className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                            ) : (
                              <Square className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          <div className={`${colors.icon} p-2 rounded-lg flex-shrink-0`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className={`${colors.text} text-xs sm:text-sm font-semibold`}>
                              {getActionLabel(log.action)}
                            </span>
                            {isImportantAction(log.action) && (
                              <span className="text-xs text-red-600 font-medium">⚠️ عملية حساسة</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium">
                          {log.entity_type ? getEntityLabel(log.entity_type) : '-'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700">
                        {log.user_id ? (
                          (() => {
                            const user = usersMap.get(log.user_id)
                            return user ? (
                              <div className="flex flex-col gap-0.5 sm:gap-1">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <UserIcon className="w-3 sm:w-4 h-3 sm:h-4 text-gray-400 flex-shrink-0" />
                                  <span className="font-medium text-gray-900 truncate">{user.full_name}</span>
                                </div>
                                <span className="text-xs text-gray-500 truncate">{user.email}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 sm:gap-2">
                                <UserIcon className="w-3 sm:w-4 h-3 sm:h-4 text-gray-400" />
                                <span className="font-mono text-xs">{String(log.user_id).slice(0, 8)}...</span>
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-gray-400 text-xs">النظام</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 font-mono">
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-xs">
                          {log.ip_address?.split('.').slice(0, 2).join('.')}...
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-gray-400 flex-shrink-0" />
                          <HijriDateDisplay date={log.created_at}>
                            <span className="truncate">{formatDateTimeWithHijri(log.created_at)}</span>
                          </HijriDateDisplay>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-purple-100 transition duration-200 hover:shadow-sm"
                        >
                          عرض ←
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-3 p-3 sm:p-4">
              {paginatedLogs.map((log) => {
                const colors = getActionColor(log.action)
                return (
                <div key={log.id} className={`
                  ${colors.bg} 
                  border-l-4 ${colors.border}
                  rounded-xl p-4 space-y-3
                  transition-all duration-300
                  hover:shadow-md hover:cursor-pointer
                `} onClick={() => setSelectedLog(log)}>
                  {/* Header: Action + Checkbox */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
                      <div className={`${colors.icon} p-2.5 rounded-lg flex-shrink-0`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`${colors.text} font-semibold text-sm`}>
                          {getActionLabel(log.action)}
                        </h4>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {log.entity_type ? getEntityLabel(log.entity_type) : 'عملية عامة'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectLog(log.id)
                        }}
                        className="flex-shrink-0 mt-1"
                      >
                        {selectedLogIds.has(log.id) ? (
                          <CheckSquare className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Important Badge */}
                  {isImportantAction(log.action) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-red-700">عملية حساسة - احذر</span>
                    </div>
                  )}

                  {/* User Info */}
                  {log.user_id && (
                    <div className="py-2 px-3 bg-white/60 rounded-lg border border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-1">تم بواسطة</div>
                      {(() => {
                        const user = usersMap.get(log.user_id)
                        return user ? (
                          <div>
                            <div className="text-xs font-semibold text-gray-900">{user.full_name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">{String(log.user_id).slice(0, 8)}...</span>
                        )
                      })()}
                    </div>
                  )}

                  {/* IP Address */}
                  {log.ip_address && (
                    <div className="text-xs text-gray-600 px-3 py-1.5 bg-white/50 rounded border border-gray-100">
                      <span className="font-medium">IP:</span> 
                      <span className="font-mono ml-1 text-gray-700">{log.ip_address?.split('.').slice(0, 2).join('.')}...</span>
                    </div>
                  )}

                  {/* Footer: Date + Button */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">
                        <HijriDateDisplay date={log.created_at}>
                          <span>{formatDateTimeWithHijri(log.created_at)}</span>
                        </HijriDateDisplay>
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className={`${colors.text} font-semibold text-xs px-3 py-1.5 rounded-lg ${colors.badge} transition duration-200 hover:shadow-sm flex-shrink-0`}
                    >
                      التفاصيل
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
            
            {/* Pagination Controls - Bottom */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
                <div className="text-xs sm:text-sm text-gray-600">
                  صفحة {currentPage} من {totalPages}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 sm:p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm ${
                          currentPage === pageNum
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 sm:p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-3 sm:w-4 h-3 sm:h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">تأكيد الحذف</h3>
                </div>
                
                {deleteAllMode ? (
                  <div className="space-y-4 mb-6">
                    <p className="text-gray-700">
                      اختر نوع الحذف:
                    </p>
                    
                    {/* خيار حذف المعروض فقط */}
                    <button
                      onClick={() => setDeleteFromDatabase(false)}
                      disabled={deleting}
                      className={`w-full p-4 rounded-lg border-2 transition text-right ${
                        !deleteFromDatabase
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">حذف السجلات المعروضة فقط</div>
                          <div className="text-sm text-gray-600">
                            سيتم حذف {logs.length} سجل المعروض حالياً في الصفحة
                          </div>
                        </div>
                        {!deleteFromDatabase && (
                          <div className="w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow"></div>
                        )}
                      </div>
                    </button>
                    
                    {/* خيار حذف من قاعدة البيانات */}
                    <button
                      onClick={() => setDeleteFromDatabase(true)}
                      disabled={deleting}
                      className={`w-full p-4 rounded-lg border-2 transition text-right ${
                        deleteFromDatabase
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">حذف جميع السجلات من قاعدة البيانات</div>
                          <div className="text-sm text-gray-600">
                            سيتم حذف <span className="font-bold text-red-600">جميع</span> السجلات من قاعدة البيانات بشكل نهائي
                          </div>
                          <div className="text-xs text-red-600 mt-2 font-medium">
                            ⚠️ تحذير: هذه العملية لا يمكن التراجع عنها!
                          </div>
                        </div>
                        {deleteFromDatabase && (
                          <div className="w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow"></div>
                        )}
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <p className="text-gray-700">
                      اختر نوع الحذف للسجلات المحددة ({selectedLogIds.size} نشاط):
                    </p>
                    
                    {/* خيار حذف من العرض فقط */}
                    <button
                      onClick={() => setDeleteFromDatabase(false)}
                      disabled={deleting}
                      className={`w-full p-4 rounded-lg border-2 transition text-right ${
                        !deleteFromDatabase
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">حذف من العرض فقط</div>
                          <div className="text-sm text-gray-600">
                            سيتم إزالة {selectedLogIds.size} سجل من العرض فقط، لكنها ستبقى في قاعدة البيانات
                          </div>
                        </div>
                        {!deleteFromDatabase && (
                          <div className="w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow"></div>
                        )}
                      </div>
                    </button>
                    
                    {/* خيار حذف من قاعدة البيانات */}
                    <button
                      onClick={() => setDeleteFromDatabase(true)}
                      disabled={deleting}
                      className={`w-full p-4 rounded-lg border-2 transition text-right ${
                        deleteFromDatabase
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">حذف من قاعدة البيانات</div>
                          <div className="text-sm text-gray-600">
                            سيتم حذف {selectedLogIds.size} سجل من قاعدة البيانات بشكل نهائي
                          </div>
                          <div className="text-xs text-red-600 mt-2 font-medium">
                            ⚠️ تحذير: هذه العملية لا يمكن التراجع عنها!
                          </div>
                        </div>
                        {deleteFromDatabase && (
                          <div className="w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow"></div>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteAllMode(false)
                      setDeleteFromDatabase(false)
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        جاري الحذف...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        تأكيد الحذف
                      </>
                    )}
                  </button>
                </div>
              </div>
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
                  onClick={() => {
                    setSelectedLog(null)
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ والوقت</label>
                  <HijriDateDisplay date={selectedLog.created_at}>
                    <p className="text-gray-900">
                      {formatDateTimeWithHijri(selectedLog.created_at)}
                    </p>
                  </HijriDateDisplay>
                </div>

                {selectedLog.user_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم</label>
                    {(() => {
                      const user = usersMap.get(selectedLog.user_id)
                      return user ? (
                        <div>
                          <p className="text-gray-900 font-medium">{user.full_name}</p>
                          <p className="text-gray-600 text-sm">{user.email}</p>
                          <p className="text-gray-400 text-xs font-mono mt-1">ID: {selectedLog.user_id}</p>
                        </div>
                      ) : (
                        <p className="text-gray-900 font-mono text-sm">{selectedLog.user_id}</p>
                      )
                    })()}
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">عنوان IP</label>
                    <p className="text-gray-900 font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">وصف النشاط</label>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    {(() => {
                      const description = generateActivityDescription(selectedLog)
                      return typeof description === 'string' ? (
                        <p className="text-gray-900 text-base leading-relaxed">
                          {description}
                        </p>
                      ) : (
                        description
                      )
                    })()}
                  </div>
                </div>

                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <p>💡 <span className="font-medium">ملاحظة:</span> تم تسجيل هذا النشاط بنجاح مع البيانات أعلاه</p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
                <button
                  onClick={() => {
                    setSelectedLog(null)
                  }}
                  className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End of main container */}
      </div>
    </Layout>
  )
}

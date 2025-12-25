import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, ActivityLog, User } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'
import { Activity, RefreshCw, Download, Trash2 } from 'lucide-react'
import { formatDateTimeWithHijri } from '@/utils/dateFormatter'
// import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { usePermissions } from '@/utils/permissions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { StatsCards } from '@/components/activity/StatsCards'
import { LogsFilters } from '@/components/activity/LogsFilters'
import { DeleteConfirmModal } from '@/components/activity/DeleteConfirmModal'
import { LogDetailsModal } from '@/components/activity/LogDetailsModal'
import { LogsTable } from '@/components/activity/LogsTable'

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

  // Debounce search term to reduce re-computation
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, actionFilter, entityFilter, dateFilter])

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

  const filteredLogs = useMemo(() => logs.filter(log => {
    // فلتر البحث
    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase()
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
  }), [logs, debouncedSearchTerm, actionFilter, entityFilter, dateFilter])

  // حساب الإحصائيات (باستخدام filteredLogs)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const todayLogs = useMemo(() => filteredLogs.filter(log => {
    const logDate = new Date(log.created_at)
    return logDate >= today
  }), [filteredLogs])
  const weekLogs = useMemo(() => filteredLogs.filter(log => {
    const logDate = new Date(log.created_at)
    return logDate >= weekAgo
  }), [filteredLogs, weekAgo])
  const employeeLogs = useMemo(() => filteredLogs.filter(log => log.entity_type?.toLowerCase() === 'employee'), [filteredLogs])
  const companyLogs = useMemo(() => filteredLogs.filter(log => log.entity_type?.toLowerCase() === 'company'), [filteredLogs])
  const createLogs = useMemo(() => filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('create') || action.includes('add') || action.includes('إنشاء') || action.includes('إضافة')
  }), [filteredLogs])
  const updateLogs = useMemo(() => filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('update') || action.includes('edit') || action.includes('تحديث') || action.includes('تعديل')
  }), [filteredLogs])
  const deleteLogs = useMemo(() => filteredLogs.filter(l => {
    const action = l.action.toLowerCase()
    return action.includes('delete') || action.includes('remove') || action.includes('حذف')
  }), [filteredLogs])

  // Pagination calculations
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredLogs.length)
  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / itemsPerPage), [filteredLogs, itemsPerPage])
  const paginatedLogs = useMemo(() => filteredLogs.slice(startIndex, endIndex), [filteredLogs, startIndex, endIndex])

  const allSelected = paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogIds.has(log.id))
  const someSelected = paginatedLogs.some(log => selectedLogIds.has(log.id)) && !allSelected

  // دوال التحديد والحذف
  const handleSelectAll = useCallback(() => {
    const pageSlice = filteredLogs.slice(startIndex, endIndex)
    if (selectedLogIds.size === pageSlice.length && pageSlice.every(log => selectedLogIds.has(log.id))) {
      // إلغاء تحديد جميع العناصر في الصفحة الحالية
      const newSelected = new Set(selectedLogIds)
      pageSlice.forEach(log => newSelected.delete(log.id))
      setSelectedLogIds(newSelected)
    } else {
      // تحديد جميع العناصر في الصفحة الحالية
      const newSelected = new Set(selectedLogIds)
      pageSlice.forEach(log => newSelected.add(log.id))
      setSelectedLogIds(newSelected)
    }
  }, [selectedLogIds, filteredLogs, startIndex, endIndex])

  const handleSelectLog = useCallback((logId: number) => {
    const newSelected = new Set(selectedLogIds)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogIds(newSelected)
  }, [selectedLogIds])

  const handleDeleteSelected = useCallback(() => {
    if (selectedLogIds.size === 0) {
      toast.error('لم يتم تحديد أي نشاطات للحذف')
      return
    }
    setDeleteAllMode(false)
    setDeleteFromDatabase(false) // افتراضي: حذف من العرض فقط
    setShowDeleteModal(true)
  }, [selectedLogIds])

  const handleDeleteAll = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.error('لا توجد نشاطات للحذف')
      return
    }
    setDeleteAllMode(true)
    setDeleteFromDatabase(false) // افتراضي: حذف المعروض فقط
    setShowDeleteModal(true)
  }, [filteredLogs])

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

  // Export to Excel
  const exportToExcel = useCallback(() => {
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
  }, [filteredLogs, usersMap])

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
        <StatsCards
          total={filteredLogs.length}
          createCount={createLogs.length}
          updateCount={updateLogs.length}
          deleteCount={deleteLogs.length}
          todayCount={todayLogs.length}
          weekCount={weekLogs.length}
          employeeCount={employeeLogs.length}
          companyCount={companyLogs.length}
        />

        {/* Filters */}
        <LogsFilters
          searchTerm={searchTerm}
          onSearchTermChange={(v) => setSearchTerm(v)}
          actionFilter={actionFilter}
          onActionFilterChange={(v) => setActionFilter(v as ActionFilter)}
          entityFilter={entityFilter}
          onEntityFilterChange={(v) => setEntityFilter(v as EntityFilter)}
          dateFilter={dateFilter}
          onDateFilterChange={(v) => setDateFilter(v as DateFilter)}
          hasActiveFilters={Boolean(searchTerm || actionFilter !== 'all' || entityFilter !== 'all' || dateFilter !== 'all')}
          onReset={() => { setSearchTerm(''); setActionFilter('all'); setEntityFilter('all'); setDateFilter('all'); setCurrentPage(1) }}
        />

        <LogsTable
          loading={loading}
          isAdmin={isAdmin}
          paginatedLogs={paginatedLogs}
          filteredTotal={filteredLogs.length}
          startIndex={startIndex}
          endIndex={endIndex}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={(n) => { setItemsPerPage(n); setCurrentPage(1) }}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={(n) => setCurrentPage(n)}
          usersMap={usersMap}
          getActionColor={getActionColor}
          getActionIcon={getActionIcon}
          getActionLabel={getActionLabel}
          getEntityLabel={getEntityLabel}
          isImportantAction={isImportantAction}
          formatDateTimeWithHijri={formatDateTimeWithHijri}
          onRowClick={(log) => setSelectedLog(log)}
          selectedLogIds={selectedLogIds}
          allSelected={allSelected}
          someSelected={someSelected}
          handleSelectAll={handleSelectAll}
          handleSelectLog={handleSelectLog}
        />

        <DeleteConfirmModal
          open={showDeleteModal}
          deleteAllMode={deleteAllMode}
          deleteFromDatabase={deleteFromDatabase}
          setDeleteFromDatabase={setDeleteFromDatabase}
          deleting={deleting}
          confirmDelete={confirmDelete}
          onClose={() => { setShowDeleteModal(false); setDeleteAllMode(false); setDeleteFromDatabase(false) }}
          selectedCount={selectedLogIds.size}
          visibleCount={filteredLogs.length}
        />

        <LogDetailsModal
          open={Boolean(selectedLog)}
          log={selectedLog}
          usersMap={usersMap}
          onClose={() => setSelectedLog(null)}
          getActionColor={getActionColor}
          getActionIcon={getActionIcon}
          getActionLabel={getActionLabel}
          getEntityLabel={getEntityLabel}
          formatDateTimeWithHijri={formatDateTimeWithHijri}
          generateActivityDescription={generateActivityDescription}
        />

        {/* End of main container */}
      </div>
    </Layout>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Employee, Company, Project, CustomField, ObligationType, supabase } from '@/lib/supabase'
import { X, Calendar, Phone, MapPin, Briefcase, CreditCard, FileText, Save, AlertTriangle, RotateCcw, Search, ChevronDown, FolderKanban, Plus, Loader2 } from 'lucide-react'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'
import { logger } from '@/utils/logger'
import {
  useCreateEmployeeObligationPlan,
  useEmployeeObligations,
  useUpdateObligationLinePayment,
} from '@/hooks/useEmployeeObligations'
import {
  HIRED_WORKER_CONTRACT_STATUS_OPTIONS,
  buildEmployeeBusinessAdditionalFields,
  getEmployeeBusinessFields,
} from '@/utils/employeeBusinessFields'
import {
  getPayrollObligationBucketFromType,
  getPayrollObligationBucketLabel,
} from '@/utils/payrollObligationBuckets'

// Helper: توحيد معالجة التواريخ - الميلادي هو المصدر الأساسي
const toValidDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

const calculateDaysRemaining = (date: string | Date | null | undefined): number | null => {
  const validDate = toValidDate(date)
  if (!validDate) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  validDate.setHours(0, 0, 0, 0)
  
  const diffTime = validDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const formatMoney = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const buildInstallmentAmounts = (totalAmount: number, installmentCount: number): number[] => {
  const totalHalalas = Math.round(totalAmount * 100)
  const baseAmount = Math.floor(totalHalalas / installmentCount)
  let remainder = totalHalalas % installmentCount

  return Array.from({ length: installmentCount }, () => {
    const nextAmount = baseAmount + (remainder > 0 ? 1 : 0)
    if (remainder > 0) {
      remainder -= 1
    }
    return nextAmount / 100
  })
}

interface EmployeeCardProps {
  employee: Employee & { company: Company }
  onClose: () => void
  onUpdate: () => void
  onDelete?: (employee: Employee & { company: Company }) => void
  defaultFinancialOverlayOpen?: boolean
}

export default function EmployeeCard({ employee, onClose, onUpdate, onDelete, defaultFinancialOverlayOpen = false }: EmployeeCardProps) {
  const { canEdit, canDelete } = usePermissions()
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // Define form data type with precise field types
  type EmployeeFormData = {
    id?: string
    company_id: string
    name?: string
    profession?: string
    nationality?: string
    birth_date?: string
    phone?: string
    passport_number?: string
    residence_number: number
    joining_date?: string
    contract_expiry?: string
    hired_worker_contract_expiry: string
    residence_expiry?: string
    project_id: string | null
    project_name?: string | null
    project?: Project
    bank_account?: string
    residence_image_url: string
    health_insurance_expiry: string
    salary: number
    notes: string
    additional_fields: Record<string, string | number | boolean | null>
    company?: Company
    created_at?: string
    updated_at?: string
  }

  /**
   * Helper function to safely get additional field values with type conversion
   */
  function getAdditionalFieldValue(
    value: unknown,
    fieldType: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' = 'text'
  ): string | number | boolean {
    // Handle empty values
    if (value === null || value === undefined) {
      switch (fieldType) {
        case 'number':
          return 0
        case 'checkbox':
          return false
        default:
          return ''
      }
    }

    // Handle different types
    switch (fieldType) {
      case 'number':
        return typeof value === 'number' ? value : Number(value) || 0
      case 'checkbox':
        return typeof value === 'boolean' ? value : Boolean(value)
      default:
        return String(value)
    }
  }
  
  const [formData, setFormData] = useState<EmployeeFormData>({
    ...employee,
    company_id: employee?.company_id ?? '',
    project_id: employee?.project_id ?? employee?.project?.id ?? null,
    additional_fields: (employee?.additional_fields ?? {}) as Record<string, string | number | boolean | null>,
    health_insurance_expiry: employee?.health_insurance_expiry ?? '',
    hired_worker_contract_expiry: employee?.hired_worker_contract_expiry ?? '',
    salary: employee?.salary ?? 0,
    notes: employee?.notes ?? '',
    residence_image_url: employee?.residence_image_url ?? '',
    birth_date: employee?.birth_date ?? '',
    joining_date: employee?.joining_date ?? '',
    residence_expiry: employee?.residence_expiry ?? '',
    contract_expiry: employee?.contract_expiry ?? '',
    residence_number: employee?.residence_number ?? 0
  })
  
  // حفظ البيانات الأصلية من employee مباشرة (بدون معالجة) لاستخدامها في المقارنة
  const [originalData] = useState(employee)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'custom'>('basic')
  const [isEditMode, setIsEditMode] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false)
  const companyDropdownRef = useRef<HTMLDivElement>(null)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [showFinancialOverlay, setShowFinancialOverlay] = useState(defaultFinancialOverlayOpen)
  const [showObligationForm, setShowObligationForm] = useState(false)
  const [editingObligationLineId, setEditingObligationLineId] = useState<string | null>(null)
  const [obligationPaymentForm, setObligationPaymentForm] = useState({
    amount_paid: 0,
    notes: '',
  })
  const [obligationForm, setObligationForm] = useState<{
    obligation_type: ObligationType
    total_amount: number
    start_month: string
    installment_count: number
    notes: string
  }>({
    obligation_type: 'advance',
    total_amount: employee.salary || 0,
    start_month: currentMonth,
    installment_count: 1,
    notes: '',
  })

  useEffect(() => {
    void loadCustomFields()
    void loadCompanies()
    void loadProjects()
  }, [])

  // إغلاق القوائم عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false)
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // معالجة ESC لإغلاق الكارت
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        if (showCreateProjectModal) {
          setShowCreateProjectModal(false)
          setNewProjectName('')
          return
        }
        if (isEditMode) {
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode, onClose, showCreateProjectModal])

  // تحديث نص البحث عند تغيير الشركة المختارة
  useEffect(() => {
    if (formData.company_id && companies.length > 0) {
      const selectedCompany = companies.find(c => c.id === formData.company_id)
      if (selectedCompany) {
        const displayText = `${selectedCompany.name} (${selectedCompany.unified_number})`
        // تحديث فقط إذا كان النص مختلف (لتجنب التداخل مع الكتابة)
        if (companySearchQuery !== displayText) {
          setCompanySearchQuery(displayText)
        }
      }
    } else if (!formData.company_id && companySearchQuery) {
      // إعادة تعيين فقط إذا لم تكن هناك شركة مختارة
      setCompanySearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.company_id, companies])

  // تحديث نص البحث عند تغيير المشروع المختار
  useEffect(() => {
    if (formData.project_id && projects.length > 0) {
      const selectedProject = projects.find(p => p.id === formData.project_id)
      if (selectedProject) {
        const displayText = selectedProject.name
        if (projectSearchQuery !== displayText) {
          setProjectSearchQuery(displayText)
        }
      }
    } else if (!formData.project_id && projectSearchQuery) {
      setProjectSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.project_id, projects])

  const loadCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('entity_type', 'employee')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setCustomFields(data || [])
    } catch (error) {
      logger.error('Error loading custom fields:', error)
    }
  }

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      logger.error('Error loading companies:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      logger.error('Error loading projects:', error)
    }
  }

  // تصفية المؤسسات: البحث في الاسم أو الرقم الموحد
  const filteredCompanies = companies.filter(company => {
    if (companySearchQuery.trim()) {
      const query = companySearchQuery.toLowerCase().trim()
      const nameMatch = company.name?.toLowerCase().includes(query)
      const unifiedNumberMatch = company.unified_number?.toString().includes(query)
      return nameMatch || unifiedNumberMatch
    }
    return true
  })

  // تصفية المشاريع: البحث في الاسم
  const filteredProjects = projects.filter(project => {
    if (projectSearchQuery.trim()) {
      const query = projectSearchQuery.toLowerCase().trim()
      return project.name?.toLowerCase().includes(query)
    }
    return true
  })

  // التحقق من وجود مشروع بالاسم المدخل
  const hasExactMatch = projectSearchQuery.trim() && 
    projects.some(p => p.name.toLowerCase() === projectSearchQuery.toLowerCase().trim())
  
  const showCreateOption = projectSearchQuery.trim() && !hasExactMatch && isProjectDropdownOpen

  // دالة إنشاء مشروع جديد
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('يرجى إدخال اسم المشروع')
      return
    }

    // التحقق من عدم وجود مشروع بنفس الاسم
    const existingProject = projects.find(
      p => p.name.toLowerCase() === newProjectName.trim().toLowerCase()
    )

    if (existingProject) {
      toast.error('يوجد مشروع بنفس الاسم بالفعل')
      setFormData({ ...formData, project_id: existingProject.id })
      setProjectSearchQuery(existingProject.name)
      setShowCreateProjectModal(false)
      setNewProjectName('')
      setIsProjectDropdownOpen(false)
      return
    }

    setCreatingProject(true)
    try {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          name: newProjectName.trim(),
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('يوجد مشروع بنفس الاسم بالفعل')
        } else {
          throw error
        }
        return
      }

      // تحديث قائمة المشاريع
      await loadProjects()

      // اختيار المشروع الجديد تلقائياً
      setFormData({ ...formData, project_id: newProject.id, project_name: newProject.name })
      setProjectSearchQuery(newProject.name)
      setShowCreateProjectModal(false)
      setNewProjectName('')
      setIsProjectDropdownOpen(false)

      toast.success('تم إنشاء المشروع بنجاح')
    } catch (error) {
      logger.error('Error creating project:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل إنشاء المشروع'
      toast.error(errorMessage)
    } finally {
      setCreatingProject(false)
    }
  }

  // تم نقل calculateDaysRemaining إلى أعلى الملف كـ helper موحد

  const getStatusColor = (days: number | null) => {
    // إذا كان null (لا يوجد تاريخ انتهاء)، يعتبر ساري
    if (days === null) return 'text-green-600 bg-green-50 border-green-200'
    // منتهي أو أقل من أو يساوي 7 أيام: أحمر (طارئ)
    if (days < 0) return 'text-red-600 bg-red-50 border-red-200'
    if (days <= 7) return 'text-red-600 bg-red-50 border-red-200'
    // 8-15 يوم: برتقالي (عاجل)
    if (days <= 15) return 'text-orange-600 bg-orange-50 border-orange-200'
    // 16-30 يوم: أصفر (تحذير)
    if (days <= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    // أكثر من 30 يوم: أخضر (ساري)
    return 'text-green-600 bg-green-50 border-green-200'
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
      'birth_date': 'تاريخ الميلاد',
      'joining_date': 'تاريخ الالتحاق',
      'residence_expiry': 'تاريخ انتهاء الإقامة',
      'contract_expiry': 'تاريخ انتهاء العقد',
      'hired_worker_contract_expiry': 'تاريخ انتهاء عقد أجير',
      'health_insurance_expiry': 'تاريخ انتهاء التأمين الصحي',
      'notes': 'الملاحظات',
      'company_id': 'المؤسسة'
    }
    return fieldLabels[key] || key
  }

  const logActivity = async (action: string, changes: Record<string, unknown>, oldDataFull: Record<string, unknown>, newDataFull: Record<string, unknown>) => {
    try {
      // تحديد اسم العملية الفعلي بناءً على التغييرات
      let actionName = action
      const changedFields = Object.keys(changes)
      
      // بناء تفاصيل التغييرات بصيغة {old, new} لكل حقل
      const detailedChanges: Record<string, { old: unknown; new: unknown }> = {}
      const translatedChanges: Record<string, unknown> = {}
      
      changedFields.forEach(field => {
        const label = getFieldLabel(field)
        const oldVal = oldDataFull[field]
        const newVal = newDataFull[field]
        
        // حفظ التغيير بصيغة مفصلة {old, new}
        detailedChanges[label] = {
          old: oldVal,
          new: newVal
        }
        
        // حفظ القيمة الجديدة فقط (للتوافق مع النسخ القديمة)
        translatedChanges[label] = newVal
      })
      
      // إذا كان هناك حقل واحد فقط، استخدم اسمه في العملية
      if (changedFields.length === 1) {
        const fieldName = changedFields[0]
        const fieldLabel = getFieldLabel(fieldName)
        actionName = `تحديث ${fieldLabel}`
      } else if (changedFields.length > 1) {
        actionName = `تحديث متعدد (${changedFields.length} حقول)`
      }

      await supabase
        .from('activity_log')
        .insert({
          entity_type: 'employee',
          entity_id: employee.id,
          action: actionName,
          details: {
            employee_name: employee.name,
            changes: detailedChanges,
            changes_simple: translatedChanges,
            timestamp: new Date().toISOString()
          },
          old_data: oldDataFull,
          new_data: newDataFull
        })
    } catch (error) {
      logger.error('Error logging activity:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const normalizeDate = (value: string | null | undefined) => {
        const trimmed = value?.trim()
        return trimmed ? trimmed : null
      }

      // جلب البيانات الحالية قبل التحديث لضمان وجود old_data موثوق
      const { data: existingEmployee, error: fetchError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employee.id)
        .single()

      if (fetchError) throw fetchError

      const baselineData: Record<string, unknown> = existingEmployee
        ? (existingEmployee as Record<string, unknown>)
        : (originalData as unknown as Record<string, unknown>)

      // بناء actualUpdateData بناءً على الحقول التي تغيرت فقط (بدون تحضير جميع الحقول)
      const fieldsToCheck = [
        'name', 'phone', 'profession', 'nationality', 'residence_number',
        'passport_number', 'bank_account', 'salary', 'project_id',
        'birth_date', 'joining_date', 'residence_expiry', 'contract_expiry',
        'hired_worker_contract_expiry', 'health_insurance_expiry', 'notes', 'company_id'
      ]

      const actualUpdateData: Record<string, unknown> = {}
      const changes: Record<string, { old_value: unknown; new_value: unknown }> = {}

      const normalizedAdditionalFields = buildEmployeeBusinessAdditionalFields(formData.additional_fields, {
        ...getEmployeeBusinessFields({
          additional_fields: formData.additional_fields,
          hired_worker_contract_expiry: formData.hired_worker_contract_expiry,
        }),
        hired_worker_contract_expiry: formData.hired_worker_contract_expiry,
      })

      // فحص كل حقل للتأكد من تغييره فقط
      fieldsToCheck.forEach(field => {
        const oldValue = baselineData[field]
        let newValue: unknown = formData[field as keyof typeof formData]

        // تطبيق نفس التحويلات على القيمة الجديدة مثل updateData
        if (field === 'birth_date' || field === 'joining_date' || field === 'residence_expiry' || 
            field === 'contract_expiry' || field === 'health_insurance_expiry') {
          newValue = normalizeDate(formData[field] as string | null | undefined)
        } else if (field === 'residence_number' || field === 'salary') {
          newValue = Number(formData[field]) || (field === 'salary' ? 0 : 0)
        } else if (field === 'residence_image_url' || field === 'hired_worker_contract_expiry' || field === 'notes') {
          newValue = formData[field] || null
        } else if (field === 'project_id') {
          newValue = formData.project_id || null
        }

        // معاملة null و undefined بنفس الطريقة
        const oldVal = oldValue === null || oldValue === undefined ? null : oldValue
        const newVal = newValue === null || newValue === undefined ? null : newValue



        // مقارنة القيمتين: إذا اختلفتا، أضفهما إلى actualUpdateData
        if (oldVal !== newVal) {
          actualUpdateData[field] = newValue
          changes[field] = {
            old_value: oldVal,
            new_value: newVal
          }
        }
      })

      const baselineAdditionalFields = (baselineData.additional_fields ?? {}) as Record<string, unknown>
      if (JSON.stringify(baselineAdditionalFields) !== JSON.stringify(normalizedAdditionalFields)) {
        actualUpdateData.additional_fields = normalizedAdditionalFields
        changes.additional_fields = {
          old_value: baselineAdditionalFields,
          new_value: normalizedAdditionalFields,
        }
      }

      // إذا لم تكن هناك أي تغييرات، لا تحفظ شيء
      if (Object.keys(actualUpdateData).length === 0) {
        toast.info('لم يتم تغيير أي بيانات')
        setSaving(false)
        return
      }



      // تحديث project_name إذا تم تعديل project_id
      if (actualUpdateData.project_id !== undefined) {
        if (actualUpdateData.project_id) {
          const selectedProject = projects.find(p => p.id === actualUpdateData.project_id)
          if (selectedProject) {
            actualUpdateData.project_name = selectedProject.name
          }
        } else {
          actualUpdateData.project_name = null
        }
      }

      // حفظ في قاعدة البيانات
      const { data: updatedEmployee, error } = await supabase
        .from('employees')
        .update(actualUpdateData)
        .eq('id', employee.id)
        .select()
        .single()

      if (error) throw error

      const newDataFull: Record<string, unknown> = updatedEmployee
        ? (updatedEmployee as Record<string, unknown>)
        : { ...baselineData, ...actualUpdateData }

      // تسجيل النشاط مع التغييرات الفعلية فقط
      let actionType = 'full_edit'
      if (actualUpdateData.company_id !== undefined && actualUpdateData.company_id !== originalData.company_id) {
        actionType = 'company_transfer'
      }

      await logActivity(actionType, changes, baselineData, newDataFull)

      toast.success('تم حفظ التعديلات بنجاح')
      setIsEditMode(false)
      
      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))
      
      onUpdate()
    } catch (error) {
      logger.error('Error saving employee:', error)
      toast.error('فشل حفظ التعديلات')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // إعادة تعيين البيانات إلى القيم الأصلية
    setFormData({
      ...employee,
      company_id: employee.company_id,
      project_id: employee.project_id || employee.project?.id || null,
      additional_fields: (employee.additional_fields || {}) as Record<string, string | number | boolean | null>,
      health_insurance_expiry: employee.health_insurance_expiry || '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
      hired_worker_contract_expiry: employee.hired_worker_contract_expiry || '',
      salary: employee.salary || 0,
      notes: employee.notes || '',
      residence_image_url: employee.residence_image_url || '',
      residence_number: employee.residence_number || 0
    })
    setIsEditMode(false)
    setIsCompanyDropdownOpen(false)
  }

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(employee)
    }
  }

  const residenceDays = calculateDaysRemaining(employee?.residence_expiry)
  const contractDays = calculateDaysRemaining(employee?.contract_expiry)
  const hiredWorkerContractDays = calculateDaysRemaining(employee?.hired_worker_contract_expiry)
  const healthInsuranceDays = calculateDaysRemaining(employee?.health_insurance_expiry)
  const employeeBusinessFields = getEmployeeBusinessFields({
    additional_fields: formData.additional_fields,
    hired_worker_contract_expiry: formData.hired_worker_contract_expiry,
  })
  const {
    data: obligationPlans = [],
    isLoading: isLoadingObligations,
    isError: hasObligationsError,
  } = useEmployeeObligations(employee.id)

  const activeObligationPlans = obligationPlans.filter(
    (plan) => plan.status === 'active' || plan.status === 'draft'
  )
  const allObligationLines = activeObligationPlans
    .flatMap((plan) =>
      plan.lines.map((line) => ({
        ...line,
        title: plan.title,
        currency_code: plan.currency_code,
        obligation_type: plan.obligation_type,
      }))
    )
    .sort((left, right) => left.due_month.localeCompare(right.due_month))
  const openObligationLines = allObligationLines.filter(
    (line) => line.line_status === 'unpaid' || line.line_status === 'partial'
  )
  const recentObligationLines = [...allObligationLines]
    .sort((left, right) => right.due_month.localeCompare(left.due_month))
    .slice(0, 5)

  const remainingObligationAmount = openObligationLines.reduce(
    (total, line) => total + Math.max(line.amount_due - line.amount_paid, 0),
    0
  )
  const paidObligationAmount = allObligationLines.reduce(
    (total, line) => total + Number(line.amount_paid || 0),
    0
  )
  const obligationBucketSummary = activeObligationPlans.reduce(
    (totals, plan) => {
      const bucket = getPayrollObligationBucketFromType(plan.obligation_type)
      const totalAmount = plan.lines.reduce((sum, line) => sum + Number(line.amount_due || 0), 0)
      const paidAmount = plan.lines.reduce((sum, line) => sum + Number(line.amount_paid || 0), 0)

      totals[bucket].total += totalAmount
      totals[bucket].paid += paidAmount
      totals[bucket].remaining += Math.max(totalAmount - paidAmount, 0)
      return totals
    },
    {
      transfer_renewal: { total: 0, paid: 0, remaining: 0 },
      penalty: { total: 0, paid: 0, remaining: 0 },
      advance: { total: 0, paid: 0, remaining: 0 },
      other: { total: 0, paid: 0, remaining: 0 },
    }
  )
  const installmentPreview = buildInstallmentAmounts(
    Math.max(obligationForm.total_amount || 0, 0),
    Math.max(obligationForm.installment_count || 1, 1)
  )
  const createEmployeeObligationPlan = useCreateEmployeeObligationPlan()
  const updateObligationLinePayment = useUpdateObligationLinePayment()

  const handleCreateObligationPlan = async () => {
    const totalAmount = Number(obligationForm.total_amount)
    const installmentCount = Number(obligationForm.installment_count)

    if (!obligationForm.start_month) {
      toast.error('يرجى اختيار شهر البداية')
      return
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح أكبر من صفر')
      return
    }

    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 12) {
      toast.error('عدد الأقساط يجب أن يكون بين 1 و 12')
      return
    }

    try {
      await createEmployeeObligationPlan.mutateAsync({
        employee_id: employee.id,
        obligation_type: obligationForm.obligation_type,
        total_amount: totalAmount,
        start_month: `${obligationForm.start_month}-01`,
        installment_amounts: buildInstallmentAmounts(totalAmount, installmentCount),
        notes: obligationForm.notes.trim() || null,
        status: 'active',
      })

      toast.success('تم إنشاء خطة الالتزام بنجاح')
      setShowObligationForm(false)
      setObligationForm({
        obligation_type: 'advance',
        total_amount: employee.salary || 0,
        start_month: currentMonth,
        installment_count: 1,
        notes: '',
      })
    } catch (error) {
      logger.error('Error creating obligation plan:', error)
      const message = error instanceof Error ? error.message : 'فشل إنشاء خطة الالتزام'
      toast.error(message)
    }
  }

  const startEditingObligationLine = (lineId: string, amountPaid: number, notes?: string | null) => {
    setEditingObligationLineId(lineId)
    setObligationPaymentForm({
      amount_paid: amountPaid,
      notes: notes || '',
    })
  }

  const handleSaveObligationPayment = async (lineId: string, amountDue: number) => {
    const amountPaid = Number(obligationPaymentForm.amount_paid)

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      toast.error('قيمة المدفوع يجب أن تكون صفراً أو أكبر')
      return
    }

    if (amountPaid > amountDue) {
      toast.error('قيمة المدفوع لا يمكن أن تتجاوز قيمة القسط')
      return
    }

    try {
      await updateObligationLinePayment.mutateAsync({
        lineId,
        employeeId: employee.id,
        amount_paid: amountPaid,
        notes: obligationPaymentForm.notes.trim() || null,
      })

      toast.success('تم تحديث سداد القسط بنجاح')
      setEditingObligationLineId(null)
      setObligationPaymentForm({ amount_paid: 0, notes: '' })
    } catch (error) {
      logger.error('Error updating obligation payment:', error)
      const message = error instanceof Error ? error.message : 'فشل تحديث السداد'
      toast.error(message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isEditMode) {
          onClose()
        }
      }}
    >
      <div
        className="app-modal-surface relative isolate max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 z-30 flex items-center justify-between border-b border-white/10 p-6 text-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.7)] ${
          isEditMode 
            ? 'bg-gradient-to-l from-amber-600 to-orange-500' 
            : 'bg-gradient-to-l from-slate-950 via-slate-900 to-slate-800'
        }`}>
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className={`mt-1 ${isEditMode ? 'text-orange-100' : 'text-slate-300'}`}>
              {employee.profession} - {employee?.company?.name ?? 'غير محدد'}
            </p>
            {isEditMode && (
              <p className="text-sm mt-1 text-orange-100">
                وضع التعديل نشط - يمكنك تعديل البيانات أدناه
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
              >
                <RotateCcw className="w-4 h-4" />
                إلغاء التعديل
              </button>
            ) : (
              canEdit('employees') && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  <FileText className="w-4 h-4" />
                  تعديل
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-2 transition hover:bg-white/15"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        <div className="p-6 space-y-3 bg-gray-50">
          <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(residenceDays)}`}>
            <AlertTriangle className="w-5 h-5" />
            <div className="flex-1">
              <div className="font-medium">انتهاء الإقامة</div>
              <div className="text-sm">
                {employee?.residence_expiry ? (
                  <>
                    <HijriDateDisplay date={employee.residence_expiry}>
                      {formatDateShortWithHijri(employee.residence_expiry)}
                    </HijriDateDisplay>
                    {residenceDays !== null && (residenceDays < 0 ? ' (منتهية)' : ` (بعد ${residenceDays} يوم)`)}
                  </>
                ) : (
                  'غير محدد'
                )}
              </div>
            </div>
          </div>

          {contractDays !== null && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(contractDays)}`}>
              <AlertTriangle className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">انتهاء العقد</div>
                <div className="text-sm">
                  {employee?.contract_expiry && (
                    <HijriDateDisplay date={employee.contract_expiry}>
                      {formatDateShortWithHijri(employee.contract_expiry)}
                    </HijriDateDisplay>
                  )}
                  {contractDays !== null && (contractDays < 0 ? ' (منتهي)' : ` (بعد ${contractDays} يوم)`)}
                </div>
              </div>
            </div>
          )}

          {hiredWorkerContractDays !== null && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(hiredWorkerContractDays)}`}>
              <AlertTriangle className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">انتهاء عقد أجير</div>
                <div className="text-sm">
                  {employee?.hired_worker_contract_expiry && (
                    <HijriDateDisplay date={employee.hired_worker_contract_expiry}>
                      {formatDateShortWithHijri(employee.hired_worker_contract_expiry)}
                    </HijriDateDisplay>
                  )}
                  {hiredWorkerContractDays !== null && (hiredWorkerContractDays < 0 ? ' (منتهي)' : ` (بعد ${hiredWorkerContractDays} يوم)`)}
                </div>
              </div>
            </div>
          )}

          {/* تنبيه التأمين الصحي */}
          <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(healthInsuranceDays)}`}>
            <AlertTriangle className="w-5 h-5" />
            <div className="flex-1">
              <div className="font-medium">انتهاء التأمين الصحي</div>
              <div className="text-sm">
                {healthInsuranceDays === null ? (
                  'لا يوجد تاريخ انتهاء'
                ) : (
                  <>
                    {healthInsuranceDays < 0 ? 'منتهي (' : 'ساري حتى '}
                    {employee?.health_insurance_expiry && (
                      <HijriDateDisplay date={employee.health_insurance_expiry}>
                        {formatDateShortWithHijri(employee.health_insurance_expiry)}
                      </HijriDateDisplay>
                    )}
                    {healthInsuranceDays < 0 ? ')' : ` (بعد ${healthInsuranceDays} يوم)`}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 p-3">
          <div className="app-toggle-shell w-full">
            <button
              onClick={() => setActiveTab('basic')}
              className={`app-toggle-button flex-1 ${activeTab === 'basic' ? 'app-toggle-button-active' : ''}`}
            >
              البيانات الأساسية
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`app-toggle-button flex-1 ${activeTab === 'custom' ? 'app-toggle-button-active' : ''}`}
            >
              الحقول الإضافية ({customFields.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'basic' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. الاسم */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  value={formData.name ?? ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 2. مهنة الإقامة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  مهنة الإقامة
                </label>
                <input
                  type="text"
                  value={formData.profession ?? ''}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 3. الجنسية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  الجنسية
                </label>
                <input
                  type="text"
                  value={formData.nationality ?? ''}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 4. رقم الإقامة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  رقم الإقامة
                </label>
                <input
                  type="text"
                  value={formData.residence_number || ''}
                  onChange={(e) => setFormData({ ...formData, residence_number: parseInt(e.target.value) || 0 })}
                  disabled={!isEditMode}
                  className={`app-input py-2 font-mono ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 5. رقم الجواز */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم جواز السفر</label>
                <input
                  type="text"
                  value={formData.passport_number ?? ''}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 6. تاريخ الميلاد */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الميلاد
                </label>
                <input
                  type="date"
                  value={formData.birth_date || ''}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 7. رقم الهاتف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 8. الحساب البنكي */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  الحساب البنكي
                </label>
                <input
                  type="text"
                  value={formData.bank_account || ''}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 9. اسم البنك */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  اسم البنك
                </label>
                <input
                  type="text"
                  value={employeeBusinessFields.bank_name}
                  onChange={(e) => setFormData({
                    ...formData,
                    additional_fields: {
                      ...formData.additional_fields,
                      bank_name: e.target.value,
                    },
                  })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 10. الراتب */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  الراتب
                </label>
                <input
                  type="number"
                  value={formData.salary || 0}
                  onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                  placeholder="الراتب الشهري"
                />
              </div>

              {/* 11. الشركة أو المؤسسة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  الشركة أو المؤسسة
                </label>
                <div className="relative" ref={companyDropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={companySearchQuery}
                      onChange={(e) => {
                        setCompanySearchQuery(e.target.value)
                        setIsCompanyDropdownOpen(true)
                      }}
                      onFocus={() => {
                        if (isEditMode) {
                          setIsCompanyDropdownOpen(true)
                        }
                      }}
                      placeholder="ابحث بالاسم أو الرقم الموحد..."
                      disabled={!isEditMode}
                      className={`app-input py-2 pr-10 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDown className={`w-5 h-5 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  
                  {isCompanyDropdownOpen && isEditMode && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredCompanies.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          {companySearchQuery.trim() ? 'لا توجد نتائج' : 'لا توجد شركات متاحة'}
                        </div>
                      ) : (
                        filteredCompanies.map(company => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, company_id: company.id })
                              setCompanySearchQuery(`${company.name} (${company.unified_number})`)
                              setIsCompanyDropdownOpen(false)
                            }}
                            className="w-full px-4 py-2.5 text-right text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                          >
                            {company.name} ({company.unified_number})
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 12. المشروع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4" />
                  المشروع
                </label>
                <div className="relative" ref={projectDropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={projectSearchQuery}
                      onChange={(e) => {
                        setProjectSearchQuery(e.target.value)
                        setIsProjectDropdownOpen(true)
                      }}
                      onFocus={() => {
                        if (isEditMode) {
                          setIsProjectDropdownOpen(true)
                        }
                      }}
                      placeholder="ابحث عن مشروع..."
                      disabled={!isEditMode}
                      className={`app-input py-2 pr-10 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDown className={`w-5 h-5 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  
                  {isProjectDropdownOpen && isEditMode && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, project_id: null })
                          setProjectSearchQuery('')
                          setIsProjectDropdownOpen(false)
                        }}
                        className="w-full px-4 py-2.5 text-right text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors text-gray-600"
                      >
                        بدون مشروع
                      </button>
                      {filteredProjects.length === 0 && !showCreateOption ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          {projectSearchQuery.trim() ? 'لا توجد نتائج' : 'لا توجد مشاريع متاحة'}
                        </div>
                      ) : (
                        <>
                          {filteredProjects.map(project => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, project_id: project.id, project_name: project.name })
                                setProjectSearchQuery(project.name)
                                setIsProjectDropdownOpen(false)
                              }}
                              className="w-full px-4 py-2.5 text-right text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span>{project.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  project.status === 'active' ? 'bg-green-100 text-green-800' :
                                  project.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {project.status === 'active' ? 'نشط' : project.status === 'inactive' ? 'متوقف' : 'مكتمل'}
                                </span>
                              </div>
                            </button>
                          ))}
                          {showCreateOption && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewProjectName(projectSearchQuery.trim())
                                setShowCreateProjectModal(true)
                              }}
                              className="w-full px-4 py-2.5 text-right text-sm hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors border-t border-gray-200 text-green-700 font-medium"
                            >
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Plus className="w-4 h-4" />
                                  إنشاء مشروع جديد: {projectSearchQuery.trim()}
                                </span>
                              </div>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* مودال إضافة مشروع جديد */}
                  {showCreateProjectModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60] p-4">
                      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Plus className="w-5 h-5 text-green-600" />
                          إضافة مشروع جديد
                        </h3>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            اسم المشروع <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !creatingProject) {
                                handleCreateProject()
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="أدخل اسم المشروع"
                            autoFocus
                            disabled={creatingProject}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateProjectModal(false)
                              setNewProjectName('')
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            disabled={creatingProject}
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateProject}
                            disabled={creatingProject || !newProjectName.trim()}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {creatingProject ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جاري الإنشاء...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                إضافة
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 13. حالة عقد أجير */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">حالة عقد أجير</label>
                <select
                  value={String(employeeBusinessFields.hired_worker_contract_status)}
                  onChange={(e) => setFormData({
                    ...formData,
                    additional_fields: {
                      ...formData.additional_fields,
                      hired_worker_contract_status: e.target.value,
                    },
                  })}
                  disabled={!isEditMode || Boolean(formData.hired_worker_contract_expiry)}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                >
                  {HIRED_WORKER_CONTRACT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 14. تاريخ الالتحاق */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الالتحاق
                </label>
                <input
                  type="date"
                  value={formData.joining_date || ''}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 13. تاريخ انتهاء الإقامة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ انتهاء الإقامة</label>
                <input
                  type="date"
                  value={formData.residence_expiry || ''}
                  onChange={(e) => setFormData({ ...formData, residence_expiry: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 14. تاريخ انتهاء العقد */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ انتهاء العقد</label>
                <input
                  type="date"
                  value={formData.contract_expiry || ''}
                  onChange={(e) => setFormData({ ...formData, contract_expiry: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 15. تاريخ انتهاء عقد أجير */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ انتهاء عقد أجير
                </label>
                <input
                  type="date"
                  value={formData.hired_worker_contract_expiry || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    hired_worker_contract_expiry: e.target.value,
                    additional_fields: e.target.value
                      ? {
                          ...formData.additional_fields,
                          hired_worker_contract_status: 'أجير',
                        }
                      : formData.additional_fields,
                  })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 16. تاريخ انتهاء التأمين الصحي */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ انتهاء التأمين الصحي
                </label>
                <input
                  type="date"
                  value={formData.health_insurance_expiry || ''}
                  onChange={(e) => setFormData({ ...formData, health_insurance_expiry: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* 17. رابط صورة الإقامة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  رابط صورة الإقامة
                </label>
                <input
                  type="text"
                  value={formData.residence_image_url || ''}
                  onChange={(e) => setFormData({ ...formData, residence_image_url: e.target.value })}
                  disabled={!isEditMode}
                  className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                  placeholder="أدخل رابط صورة الإقامة"
                />
                {formData.residence_image_url && !isEditMode && (
                  <a
                    href={formData.residence_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    عرض الصورة
                  </a>
                )}
              </div>

                {/* 18. الملاحظات */}
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  الملاحظات
                </label>
                {isEditMode ? (
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="app-input min-h-[100px] resize-none"
                    placeholder="أدخل أي ملاحظات إضافية عن الموظف..."
                  />
                ) : (
                  <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 min-h-[100px] whitespace-pre-wrap">
                    {formData.notes || 'لا توجد ملاحظات'}
                  </div>
                )}
                </div>
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowFinancialOverlay(true)}
                  className="app-button-primary px-4 py-2 text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  عرض الالتزامات المالية
                </button>
              </div>

              {showFinancialOverlay && (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                  onClick={() => setShowFinancialOverlay(false)}
                >
                  <div
                    className="app-modal-surface relative isolate max-w-5xl max-h-[90vh] w-full overflow-y-auto p-5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">الالتزامات المالية</h3>
                    <p className="text-sm text-gray-600">ملخص الأقساط والخطط المفتوحة لهذا الموظف</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-500">
                      {isLoadingObligations
                        ? 'جاري التحميل...'
                        : `${activeObligationPlans.length} خطة نشطة / مسودة`}
                    </div>
                    {canEdit('employees') && (
                      <button
                        type="button"
                        onClick={() => setShowObligationForm((current) => !current)}
                        className="app-button-primary px-4 py-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        {showObligationForm ? 'إخفاء النموذج' : 'إضافة التزام'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFinancialOverlay(false)}
                      className="app-button-secondary px-3 py-2 text-sm"
                    >
                      <X className="w-4 h-4" />
                      إغلاق
                    </button>
                  </div>
                </div>

                {hasObligationsError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    تعذر تحميل بيانات الالتزامات المالية حالياً.
                  </div>
                ) : isLoadingObligations ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    جاري تحميل الالتزامات المالية...
                  </div>
                ) : obligationPlans.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    لا توجد التزامات مالية مسجلة لهذا الموظف بعد.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-white border border-gray-200 p-4">
                        <div className="text-sm text-gray-500 mb-1">إجمالي الخطط</div>
                        <div className="text-2xl font-bold text-gray-900">{obligationPlans.length}</div>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 p-4">
                        <div className="text-sm text-gray-500 mb-1">الأقساط المفتوحة</div>
                        <div className="text-2xl font-bold text-orange-600">{openObligationLines.length}</div>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 p-4">
                        <div className="text-sm text-gray-500 mb-1">ما تم سداده</div>
                        <div className="text-2xl font-bold text-green-600">{formatMoney(paidObligationAmount)} SAR</div>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 p-4">
                        <div className="text-sm text-gray-500 mb-1">المتبقي للسداد</div>
                        <div className="text-2xl font-bold text-blue-700">{formatMoney(remainingObligationAmount)} SAR</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {Object.entries(obligationBucketSummary).map(([bucketKey, bucketValue]) => (
                        <div key={bucketKey} className="rounded-lg border border-gray-200 bg-white p-4">
                          <div className="text-sm text-gray-500 mb-1">{getPayrollObligationBucketLabel(bucketKey as 'transfer_renewal' | 'penalty' | 'advance' | 'other')}</div>
                          <div className="text-lg font-bold text-slate-900">{formatMoney(bucketValue.remaining)} SAR</div>
                          <div className="mt-1 text-xs text-gray-500">المدفوع: {formatMoney(bucketValue.paid)} / الإجمالي: {formatMoney(bucketValue.total)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {recentObligationLines.map((line, index) => (
                        <div
                          key={line.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-gray-900">{line.title}</div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  line.line_status === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : line.line_status === 'partial'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {line.line_status === 'paid' ? 'مسدد' : line.line_status === 'partial' ? 'مسدد جزئيًا' : 'مفتوح'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                القسط رقم {index + 1} • موعد السداد{' '}
                                <HijriDateDisplay date={line.due_month}>
                                  {formatDateShortWithHijri(line.due_month)}
                                </HijriDateDisplay>
                              </div>
                            </div>
                            <div className="text-sm md:text-left">
                              <div className="font-semibold text-gray-900">
                                {formatMoney(Math.max(line.amount_due - line.amount_paid, 0))} {line.currency_code}
                              </div>
                              <div className="text-gray-500">
                                مدفوع: {formatMoney(line.amount_paid)} من {formatMoney(line.amount_due)}
                              </div>
                            </div>
                          </div>

                          {canEdit('employees') && (
                            <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                              {editingObligationLineId === line.id ? (
                                <>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        إجمالي المدفوع حتى الآن
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max={line.amount_due}
                                        step="0.01"
                                        value={obligationPaymentForm.amount_paid}
                                        onChange={(e) => setObligationPaymentForm({
                                          ...obligationPaymentForm,
                                          amount_paid: Number(e.target.value) || 0,
                                        })}
                                        className="app-input"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ملاحظات السداد
                                      </label>
                                      <input
                                        type="text"
                                        value={obligationPaymentForm.notes}
                                        onChange={(e) => setObligationPaymentForm({
                                          ...obligationPaymentForm,
                                          notes: e.target.value,
                                        })}
                                        className="app-input"
                                        placeholder="اختياري"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setEditingObligationLineId(null)}
                                      className="app-button-secondary px-3 py-2 text-sm"
                                      disabled={updateObligationLinePayment.isPending}
                                    >
                                      إلغاء
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveObligationPayment(line.id, line.amount_due)}
                                      className="app-button-primary px-3 py-2 text-sm"
                                      disabled={updateObligationLinePayment.isPending}
                                    >
                                      {updateObligationLinePayment.isPending ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          جاري الحفظ...
                                        </>
                                      ) : (
                                        <>
                                          <Save className="w-4 h-4" />
                                          حفظ السداد
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => startEditingObligationLine(line.id, line.amount_paid, line.notes)}
                                    className="app-button-secondary px-3 py-2 text-sm"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    تسجيل سداد
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {allObligationLines.length > 5 && (
                        <div className="text-sm text-gray-500 text-center pt-1">
                          يوجد {allObligationLines.length - 5} قسط إضافي غير ظاهر في هذا الملخص.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {showObligationForm && canEdit('employees') && (
                  <div className="mt-5 rounded-xl border border-blue-200 bg-white p-5 space-y-4">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">إنشاء خطة التزام جديدة</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        ماذا فعلنا: سننشئ رأس الالتزام وكل الأقساط مرة واحدة.
                      </p>
                      <p className="text-sm text-gray-600">
                        لماذا فعلنا ذلك: حتى لا تفشل القيود المحاسبية في قاعدة البيانات.
                      </p>
                      <p className="text-sm text-gray-600">
                        ما النتيجة المتوقعة: ستظهر الخطة مباشرة في الملخص بالأعلى بعد الحفظ.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">نوع الالتزام</label>
                        <select
                          value={obligationForm.obligation_type}
                          onChange={(e) => setObligationForm({ ...obligationForm, obligation_type: e.target.value as 'transfer' | 'renewal' | 'penalty' | 'advance' | 'other' })}
                          className="app-input"
                        >
                          <option value="advance">سلفة</option>
                          <option value="transfer">نقل كفالة</option>
                          <option value="renewal">تجديد</option>
                          <option value="penalty">غرامة</option>
                          <option value="other">أخرى</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">إجمالي المبلغ</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={obligationForm.total_amount}
                          onChange={(e) => setObligationForm({ ...obligationForm, total_amount: Number(e.target.value) || 0 })}
                          className="app-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">شهر البداية</label>
                        <input
                          type="month"
                          value={obligationForm.start_month}
                          onChange={(e) => setObligationForm({ ...obligationForm, start_month: e.target.value })}
                          className="app-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">عدد الأقساط</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={obligationForm.installment_count}
                          onChange={(e) => setObligationForm({ ...obligationForm, installment_count: Number(e.target.value) || 1 })}
                          className="app-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">قيمة القسط التقريبية</label>
                        <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                          {installmentPreview.length > 0 ? `${formatMoney(installmentPreview[0])} SAR` : 'غير متاح'}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
                        <textarea
                          rows={3}
                          value={obligationForm.notes}
                          onChange={(e) => setObligationForm({ ...obligationForm, notes: e.target.value })}
                          className="app-input min-h-[96px] resize-none"
                          placeholder="أي توضيح إضافي عن هذا الالتزام"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      سيتم إنشاء {obligationForm.installment_count} قسط. أول 3 أقساط: {installmentPreview.slice(0, 3).map((value) => formatMoney(value)).join(' ، ')}
                      {installmentPreview.length > 3 ? ' ...' : ''}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowObligationForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        disabled={createEmployeeObligationPlan.isPending}
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateObligationPlan}
                        disabled={createEmployeeObligationPlan.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-60"
                      >
                        {createEmployeeObligationPlan.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            جاري الإنشاء...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            حفظ الخطة
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {customFields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>لا توجد حقول إضافية محددة</p>
                  <p className="text-sm mt-2">يمكن إضافة حقول مخصصة من صفحة الإعدادات</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.field_label}
                        {field.is_required && <span className="text-red-500 mr-1">*</span>}
                      </label>
                      
                      {field.field_type === 'text' && (
                        <input
                          type="text"
                          value={String(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'text'))}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      )}

                      {field.field_type === 'textarea' && (
                        <textarea
                          value={String(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'textarea'))}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          rows={3}
                          disabled={!isEditMode}
                          className={`app-input min-h-[92px] resize-none ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      )}

                      {field.field_type === 'number' && (
                        <input
                          type="number"
                          value={String(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'number'))}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      )}

                      {field.field_type === 'date' && (
                        <input
                          type="date"
                          value={String(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'text'))}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      )}

                      {field.field_type === 'select' && field.field_options.options && (
                        <select
                          value={String(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'text'))}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`app-input py-2 ${!isEditMode ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        >
                          <option value="">اختر...</option>
                          {Array.isArray(field.field_options.options) && field.field_options.options.map((option: string | { label: string; value: string | number }) => {
                            const optionValue = typeof option === 'object' ? option.value : option
                            const optionLabel = typeof option === 'object' ? option.label : option
                            return (
                              <option key={String(optionValue)} value={String(optionValue)}>{String(optionLabel)}</option>
                            )
                          })}
                        </select>
                      )}

                      {field.field_type === 'boolean' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={(getAdditionalFieldValue(formData.additional_fields[field.field_name], 'checkbox') as boolean)}
                            onChange={(e) => setFormData({
                              ...formData,
                              additional_fields: {
                                ...formData.additional_fields,
                                [field.field_name]: e.target.checked
                              }
                            })}
                            disabled={!isEditMode}
                            className="h-5 w-5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30 disabled:opacity-50"
                          />
                          <span className="text-sm text-gray-600">نعم</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="app-modal-footer flex justify-between p-6">
          {canDelete('employees') && onDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              title="حذف الموظف"
            >
              <X className="w-4 h-4" />
              حذف الموظف
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="app-button-secondary px-6 py-2"
              disabled={saving}
            >
              إغلاق
            </button>
            {isEditMode && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="app-button-secondary px-6 py-2"
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4" />
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="app-button-primary px-6 py-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

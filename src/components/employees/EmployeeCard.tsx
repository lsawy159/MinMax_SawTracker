import { useState, useEffect, useRef } from 'react'
import { Employee, Company, CustomField, supabase } from '@/lib/supabase'
import { X, Calendar, Phone, MapPin, Briefcase, CreditCard, FileText, Save, AlertTriangle, Edit2, RotateCcw, Search, ChevronDown } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'

interface EmployeeCardProps {
  employee: Employee & { company: Company }
  onClose: () => void
  onUpdate: () => void
  onDelete?: (employee: Employee & { company: Company }) => void
}

export default function EmployeeCard({ employee, onClose, onUpdate, onDelete }: EmployeeCardProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [formData, setFormData] = useState<any>({
    ...employee,
    company_id: employee.company_id,
    additional_fields: employee.additional_fields || {},
    // التأمين الصحي للموظف
    health_insurance_expiry: employee.health_insurance_expiry || '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
    hired_worker_contract_expiry: employee.hired_worker_contract_expiry || '',
    salary: employee.salary || 0,
    notes: employee.notes || '',
    residence_image_url: employee.residence_image_url || ''
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'custom'>('basic')
  const [isEditMode, setIsEditMode] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false)
  const companyDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCustomFields()
    loadCompanies()
  }, [])

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      console.error('Error loading custom fields:', error)
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
      console.error('Error loading companies:', error)
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

  const getDaysRemaining = (date: string) => {
    return differenceInDays(new Date(date), new Date())
  }

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

  const logActivity = async (action: string, changes: any) => {
    try {
      await supabase
        .from('activity_log')
        .insert({
          entity_type: 'employee',
          entity_id: employee.id,
          action: action,
          details: {
            employee_name: employee.name,
            changes: changes,
            timestamp: new Date().toISOString()
          }
        })
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // تحضير البيانات للحفظ
      const updateData: any = {
        name: formData.name,
        profession: formData.profession,
        nationality: formData.nationality,
        phone: formData.phone,
        passport_number: formData.passport_number,
        project_name: formData.project_name,
        bank_account: formData.bank_account,
        birth_date: formData.birth_date,
        residence_number: Number(formData.residence_number),
        joining_date: formData.joining_date,
        contract_expiry: formData.contract_expiry,
        hired_worker_contract_expiry: formData.hired_worker_contract_expiry || null,
        residence_expiry: formData.residence_expiry,
        residence_image_url: formData.residence_image_url || null,
        salary: Number(formData.salary) || 0,
        health_insurance_expiry: formData.health_insurance_expiry || null,  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        notes: formData.notes || null,
        additional_fields: formData.additional_fields
      }

      // تحديد نوع التعديل
      let actionType = 'full_edit'
      if (formData.company_id && formData.company_id !== employee.company_id) {
        actionType = 'company_transfer'
        updateData.company_id = formData.company_id
      }

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', employee.id)

      if (error) throw error

      // إنشاء قائمة التغييرات بمقارنة البيانات القديمة والجديدة
      const changes: Record<string, { old_value: any; new_value: any }> = {}
      
      // الحقول التي يجب تتبعها
      const fieldsToTrack = [
        'name', 'profession', 'nationality', 'phone', 'passport_number',
        'project_name', 'bank_account', 'birth_date', 'residence_number',
        'joining_date', 'contract_expiry', 'hired_worker_contract_expiry', 'residence_expiry', 'residence_image_url', 'salary',
        'health_insurance_expiry', 'notes', 'company_id'  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
      ]
      
      fieldsToTrack.forEach(field => {
        const oldValue = employee[field as keyof typeof employee]
        const newValue = updateData[field]
        
        // مقارنة القيم (معالجة null و undefined)
        const oldVal = oldValue === null || oldValue === undefined ? null : oldValue
        const newVal = newValue === null || newValue === undefined ? null : newValue
        
        // التحقق من التغيير (مع مراعاة التحويلات الرقمية)
        if (field === 'residence_number' || field === 'salary') {
          const oldNum = oldVal ? Number(oldVal) : null
          const newNum = newVal ? Number(newVal) : null
          if (oldNum !== newNum) {
            changes[field] = {
              old_value: oldNum,
              new_value: newNum
            }
          }
        } else if (oldVal !== newVal) {
          changes[field] = {
            old_value: oldVal,
            new_value: newVal
          }
        }
      })

      // تسجيل النشاط
      await logActivity(actionType, changes)

      toast.success('تم حفظ التعديلات بنجاح')
      setIsEditMode(false) // العودة إلى وضع القراءة فقط
      
      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))
      
      onUpdate()
    } catch (error: any) {
      console.error('Error saving employee:', error)
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
      additional_fields: employee.additional_fields || {},
      health_insurance_expiry: employee.health_insurance_expiry || '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
      hired_worker_contract_expiry: employee.hired_worker_contract_expiry || '',
      salary: employee.salary || 0,
      notes: employee.notes || '',
      residence_image_url: employee.residence_image_url || ''
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

  const residenceDays = getDaysRemaining(employee.residence_expiry)
  const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
  const hiredWorkerContractDays = employee.hired_worker_contract_expiry ? getDaysRemaining(employee.hired_worker_contract_expiry) : null
  const healthInsuranceDays = employee.health_insurance_expiry ? getDaysRemaining(employee.health_insurance_expiry) : null  // تحديث: ending_subscription_insurance_date → health_insurance_expiry, insuranceDays → healthInsuranceDays

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 text-white p-6 flex justify-between items-center ${
          isEditMode 
            ? 'bg-gradient-to-r from-orange-600 to-orange-700' 
            : 'bg-gradient-to-r from-blue-600 to-blue-700'
        }`}>
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className={`mt-1 ${isEditMode ? 'text-orange-100' : 'text-blue-100'}`}>
              {employee.profession} - {employee.company.name}
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
                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                إلغاء التعديل
              </button>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                <Edit2 className="w-4 h-4" />
                تعديل
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
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
                <HijriDateDisplay date={employee.residence_expiry}>
                  {formatDateShortWithHijri(employee.residence_expiry)}
                </HijriDateDisplay>
                {residenceDays < 0 ? ' (منتهية)' : ` (بعد ${residenceDays} يوم)`}
              </div>
            </div>
          </div>

          {contractDays !== null && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(contractDays)}`}>
              <AlertTriangle className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">انتهاء العقد</div>
                <div className="text-sm">
                  <HijriDateDisplay date={employee.contract_expiry!}>
                    {formatDateShortWithHijri(employee.contract_expiry!)}
                  </HijriDateDisplay>
                  {contractDays < 0 ? ' (منتهي)' : ` (بعد ${contractDays} يوم)`}
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
                  <HijriDateDisplay date={employee.hired_worker_contract_expiry!}>
                    {formatDateShortWithHijri(employee.hired_worker_contract_expiry!)}
                  </HijriDateDisplay>
                  {hiredWorkerContractDays < 0 ? ' (منتهي)' : ` (بعد ${hiredWorkerContractDays} يوم)`}
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
                    <HijriDateDisplay date={employee.health_insurance_expiry!}>
                      {formatDateShortWithHijri(employee.health_insurance_expiry!)}
                    </HijriDateDisplay>
                    {healthInsuranceDays < 0 ? ')' : ` (بعد ${healthInsuranceDays} يوم)`}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex-1 px-6 py-3 font-medium transition ${
                activeTab === 'basic'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              البيانات الأساسية
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-6 py-3 font-medium transition ${
                activeTab === 'custom'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الحقول الإضافية ({customFields.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'basic' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. الاسم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 2. المهنة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  المهنة
                </label>
                <input
                  type="text"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  onChange={(e) => setFormData({ ...formData, residence_number: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 5. رقم الجواز */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم جواز السفر</label>
                <input
                  type="text"
                  value={formData.passport_number || ''}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 6. رقم الهاتف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 7. الحساب البنكي */}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 8. الراتب */}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                  placeholder="الراتب الشهري"
                />
              </div>

              {/* 9. المشروع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المشروع</label>
                <input
                  type="text"
                  value={formData.project_name || ''}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 10. الشركة أو المؤسسة */}
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
                      className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
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

              {/* 11. تاريخ الميلاد */}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                />
              </div>

              {/* 12. تاريخ الالتحاق */}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  onChange={(e) => setFormData({ ...formData, hired_worker_contract_expiry: e.target.value })}
                  disabled={!isEditMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="أدخل أي ملاحظات إضافية عن الموظف..."
                  />
                ) : (
                  <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 min-h-[100px] whitespace-pre-wrap">
                    {formData.notes || 'لا توجد ملاحظات'}
                  </div>
                )}
              </div>
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
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        />
                      )}

                      {field.field_type === 'textarea' && (
                        <textarea
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          rows={3}
                          disabled={!isEditMode}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        />
                      )}

                      {field.field_type === 'number' && (
                        <input
                          type="number"
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        />
                      )}

                      {field.field_type === 'date' && (
                        <input
                          type="date"
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        />
                      )}

                      {field.field_type === 'select' && field.field_options.options && (
                        <select
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          disabled={!isEditMode}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            isEditMode ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        >
                          <option value="">اختر...</option>
                          {field.field_options.options.map((option: string) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}

                      {field.field_type === 'boolean' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.additional_fields[field.field_name] || false}
                            onChange={(e) => setFormData({
                              ...formData,
                              additional_fields: {
                                ...formData.additional_fields,
                                [field.field_name]: e.target.checked
                              }
                            })}
                            disabled={!isEditMode}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
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
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-between">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            title="حذف الموظف"
          >
            <X className="w-4 h-4" />
            حذف الموظف
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              disabled={saving}
            >
              إغلاق
            </button>
            {isEditMode && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4" />
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400"
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

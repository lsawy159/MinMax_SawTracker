import { useState, useEffect, useRef } from 'react'
import { supabase, Company } from '@/lib/supabase'
import { X, UserPlus, AlertCircle, CheckCircle, Users, Search, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CompanyWithStats extends Company {
  employee_count: number
  available_slots: number
}

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false)
  const companyDropdownRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    nationality: '',
    birth_date: '',
    phone: '',
    passport_number: '',
    residence_number: '',
    joining_date: '',
    contract_expiry: '',
    hired_worker_contract_expiry: '',
    residence_expiry: '',
    project_name: '',
    bank_account: '',
    salary: '',
    health_insurance_expiry: '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
    residence_image_url: '',
    notes: '',
    company_id: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadCompanies()
    } else {
      // إعادة تعيين النموذج عند إغلاق المودال
      setFormData({
        name: '',
        profession: '',
        nationality: '',
        birth_date: '',
        phone: '',
        passport_number: '',
        residence_number: '',
        joining_date: '',
        contract_expiry: '',
        hired_worker_contract_expiry: '',
        residence_expiry: '',
        project_name: '',
        bank_account: '',
        salary: '',
        health_insurance_expiry: '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        residence_image_url: '',
        notes: '',
        company_id: ''
      })
      setCompanySearchQuery('')
      setIsCompanyDropdownOpen(false)
    }
  }, [isOpen])

  // تحديث نص البحث عند تغيير المؤسسة المختارة (فقط عند اختيار مؤسسة، وليس عند الكتابة)
  useEffect(() => {
    if (formData.company_id && companies.length > 0) {
      const selectedCompany = companies.find(c => c.id === formData.company_id)
      if (selectedCompany) {
        const displayText = `${selectedCompany.name} - ${selectedCompany.unified_number} - (${selectedCompany.employee_count}/${selectedCompany.max_employees})`
        // تحديث فقط إذا كان النص مختلف (لتجنب التداخل مع الكتابة)
        if (companySearchQuery !== displayText) {
          setCompanySearchQuery(displayText)
        }
      }
    } else if (!formData.company_id && companySearchQuery) {
      // إعادة تعيين فقط إذا لم تكن هناك مؤسسة مختارة
      setCompanySearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.company_id]) // companies يتم تحديثه عند loadCompanies، لذلك لا نحتاج إضافته

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

  const loadCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (error) throw error

      // [OPTIMIZATION] حساب عدد الموظفين لكل الشركات باستعلام واحد بدلاً من عدة استعلامات
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('company_id')

      if (employeesError) {
        console.error('Error fetching employees:', employeesError)
        throw employeesError
      }

      // حساب عدد الموظفين لكل شركة
      const employeeCounts: Record<string, number> = {}
      employeesData?.forEach(emp => {
        if (emp.company_id) {
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      // دمج البيانات
      const companiesWithStats = (companiesData || []).map((company) => {
        const employeeCount = employeeCounts[company.id] || 0
        const maxEmployees = company.max_employees || 4
        const availableSlots = Math.max(0, maxEmployees - employeeCount)

        return { ...company, employee_count: employeeCount, available_slots: availableSlots }
      })

      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error loading companies:', error)
      toast.error('فشل تحميل قائمة المؤسسات')
    }
  }

  // دالة حساب الأماكن الشاغرة
  const calculateAvailableSlots = (maxEmployees: number, currentEmployees: number): number => {
    return Math.max(0, maxEmployees - currentEmployees)
  }

  // دالة الحصول على لون حالة الأماكن الشاغرة
  const getAvailableSlotsColor = (availableSlots: number) => {
    if (availableSlots === 0) return 'text-red-600 bg-red-50'
    if (availableSlots === 1) return 'text-orange-600 bg-orange-50'
    return 'text-green-600 bg-green-50'
  }

  // دالة الحصول على وصف حالة الأماكن الشاغرة
  const getAvailableSlotsText = (availableSlots: number, maxEmployees: number) => {
    if (availableSlots === 0) return 'مكتملة'
    if (availableSlots === 1) return 'مكان واحد متبقي'
    return `${availableSlots} أماكن متاحة`
  }

  // تصفية المؤسسات: إخفاء المكتملة والبحث
  const filteredCompanies = companies.filter(company => {
    // إخفاء المؤسسات المكتملة
    if (company.available_slots === 0) return false
    
    // البحث في الاسم أو الرقم الموحد
    if (companySearchQuery.trim()) {
      const query = companySearchQuery.toLowerCase().trim()
      const nameMatch = company.name?.toLowerCase().includes(query)
      const unifiedNumberMatch = company.unified_number?.toString().includes(query)
      return nameMatch || unifiedNumberMatch
    }
    
    return true
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    // التحقق من الحقول المطلوبة
    if (!formData.name.trim()) {
      toast.error('الرجاء إدخال اسم الموظف')
      return false
    }
    if (!formData.residence_number.trim()) {
      toast.error('الرجاء إدخال رقم الإقامة')
      return false
    }
    if (!formData.company_id) {
      toast.error('الرجاء اختيار المؤسسة')
      return false
    }

    // التحقق من وجود أماكن شاغرة في المؤسسة المختارة
    const selectedCompany = companies.find(c => c.id === formData.company_id)
    if (selectedCompany) {
      const availableSlots = selectedCompany.available_slots
      if (availableSlots === 0) {
        toast.error(`لا يمكن إضافة موظف جديد. المؤسسة "${selectedCompany.name}" مكتملة (${selectedCompany.employee_count}/${selectedCompany.max_employees} موظف)`)
        return false
      }
    }

    // التحقق من صيغة التواريخ
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date)
      if (isNaN(birthDate.getTime())) {
        toast.error('تاريخ الميلاد غير صحيح')
        return false
      }
    }

    if (formData.joining_date) {
      const joiningDate = new Date(formData.joining_date)
      if (isNaN(joiningDate.getTime())) {
        toast.error('تاريخ الالتحاق غير صحيح')
        return false
      }
    }

    const residenceDate = new Date(formData.residence_expiry)
    if (isNaN(residenceDate.getTime())) {
      toast.error('تاريخ انتهاء الإقامة غير صحيح')
      return false
    }

    if (formData.contract_expiry) {
      const contractDate = new Date(formData.contract_expiry)
      if (isNaN(contractDate.getTime())) {
        toast.error('تاريخ انتهاء العقد غير صحيح')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // إعداد البيانات للإدراج
      const employeeData = {
        name: formData.name.trim(),
        profession: formData.profession.trim(),
        nationality: formData.nationality.trim(),
        birth_date: formData.birth_date || null,
        phone: formData.phone.trim() || null,
        passport_number: formData.passport_number.trim(),
        residence_number: formData.residence_number.trim(),
        joining_date: formData.joining_date,
        contract_expiry: formData.contract_expiry || null,
        hired_worker_contract_expiry: formData.hired_worker_contract_expiry || null,
        residence_expiry: formData.residence_expiry,
        project_name: formData.project_name.trim() || null,
        bank_account: formData.bank_account.trim() || null,
        salary: Number(formData.salary) || 0,
        health_insurance_expiry: formData.health_insurance_expiry || null,  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        residence_image_url: formData.residence_image_url.trim() || null,
        notes: formData.notes.trim() || null,
        company_id: formData.company_id
      }

      const { error } = await supabase
        .from('employees')
        .insert([employeeData])

      if (error) throw error

      toast.success('تم إضافة الموظف بنجاح')
      
      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))
      
      // إعادة تعيين النموذج
      setFormData({
        name: '',
        profession: '',
        nationality: '',
        birth_date: '',
        phone: '',
        passport_number: '',
        residence_number: '',
        joining_date: '',
        contract_expiry: '',
        hired_worker_contract_expiry: '',
        residence_expiry: '',
        project_name: '',
        bank_account: '',
        salary: '',
        health_insurance_expiry: '',  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        residence_image_url: '',
        notes: '',
        company_id: ''
      })

      // إغلاق المودال وإعادة تحميل البيانات
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error adding employee:', error)
      toast.error(error.message || 'فشل إضافة الموظف')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">إضافة موظف جديد</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            disabled={loading}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. الاسم */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الاسم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل اسم الموظف"
                required
                disabled={loading}
              />
            </div>

            {/* 2. المهنة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المهنة
              </label>
              <input
                type="text"
                name="profession"
                value={formData.profession}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل المهنة"
                disabled={loading}
              />
            </div>

            {/* 3. الجنسية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الجنسية
              </label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل الجنسية"
                disabled={loading}
              />
            </div>

            {/* 4. رقم الإقامة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الإقامة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="residence_number"
                value={formData.residence_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل رقم الإقامة"
                required
                disabled={loading}
              />
            </div>

            {/* 5. رقم جواز السفر */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم جواز السفر
              </label>
              <input
                type="text"
                name="passport_number"
                value={formData.passport_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل رقم جواز السفر"
                disabled={loading}
              />
            </div>

            {/* 6. رقم الهاتف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الهاتف
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="05xxxxxxxx"
                disabled={loading}
              />
            </div>

            {/* 7. الحساب البنكي */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحساب البنكي
              </label>
              <input
                type="text"
                name="bank_account"
                value={formData.bank_account}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل رقم الحساب البنكي"
                disabled={loading}
              />
            </div>

            {/* 8. الراتب */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الراتب
              </label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل الراتب"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>

            {/* 9. المشروع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المشروع
              </label>
              <input
                type="text"
                name="project_name"
                value={formData.project_name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل اسم المشروع"
                disabled={loading}
              />
            </div>

            {/* 10. الشركة أو المؤسسة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الشركة أو المؤسسة <span className="text-red-500">*</span>
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
                    onFocus={() => setIsCompanyDropdownOpen(true)}
                    placeholder="ابحث بالاسم أو الرقم الموحد..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={loading}
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                
                {isCompanyDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredCompanies.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        {companySearchQuery.trim() ? 'لا توجد نتائج' : 'لا توجد مؤسسات متاحة'}
                      </div>
                    ) : (
                      filteredCompanies.map(company => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, company_id: company.id }))
                            setCompanySearchQuery(`${company.name} - ${company.unified_number} - (${company.employee_count}/${company.max_employees})`)
                            setIsCompanyDropdownOpen(false)
                          }}
                          className="w-full px-4 py-2.5 text-right text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                        >
                          {company.name} - {company.unified_number} - ({company.employee_count}/{company.max_employees})
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              {/* Hidden input for form validation */}
              <input
                type="hidden"
                name="company_id"
                value={formData.company_id}
                required
              />
              
              {/* عرض تفاصيل المؤسسة المختارة */}
              {formData.company_id && (
                (() => {
                  const selectedCompany = companies.find(c => c.id === formData.company_id)
                  if (!selectedCompany) return null
                  
                  const availableSlots = selectedCompany.available_slots
                  const slotsColor = getAvailableSlotsColor(availableSlots)
                  const slotsText = getAvailableSlotsText(availableSlots, selectedCompany.max_employees)
                  
                  return (
                    <div className={`mt-3 p-3 rounded-lg border ${availableSlots === 0 ? 'border-red-200 bg-red-50' : availableSlots === 1 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium text-gray-700">معلومات المؤسسة</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">العدد الحالي:</span>
                          <span className="font-medium">{selectedCompany.employee_count} موظف</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">الحد الأقصى:</span>
                          <span className="font-medium">{selectedCompany.max_employees} موظف</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">الأماكن الشاغرة:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${slotsColor}`}>
                            {slotsText}
                          </span>
                        </div>
                        {availableSlots === 0 && (
                          <div className="flex items-center gap-2 mt-2 p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-xs text-red-700 font-medium">
                              هذه المؤسسة مكتملة ولا يمكن إضافة موظفين جدد
                            </span>
                          </div>
                        )}
                        {availableSlots === 1 && (
                          <div className="flex items-center gap-2 mt-2 p-2 bg-orange-100 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-orange-600" />
                            <span className="text-xs text-orange-700 font-medium">
                              تحذير: يتبقى مكان واحد فقط في هذه المؤسسة
                            </span>
                          </div>
                        )}
                        {availableSlots > 1 && (
                          <div className="flex items-center gap-2 mt-2 p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">
                              يمكن إضافة موظفين جدد ({availableSlots} أماكن متاحة)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          </div>

          {/* 11-16. حقول التواريخ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* 11. تاريخ الميلاد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ الميلاد
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* 12. تاريخ الالتحاق */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ الالتحاق
              </label>
              <input
                type="date"
                name="joining_date"
                value={formData.joining_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* 13. تاريخ انتهاء الإقامة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء الإقامة
              </label>
              <input
                type="date"
                name="residence_expiry"
                value={formData.residence_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* 14. تاريخ انتهاء العقد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء العقد
              </label>
              <input
                type="date"
                name="contract_expiry"
                value={formData.contract_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* 15. تاريخ انتهاء عقد أجير */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء عقد أجير
              </label>
              <input
                type="date"
                name="hired_worker_contract_expiry"
                value={formData.hired_worker_contract_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* 16. تاريخ انتهاء التأمين الصحي */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء التأمين الصحي
              </label>
              <input
                type="date"
                name="health_insurance_expiry"
                value={formData.health_insurance_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>

          {/* 17. رابط صورة الإقامة */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رابط صورة الإقامة
            </label>
            <input
              type="text"
              name="residence_image_url"
              value={formData.residence_image_url || ''}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="أدخل رابط صورة الإقامة"
              disabled={loading}
            />
          </div>

          {/* 18. الملاحظات */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الملاحظات
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="أدخل أي ملاحظات إضافية عن الموظف..."
              disabled={loading}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  إضافة الموظف
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase, Company } from '../../lib/supabase'
import { X, UserPlus, AlertCircle, CheckCircle, Users } from 'lucide-react'
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
    residence_expiry: '',
    project_name: '',
    bank_account: '',

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
        residence_expiry: '',
        project_name: '',
        bank_account: '',
        company_id: ''
      })
    }
  }, [isOpen])

  const loadCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (error) throw error

      // حساب عدد الموظفين والأماكن الشاغرة لكل مؤسسة
      const companiesWithStats = await Promise.all(
        (companiesData || []).map(async (company) => {
          const { count } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          const employeeCount = count || 0
          const maxEmployees = company.max_employees || 4
          const availableSlots = Math.max(0, maxEmployees - employeeCount)

          return { ...company, employee_count: employeeCount, availableSlots }
        })
      )

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    // التحقق من الحقول المطلوبة
    if (!formData.name.trim()) {
      toast.error('الرجاء إدخال اسم الموظف')
      return false
    }
    if (!formData.profession.trim()) {
      toast.error('الرجاء إدخال المهنة')
      return false
    }
    if (!formData.nationality.trim()) {
      toast.error('الرجاء إدخال الجنسية')
      return false
    }
    if (!formData.passport_number.trim()) {
      toast.error('الرجاء إدخال رقم الجواز')
      return false
    }
    if (!formData.residence_number.trim()) {
      toast.error('الرجاء إدخال رقم الإقامة')
      return false
    }
    if (!formData.joining_date) {
      toast.error('الرجاء إدخال تاريخ الالتحاق')
      return false
    }
    if (!formData.residence_expiry) {
      toast.error('الرجاء إدخال تاريخ انتهاء الإقامة')
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
        residence_expiry: formData.residence_expiry,
        project_name: formData.project_name.trim() || null,
        bank_account: formData.bank_account.trim() || null,

        company_id: formData.company_id
      }

      const { error } = await supabase
        .from('employees')
        .insert([employeeData])

      if (error) throw error

      toast.success('تم إضافة الموظف بنجاح')
      
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
        residence_expiry: '',
        project_name: '',
        bank_account: '',
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

        {/* Important Notice */}
        <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="bg-yellow-100 p-1 rounded">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">تنبيه مهم</h3>
              <p className="text-sm text-yellow-700 mt-1">
                <strong>رقم اشتراك التأمينات للموظف:</strong> هو رقم مخصص لكل موظف فردياً في التأمينات الاجتماعية
                <br />
                <strong>رقم اشتراك التأمينات للمؤسسة:</strong> هو رقم المؤسسة نفسه (يتم اختياره أعلاه)
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* الاسم */}
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

            {/* المهنة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المهنة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="profession"
                value={formData.profession}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل المهنة"
                required
                disabled={loading}
              />
            </div>

            {/* الجنسية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الجنسية <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل الجنسية"
                required
                disabled={loading}
              />
            </div>

            {/* رقم الإقامة */}
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

            {/* تاريخ انتهاء الإقامة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء الإقامة <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="residence_expiry"
                value={formData.residence_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* تاريخ انتهاء العقد */}
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

            {/* المؤسسة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المؤسسة <span className="text-red-500">*</span>
              </label>
              <select
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                required
                disabled={loading}
              >
                <option value="">اختر المؤسسة</option>
                {companies.map(company => {
                  const isFull = company.available_slots === 0
                  return (
                    <option 
                      key={company.id} 
                      value={company.id}
                      disabled={isFull}
                    >
                      {company.name} ({company.employee_count}/{company.max_employees}) {isFull ? '- مكتملة' : `- ${company.available_slots} مكان متاح`}
                    </option>
                  )
                })}
              </select>
              
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
                            {availableSlots > 0 ? `${availableSlots} مكان` : 'لا توجد أماكن'}
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

            {/* المشروع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المشروع (اختياري)
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

            {/* رقم الجوال */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الجوال
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

            {/* الحساب البنكي */}
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

            {/* تاريخ الالتحاق */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ الالتحاق <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="joining_date"
                value={formData.joining_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* رقم الجواز */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الجواز <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="passport_number"
                value={formData.passport_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل رقم الجواز"
                required
                disabled={loading}
              />
            </div>

            {/* تاريخ الميلاد */}
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

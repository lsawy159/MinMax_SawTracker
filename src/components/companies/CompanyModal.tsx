import { useState, useEffect } from 'react'
import { supabase, Company } from '../../lib/supabase'
import { X, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { calculateCommercialRegistrationStatus, calculateInsuranceSubscriptionStatus } from '../../utils/autoCompanyStatus'

interface CompanyModalProps {
  isOpen: boolean
  company?: Company | null
  onClose: () => void
  onSuccess: () => void
}

export default function CompanyModal({ isOpen, company, onClose, onSuccess }: CompanyModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    tax_number: '',
    unified_number: '',
    labor_subscription_number: '',
    company_type: '',
    commercial_registration_expiry: '',
    insurance_subscription_expiry: '',
    government_docs_renewal: '',
    // الحقول الجديدة
    ending_subscription_power_date: '',
    ending_subscription_moqeem_date: '',
    max_employees: ''
  })

  const isEditing = !!company

  useEffect(() => {
    if (isOpen) {
      if (company) {
        console.log('📋 تحميل بيانات المؤسسة للتعديل:', {
          id: company.id,
          name: company.name,
          hasEndingPowerDate: !!company.ending_subscription_power_date,
          hasEndingMoqeemDate: !!company.ending_subscription_moqeem_date,
          hasMaxEmployees: !!company.max_employees
        })
        
        setFormData({
          name: company.name || '',
          tax_number: company.tax_number?.toString() || '',
          unified_number: company.unified_number?.toString() || '',
          labor_subscription_number: company.labor_subscription_number || '',
          company_type: company.company_type || '',
          commercial_registration_expiry: company.commercial_registration_expiry || '',
          insurance_subscription_expiry: company.insurance_subscription_expiry || '',
          government_docs_renewal: company.government_docs_renewal || '',
          ending_subscription_power_date: company.ending_subscription_power_date || '',
          ending_subscription_moqeem_date: company.ending_subscription_moqeem_date || '',
          max_employees: company.max_employees?.toString() || ''
        })
      } else {
        console.log('🆕 إعادة تعيين النموذج للإضافة الجديدة')
        setFormData({
          name: '',
          tax_number: '',
          unified_number: '',
          labor_subscription_number: '',
          company_type: '',
          commercial_registration_expiry: '',
          insurance_subscription_expiry: '',
          government_docs_renewal: '',
          ending_subscription_power_date: '',
          ending_subscription_moqeem_date: '',
          max_employees: ''
        })
      }
    }
  }, [isOpen, company])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const oldValue = formData[name as keyof typeof formData]
    
    // تسجيل التغييرات للمساعدة في تتبع الأخطاء
    if (oldValue !== value) {
      console.log(`📝 تغيير في الحقل "${name}":`, {
        from: oldValue,
        to: value
      })
    }
    
    // التحقق من صحة القيم أثناء الإدخال
    if (name === 'tax_number' || name === 'unified_number' || name === 'max_employees') {
      if (value && value.trim() && isNaN(parseInt(value.trim()))) {
        console.warn(`⚠️ قيمة غير صحيحة في الحقل "${name}":`, value)
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    console.log('🔍 بدء التحقق من صحة البيانات:', formData)
    
    // التحقق من الحقول الإجبارية
    if (!formData.name.trim()) {
      const errorMsg = 'الرجاء إدخال اسم المؤسسة (حقل إجباري)'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }
    
    if (!formData.tax_number.trim()) {
      const errorMsg = 'الرجاء إدخال رقم اشتراك التأمينات (حقل إجباري)'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }
    
    if (!formData.unified_number.trim()) {
      const errorMsg = 'الرجاء إدخال الرقم الموحد (حقل إجباري)'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }

    // التحقق من صيغة الأرقام
    if (formData.tax_number.trim() && isNaN(parseInt(formData.tax_number.trim()))) {
      const errorMsg = 'رقم اشتراك التأمينات يجب أن يكون رقماً صحيحاً'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }
    
    if (formData.unified_number.trim() && isNaN(parseInt(formData.unified_number.trim()))) {
      const errorMsg = 'الرقم الموحد يجب أن يكون رقماً صحيحاً'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }

    // التحقق من صيغة التواريخ مع رسائل أوضح
    const dateFields = [
      { key: 'commercial_registration_expiry', name: 'انتهاء السجل التجاري' },
      { key: 'insurance_subscription_expiry', name: 'انتهاء التأمين' },
      { key: 'government_docs_renewal', name: 'تجديد الوثائق الحكومية' },
      { key: 'ending_subscription_power_date', name: 'انتهاء اشتراك قوى' },
      { key: 'ending_subscription_moqeem_date', name: 'انتهاء اشتراك مقيم' }
    ]

    for (const field of dateFields) {
      const value = formData[field.key as keyof typeof formData] as string
      if (value && value.trim()) {
        const date = new Date(value.trim())
        if (isNaN(date.getTime())) {
          const errorMsg = `تاريخ ${field.name} غير صحيح. يرجى التأكد من صيغة التاريخ`
          console.error('❌ خطأ في التحقق:', errorMsg, { field: field.key, value })
          toast.error(errorMsg)
          return false
        }
      }
    }

    // التحقق من عدد الموظفين
    if (formData.max_employees.trim()) {
      const maxEmp = parseInt(formData.max_employees.trim())
      if (isNaN(maxEmp) || maxEmp < 1) {
        const errorMsg = 'عدد الموظفين الأقصى يجب أن يكون رقماً صحيحاً أكبر من صفر'
        console.error('❌ خطأ في التحقق:', errorMsg, { max_employees: formData.max_employees })
        toast.error(errorMsg)
        return false
      }
      if (maxEmp > 10000) {
        const errorMsg = 'عدد الموظفين الأقصى لا يمكن أن يتجاوز 10,000 موظف'
        console.warn('⚠️ تحذير في التحقق:', errorMsg, { max_employees: maxEmp })
        toast.error(errorMsg)
        return false
      }
    }

    // التحقق من عدم تداخل التواريخ
    const allDates = {
      'انتهاء السجل التجاري': formData.commercial_registration_expiry,
      'انتهاء التأمين': formData.insurance_subscription_expiry,
      'تجديد الوثائق الحكومية': formData.government_docs_renewal,
      'انتهاء اشتراك قوى': formData.ending_subscription_power_date,
      'انتهاء اشتراك مقيم': formData.ending_subscription_moqeem_date
    }
    
    const today = new Date()
    const invalidDates = Object.entries(allDates).filter(([name, date]) => {
      if (date && date.trim()) {
        const dateObj = new Date(date.trim())
        return dateObj < new Date(today.getFullYear() - 10, 0, 1) // أقدم من 10 سنوات
      }
      return false
    })
    
    if (invalidDates.length > 0) {
      const errorMsg = `بعض التواريخ تبدو قديمة جداً: ${invalidDates.map(([name]) => name).join(', ')}`
      console.warn('⚠️ تحذير في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }

    console.log('✅ تم التحقق من صحة البيانات بنجاح')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    console.log('🚀 بدء عملية حفظ المؤسسة:', {
      isEditing,
      companyId: company?.id,
      formData
    })

    try {
      // تحضير البيانات مع معالجة محسنة للقيم الفارغة
      const companyData = {
        name: formData.name.trim() || null,
        tax_number: formData.tax_number.trim() ? parseInt(formData.tax_number.trim()) : null,
        unified_number: formData.unified_number.trim() ? parseInt(formData.unified_number.trim()) : null,
        labor_subscription_number: formData.labor_subscription_number.trim() || null,
        company_type: formData.company_type.trim() || null,
        commercial_registration_expiry: formData.commercial_registration_expiry?.trim() || null,
        insurance_subscription_expiry: formData.insurance_subscription_expiry?.trim() || null,
        government_docs_renewal: formData.government_docs_renewal?.trim() || null,
        // الحقول الجديدة
        ending_subscription_power_date: formData.ending_subscription_power_date?.trim() || null,
        ending_subscription_moqeem_date: formData.ending_subscription_moqeem_date?.trim() || null,
        max_employees: formData.max_employees.trim() ? parseInt(formData.max_employees.trim()) : null
      }

      console.log('📊 البيانات المحضرة للحفظ:', companyData)

      let error
      let result

      if (isEditing && company) {
        console.log('🔄 تحديث مؤسسة موجودة:', company.id)
        result = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', company.id)
        error = result.error

        if (!error) {
          console.log('✅ تم تحديث المؤسسة بنجاح')
          await supabase.from('activity_logs').insert({
            action: 'تعديل مؤسسة',
            entity_type: 'company',
            entity_id: company.id,
            details: { company_name: formData.name, updated_fields: Object.keys(companyData) }
          })
        }
      } else {
        console.log('➕ إضافة مؤسسة جديدة')
        result = await supabase
          .from('companies')
          .insert([companyData])
        error = result.error

        if (!error) {
          console.log('✅ تم إضافة المؤسسة بنجاح')
          await supabase.from('activity_logs').insert({
            action: 'إضافة مؤسسة جديدة',
            entity_type: 'company',
            details: { company_name: formData.name, created_fields: Object.keys(companyData) }
          })
        }
      }

      if (error) {
        console.error('❌ خطأ في قاعدة البيانات:', error)
        // تحسين رسائل الأخطاء
        let errorMessage = `فشل ${isEditing ? 'تحديث' : 'إضافة'} المؤسسة`
        
        if (error.message?.includes('duplicate key')) {
          errorMessage = 'رقم اشتراك التأمينات أو الرقم الموحد موجود مسبقاً'
        } else if (error.message?.includes('violates')) {
          errorMessage = 'بيانات غير صحيحة أو ناقصة'
        } else if (error.message?.includes('network')) {
          errorMessage = 'خطأ في الاتصال بالخادم'
        } else if (error.message) {
          errorMessage += `: ${error.message}`
        }
        
        throw new Error(errorMessage)
      }

      console.log('🎉 تمت العملية بنجاح')
      
      // معلومات إضافية عن البيانات المحفوظة
      const successInfo = {
        action: isEditing ? 'تحديث' : 'إضافة',
        timestamp: new Date().toISOString(),
        fields: Object.keys(companyData).filter(key => 
          companyData[key as keyof typeof companyData] !== null && 
          companyData[key as keyof typeof companyData] !== undefined &&
          companyData[key as keyof typeof companyData] !== ''
        ),
        nullFields: Object.keys(companyData).filter(key => 
          companyData[key as keyof typeof companyData] === null || 
          companyData[key as keyof typeof companyData] === undefined ||
          companyData[key as keyof typeof companyData] === ''
        )
      }
      
      console.log('📋 ملخص البيانات المحفوظة:', successInfo)
      
      // إظهار رسائل تفصيلية للمستخدم
      if (isEditing) {
        toast.success('✅ تم تحديث المؤسسة بنجاح مع جميع البيانات الجديدة')
      } else {
        toast.success('✅ تم إضافة المؤسسة الجديدة بنجاح')
      }
      onSuccess()
    } catch (error: any) {
      const errorMsg = error.message || `حدث خطأ غير متوقع أثناء ${isEditing ? 'تحديث' : 'إضافة'} المؤسسة`
      console.error('💥 خطأ في حفظ المؤسسة:', {
        error: error.message,
        stack: error.stack,
        formData,
        isEditing,
        companyId: company?.id
      })
      toast.error(errorMsg)
    } finally {
      setLoading(false)
      console.log('🏁 انتهت عملية حفظ المؤسسة')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'تعديل المؤسسة' : 'إضافة مؤسسة جديدة'}
            </h2>
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
            {/* الاسم */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم المؤسسة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل اسم المؤسسة"
                required
                disabled={loading}
              />
            </div>

            {/* رقم اشتراك التأمينات */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم اشتراك التأمينات <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="tax_number"
                value={formData.tax_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل رقم اشتراك التأمينات"
                required
                disabled={loading}
              />
            </div>

            {/* الرقم الموحد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الرقم الموحد <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="unified_number"
                value={formData.unified_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="أدخل الرقم الموحد"
                required
                disabled={loading}
              />
            </div>

            {/* نوع المؤسسة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                نوع المؤسسة
              </label>
              <select
                name="company_type"
                value={formData.company_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={loading}
              >
                <option value="">اختر نوع المؤسسة</option>
                <option value="شركة">شركة</option>
                <option value="مؤسسة">مؤسسة</option>
                <option value="مكتب">مكتب</option>
                <option value="محل">محل</option>
                <option value="مستشفى">مستشفى</option>
                <option value="مدرسة">مدرسة</option>
                <option value="جامعة">جامعة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            {/* عدد الموظفين الأقصى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عدد الموظفين الأقصى
              </label>
              <input
                type="number"
                name="max_employees"
                value={formData.max_employees}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل عدد الموظفين الأقصى (افتراضي: 4)"
                disabled={loading}
              />
            </div>

            {/* رقم اشتراك قوى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم اشتراك قوى
              </label>
              <input
                type="text"
                name="labor_subscription_number"
                value={formData.labor_subscription_number}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل رقم اشتراك قوى"
                disabled={loading}
              />
            </div>

            {/* تاريخ انتهاء السجل التجاري */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء السجل التجاري
              </label>
              <input
                type="date"
                name="commercial_registration_expiry"
                value={formData.commercial_registration_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* تاريخ انتهاء التأمين */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء التأمين
              </label>
              <input
                type="date"
                name="insurance_subscription_expiry"
                value={formData.insurance_subscription_expiry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* تاريخ انتهاء اشتراك قوى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء اشتراك قوى
              </label>
              <input
                type="date"
                name="ending_subscription_power_date"
                value={formData.ending_subscription_power_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* تاريخ انتهاء اشتراك مقيم */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء اشتراك مقيم
              </label>
              <input
                type="date"
                name="ending_subscription_moqeem_date"
                value={formData.ending_subscription_moqeem_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* عرض حالة السجل التجاري المحسوبة تلقائياً */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة السجل التجاري
              </label>
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {formData.commercial_registration_expiry ? (
                  <div className={`p-2 rounded-md ${calculateCommercialRegistrationStatus(formData.commercial_registration_expiry).color.backgroundColor}`}>
                    <div className={`font-medium ${calculateCommercialRegistrationStatus(formData.commercial_registration_expiry).color.textColor}`}>
                      {calculateCommercialRegistrationStatus(formData.commercial_registration_expiry).status}
                    </div>
                    <div className={`text-sm mt-1 ${calculateCommercialRegistrationStatus(formData.commercial_registration_expiry).color.textColor}`}>
                      {calculateCommercialRegistrationStatus(formData.commercial_registration_expiry).description}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    يرجى إدخال تاريخ انتهاء السجل التجاري أولاً
                  </div>
                )}
              </div>
            </div>

            {/* عرض حالة اشتراك التأمينات المحسوبة تلقائياً */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة اشتراك التأمينات
              </label>
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {formData.insurance_subscription_expiry ? (
                  <div className={`p-2 rounded-md ${calculateInsuranceSubscriptionStatus(formData.insurance_subscription_expiry).color.backgroundColor}`}>
                    <div className={`font-medium ${calculateInsuranceSubscriptionStatus(formData.insurance_subscription_expiry).color.textColor}`}>
                      {calculateInsuranceSubscriptionStatus(formData.insurance_subscription_expiry).status}
                    </div>
                    <div className={`text-sm mt-1 ${calculateInsuranceSubscriptionStatus(formData.insurance_subscription_expiry).color.textColor}`}>
                      {calculateInsuranceSubscriptionStatus(formData.insurance_subscription_expiry).description}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    يرجى إدخال تاريخ انتهاء اشتراك التأمينات أولاً
                  </div>
                )}
              </div>
            </div>

            {/* تجديد الوثائق الحكومية */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تجديد الوثائق الحكومية
              </label>
              <input
                type="date"
                name="government_docs_renewal"
                value={formData.government_docs_renewal}
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
                  جاري {isEditing ? 'التحديث' : 'الإضافة'}...
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5" />
                  {isEditing ? 'تحديث المؤسسة' : 'إضافة المؤسسة'}
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
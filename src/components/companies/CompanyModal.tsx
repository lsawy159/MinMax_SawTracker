import { useState, useEffect } from 'react'
import { supabase, Company } from '../../lib/supabase'
import { X, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { 
  calculateCommercialRegistrationStatus, 
  calculateInsuranceSubscriptionStatus,
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus
} from '../../utils/autoCompanyStatus'

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
    commercial_registration_expiry: '',
    insurance_subscription_expiry: '',
    // الحقول الجديدة
    ending_subscription_power_date: '',
    ending_subscription_moqeem_date: '',
    max_employees: '',
    notes: '',
    exemptions: ''
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
          commercial_registration_expiry: company.commercial_registration_expiry || '',
          insurance_subscription_expiry: company.insurance_subscription_expiry || '',
          ending_subscription_power_date: company.ending_subscription_power_date || '',
          ending_subscription_moqeem_date: company.ending_subscription_moqeem_date || '',
          max_employees: company.max_employees?.toString() || '',
          notes: company.notes || '',
          exemptions: company.exemptions || ''
        })
      } else {
        console.log('🆕 إعادة تعيين النموذج للإضافة الجديدة')
        setFormData({
          name: '',
          tax_number: '',
          unified_number: '',
          labor_subscription_number: '',
          commercial_registration_expiry: '',
          insurance_subscription_expiry: '',
          ending_subscription_power_date: '',
          ending_subscription_moqeem_date: '',
          max_employees: '',
          notes: '',
          exemptions: ''
        })
      }
    }
  }, [isOpen, company])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      // معالجة الأرقام بشكل آمن
      const taxNumber = formData.tax_number.trim() ? (() => {
        const parsed = parseInt(formData.tax_number.trim())
        return isNaN(parsed) ? null : parsed
      })() : null
      
      // unified_number مطلوب - يجب أن يكون موجوداً وصحيحاً
      const unifiedNumber = formData.unified_number.trim() ? (() => {
        const parsed = parseInt(formData.unified_number.trim())
        if (isNaN(parsed)) {
          throw new Error('الرقم الموحد يجب أن يكون رقماً صحيحاً')
        }
        return parsed
      })() : (() => {
        // إذا كان فارغاً، نحاول استخدام القيمة الحالية من company
        if (isEditing && company?.unified_number) {
          return company.unified_number
        }
        throw new Error('الرقم الموحد مطلوب')
      })()
      
      const maxEmployees = formData.max_employees.trim() ? (() => {
        const parsed = parseInt(formData.max_employees.trim())
        return isNaN(parsed) ? null : parsed
      })() : null

      // معالجة التواريخ - التأكد من أنها بصيغة صحيحة أو null
      const formatDate = (dateStr: string | undefined): string | null => {
        if (!dateStr || !dateStr.trim()) return null
        const trimmed = dateStr.trim()
        // التحقق من أن التاريخ بصيغة YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return trimmed
        }
        // محاولة تحويل التاريخ إذا كان بصيغة أخرى
        try {
          const date = new Date(trimmed)
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        } catch {
          // ignore
        }
        return null
      }

      // labor_subscription_number مطلوب أيضاً
      const laborSubscriptionNumber = formData.labor_subscription_number.trim() || (() => {
        if (isEditing && company?.labor_subscription_number) {
          return company.labor_subscription_number
        }
        throw new Error('رقم اشتراك التأمينات مطلوب')
      })()

      const companyData: any = {
        name: formData.name.trim() || null,
        tax_number: taxNumber,
        unified_number: unifiedNumber,
        labor_subscription_number: laborSubscriptionNumber,
        commercial_registration_expiry: formatDate(formData.commercial_registration_expiry),
        insurance_subscription_expiry: formatDate(formData.insurance_subscription_expiry),
        // الحقول الجديدة
        ending_subscription_power_date: formatDate(formData.ending_subscription_power_date),
        ending_subscription_moqeem_date: formatDate(formData.ending_subscription_moqeem_date),
        max_employees: maxEmployees,
        notes: formData.notes.trim() || null,
        exemptions: formData.exemptions.trim() || null
      }

      // إزالة الحقول null فقط (وليس الحقول المطلوبة) من البيانات المرسلة
      // الحقول المطلوبة: name, unified_number, labor_subscription_number
      Object.keys(companyData).forEach(key => {
        // لا نحذف الحقول المطلوبة حتى لو كانت null
        if (key === 'name' || key === 'unified_number' || key === 'labor_subscription_number') {
          return
        }
        // نحذف الحقول الاختيارية إذا كانت null أو undefined أو ''
        if (companyData[key] === null || companyData[key] === undefined || companyData[key] === '') {
          delete companyData[key]
        }
      })

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
          await supabase.from('activity_log').insert({
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
          await supabase.from('activity_log').insert({
            action: 'إضافة مؤسسة جديدة',
            entity_type: 'company',
            details: { company_name: formData.name, created_fields: Object.keys(companyData) }
          })
        }
      }

      if (error) {
        console.error('❌ خطأ في قاعدة البيانات:', error)
        console.error('❌ تفاصيل الخطأ:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        console.error('❌ البيانات المرسلة:', companyData)
        
        // تحسين رسائل الأخطاء
        let errorMessage = `فشل ${isEditing ? 'تحديث' : 'إضافة'} المؤسسة`
        
        if (error.message?.includes('duplicate key') || error.code === '23505') {
          errorMessage = 'رقم اشتراك التأمينات أو الرقم الموحد موجود مسبقاً'
        } else if (error.message?.includes('violates') || error.code === '23502') {
          errorMessage = 'بيانات غير صحيحة أو ناقصة - يرجى التحقق من جميع الحقول المطلوبة'
        } else if (error.message?.includes('network') || error.code === 'PGRST301') {
          errorMessage = 'خطأ في الاتصال بالخادم - يرجى المحاولة مرة أخرى'
        } else if (error.message?.includes('invalid input') || error.code === '22P02') {
          errorMessage = 'صيغة البيانات غير صحيحة - يرجى التحقق من الأرقام والتواريخ'
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
      
      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('companyUpdated'))
      
      // إغلاق المودال وإعادة تحميل القائمة فقط في حالة النجاح
      try {
        onSuccess()
      } catch (error) {
        console.error('Error calling onSuccess:', error)
        // حتى لو فشل onSuccess، نغلق المودال
        onClose()
      }
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
      // لا نغلق المودال في حالة الخطأ - نترك المستخدم يرى الخطأ ويصححه
      // setLoading(false) في finally سيتولى إيقاف حالة التحميل
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

            {/* عرض حالة اشتراك قوى المحسوبة تلقائياً */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة اشتراك قوى
              </label>
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {formData.ending_subscription_power_date ? (
                  <div className={`p-2 rounded-md ${calculatePowerSubscriptionStatus(formData.ending_subscription_power_date).color.backgroundColor}`}>
                    <div className={`font-medium ${calculatePowerSubscriptionStatus(formData.ending_subscription_power_date).color.textColor}`}>
                      {calculatePowerSubscriptionStatus(formData.ending_subscription_power_date).status}
                    </div>
                    <div className={`text-sm mt-1 ${calculatePowerSubscriptionStatus(formData.ending_subscription_power_date).color.textColor}`}>
                      {calculatePowerSubscriptionStatus(formData.ending_subscription_power_date).description}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    يرجى إدخال تاريخ انتهاء اشتراك قوى أولاً
                  </div>
                )}
              </div>
            </div>

            {/* عرض حالة اشتراك مقيم المحسوبة تلقائياً */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة اشتراك مقيم
              </label>
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {formData.ending_subscription_moqeem_date ? (
                  <div className={`p-2 rounded-md ${calculateMoqeemSubscriptionStatus(formData.ending_subscription_moqeem_date).color.backgroundColor}`}>
                    <div className={`font-medium ${calculateMoqeemSubscriptionStatus(formData.ending_subscription_moqeem_date).color.textColor}`}>
                      {calculateMoqeemSubscriptionStatus(formData.ending_subscription_moqeem_date).status}
                    </div>
                    <div className={`text-sm mt-1 ${calculateMoqeemSubscriptionStatus(formData.ending_subscription_moqeem_date).color.textColor}`}>
                      {calculateMoqeemSubscriptionStatus(formData.ending_subscription_moqeem_date).description}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    يرجى إدخال تاريخ انتهاء اشتراك مقيم أولاً
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* الملاحظات */}
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
              placeholder="أدخل أي ملاحظات إضافية عن المؤسسة..."
              disabled={loading}
            />
          </div>

          {/* الاعفاءات */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الاعفاءات
            </label>
            <select
              name="exemptions"
              value={formData.exemptions}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">اختر حالة الاعفاءات</option>
              <option value="تم الاعفاء">تم الاعفاء</option>
              <option value="لم يتم الاعفاء">لم يتم الاعفاء</option>
              <option value="أخرى">أخرى</option>
            </select>
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
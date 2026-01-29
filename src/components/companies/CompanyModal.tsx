import { useState, useEffect } from 'react'
import { supabase, Company } from '@/lib/supabase'
import { X, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { 
  calculateCommercialRegistrationStatus, 
  calculateSocialInsuranceStatus,  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus
} from '@/utils/autoCompanyStatus'
import { normalizeDate } from '@/utils/dateParser'
import { logger } from '@/utils/logger'
import { validateUnifiedNumber, validateLaborSubscription } from '@/utils/companyNumberValidation'

interface CompanyModalProps {
  isOpen: boolean
  company?: Company | null
  onClose: () => void
  onSuccess: () => void
}

export default function CompanyModal({ isOpen, company, onClose, onSuccess }: CompanyModalProps) {
  const [loading, setLoading] = useState(false)
  const [originalData, setOriginalData] = useState<Partial<Company> | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    unified_number: '',
    social_insurance_number: '',
    labor_subscription_number: '',
    commercial_registration_expiry: '',
    social_insurance_expiry: '',
    ending_subscription_power_date: '',
    ending_subscription_moqeem_date: '',
    max_employees: '',
    exemptions: '',
    company_type: '',
    notes: ''
  })

  const isEditing = !!company

  useEffect(() => {
    if (isOpen) {
      if (company) {
        logger.debug('📋 تحميل بيانات المؤسسة للتعديل:', {
          id: company.id,
          name: company.name,
          hasEndingPowerDate: !!company.ending_subscription_power_date,
          hasEndingMoqeemDate: !!company.ending_subscription_moqeem_date,
          hasMaxEmployees: !!company.max_employees
        })
        
        // حفظ البيانات الأصلية للمقارنة لاحقاً
        setOriginalData(company)
        
        setFormData({
          name: company.name || '',
          unified_number: company.unified_number?.toString() || '',
          social_insurance_number: company.social_insurance_number || '',
          labor_subscription_number: company.labor_subscription_number || '',
          commercial_registration_expiry: company.commercial_registration_expiry || '',
          social_insurance_expiry: company.social_insurance_expiry || '',
          ending_subscription_power_date: company.ending_subscription_power_date || '',
          ending_subscription_moqeem_date: company.ending_subscription_moqeem_date || '',
          max_employees: company.max_employees?.toString() || '',
          exemptions: company.exemptions || '',
          company_type: company.company_type || '',
          notes: company.notes || ''
        })
      } else {
        logger.debug('🆕 إعادة تعيين النموذج للإضافة الجديدة')
        setOriginalData(null)
        
        setFormData({
          name: '',
          unified_number: '',
          social_insurance_number: '',
          labor_subscription_number: '',
          commercial_registration_expiry: '',
          social_insurance_expiry: '',
          ending_subscription_power_date: '',
          ending_subscription_moqeem_date: '',
          max_employees: '',
          exemptions: '',
          company_type: '',
          notes: ''
        })
      }
    }
  }, [isOpen, company])

  // معالجة ESC لإغلاق المودال
  useEffect(() => {
    if (!isOpen) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // التحقق من أن المستخدم لا يكتب في حقل إدخال
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const oldValue = formData[name as keyof typeof formData]
    
    // تسجيل التغييرات للمساعدة في تتبع الأخطاء
    if (oldValue !== value) {
      logger.debug(`📝 تغيير في الحقل "${name}":`, {
        from: oldValue,
        to: value
      })
    }
    
    // التحقق من صحة القيم أثناء الإدخال
    if (name === 'unified_number' || name === 'max_employees') {
      if (value && value.trim() && isNaN(parseInt(value.trim()))) {
        console.warn(`⚠️ قيمة غير صحيحة في الحقل "${name}":`, value)
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    logger.debug('🔍 بدء التحقق من صحة البيانات:', formData)
    
    // التحقق من الحقول الإجبارية
    if (!formData.name.trim()) {
      const errorMsg = 'الرجاء إدخال اسم المؤسسة (حقل إجباري)'
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

    // التحقق من صحة الرقم الموحد (يبدأ بـ 7 ويكون 10 أرقام)
    const unifiedValidation = validateUnifiedNumber(formData.unified_number.trim())
    if (!unifiedValidation.valid) {
      const errorMsg = unifiedValidation.error || 'الرقم الموحد غير صحيح'
      console.error('❌ خطأ في التحقق:', errorMsg)
      toast.error(errorMsg)
      return false
    }

    // التحقق من صحة رقم قوى إذا تم إدخاله (يجب أن يبدأ بـ 13 بصيغة 13-XXXXXXX)
    if (formData.labor_subscription_number.trim()) {
      const laborValidation = validateLaborSubscription(formData.labor_subscription_number.trim())
      if (!laborValidation.valid) {
        const errorMsg = laborValidation.error || 'رقم قوى غير صحيح'
        console.error('❌ خطأ في التحقق:', errorMsg)
        toast.error(errorMsg)
        return false
      }
    }

    // التحقق من صيغة التواريخ مع رسائل أوضح
    const dateFields = [
      { key: 'commercial_registration_expiry', name: 'انتهاء السجل التجاري' },
      { key: 'social_insurance_expiry', name: 'انتهاء التأمينات الاجتماعية' },  // تحديث: insurance_subscription_expiry → social_insurance_expiry
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
      'انتهاء التأمينات الاجتماعية': formData.social_insurance_expiry,  // تحديث: insurance_subscription_expiry → social_insurance_expiry
      'انتهاء اشتراك قوى': formData.ending_subscription_power_date,
      'انتهاء اشتراك مقيم': formData.ending_subscription_moqeem_date
    }
    
    const today = new Date()
    const invalidDates = Object.entries(allDates).filter(([, date]) => {
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

    logger.debug('✅ تم التحقق من صحة البيانات بنجاح')
    return true
  }

  const getFieldLabel = (key: string): string => {
    const fieldLabels: Record<string, string> = {
      'name': 'اسم المؤسسة',
      'unified_number': 'الرقم الموحد',
      'social_insurance_number': 'رقم التأمينات الاجتماعية',
      'labor_subscription_number': 'رقم اشتراك التأمينات',
      'commercial_registration_expiry': 'تاريخ انتهاء السجل التجاري',
      'social_insurance_expiry': 'تاريخ انتهاء التأمينات الاجتماعية',
      'ending_subscription_power_date': 'تاريخ انتهاء اشتراك قوى',
      'ending_subscription_moqeem_date': 'تاريخ انتهاء اشتراك المقيم',
      'max_employees': 'الحد الأقصى للموظفين',
      'exemptions': 'الإعفاءات',
      'company_type': 'نوع المؤسسة',
      'notes': 'الملاحظات'
    }
    return fieldLabels[key] || key
  }

  const logActivity = async (
    action: string,
    changes: Record<string, { old_value: unknown; new_value: unknown }>,
    oldDataFull: Record<string, unknown>,
    newDataFull: Record<string, unknown>,
    companyId: string,
    companyName: string,
    unifiedNumber?: number | string
  ) => {
    try {
      let actionName = action
      const changedFields = Object.keys(changes)
      
      // تحويل مفاتيح التغييرات إلى أسماء مترجمة
      const translatedChanges: Record<string, { old_value: unknown; new_value: unknown }> = {}
      changedFields.forEach(field => {
        const label = getFieldLabel(field)
        translatedChanges[label] = changes[field]
      })
      
      // إذا كان هناك حقل واحد فقط، استخدم اسمه في العملية
      if (changedFields.length === 1) {
        const fieldName = changedFields[0]
        const fieldLabel = getFieldLabel(fieldName)
        actionName = `تحديث ${fieldLabel}`
      } else if (changedFields.length > 1) {
        actionName = `تحديث متعدد (${changedFields.length} حقول)`
      }

      // حفظ البيانات القديمة والجديدة فقط للحقول المتغيرة
      const oldDataFiltered: Record<string, unknown> = {}
      const newDataFiltered: Record<string, unknown> = {}
      
      changedFields.forEach(field => {
        oldDataFiltered[field] = oldDataFull[field]
        newDataFiltered[field] = newDataFull[field]
      })

      await supabase
        .from('activity_log')
        .insert({
          entity_type: 'company',
          entity_id: companyId,
          action: actionName,
          details: {
            company_name: companyName,
            unified_number: unifiedNumber,
            changes: translatedChanges,
            timestamp: new Date().toISOString()
          },
          old_data: JSON.stringify(oldDataFiltered),
          new_data: JSON.stringify(newDataFiltered)
        })
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
      logger.debug('🚀 بدء عملية حفظ المؤسسة:', {
        isEditing,
        companyId: company?.id,
      formData
    })

    try {
      // تحضير البيانات مع معالجة محسنة للقيم الفارغة
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

      // معالجة التواريخ باستخدام normalizeDate الذي يدعم جميع الصيغ

      // labor_subscription_number مطلوب أيضاً
      const laborSubscriptionNumber = formData.labor_subscription_number.trim() || (() => {
        if (isEditing && company?.labor_subscription_number) {
          return company.labor_subscription_number
        }
        throw new Error('رقم اشتراك قوى مطلوب')
      })()

      const companyData: Record<string, unknown> = {
        name: formData.name.trim() || null,
        unified_number: unifiedNumber,
        social_insurance_number: formData.social_insurance_number.trim() || null,
        labor_subscription_number: laborSubscriptionNumber,
        commercial_registration_expiry: normalizeDate(formData.commercial_registration_expiry),
        social_insurance_expiry: normalizeDate(formData.social_insurance_expiry),
        ending_subscription_power_date: normalizeDate(formData.ending_subscription_power_date),
        ending_subscription_moqeem_date: normalizeDate(formData.ending_subscription_moqeem_date),
        max_employees: maxEmployees,
        exemptions: formData.exemptions.trim() || null,
        company_type: formData.company_type.trim() || null,
        notes: formData.notes.trim() || null
      }

      // إزالة الحقول null فقط (وليس الحقول المطلوبة) من البيانات المرسلة
      // الحقول المطلوبة: name, unified_number, labor_subscription_number
      const actualUpdateData: Record<string, unknown> = {}
      const changes: Record<string, { old_value: unknown; new_value: unknown }> = {}
      
      // فقط في حالة التعديل: تحديد الحقول المتغيرة فقط
      if (isEditing && originalData) {
        const fieldsToCheck = [
          'name', 'unified_number', 'social_insurance_number', 'labor_subscription_number',
          'commercial_registration_expiry', 'social_insurance_expiry',
          'ending_subscription_power_date', 'ending_subscription_moqeem_date',
          'max_employees', 'exemptions', 'company_type', 'notes'
        ]
        
        fieldsToCheck.forEach(field => {
          const oldValue = originalData[field as keyof typeof originalData]
          const newValue: unknown = companyData[field]
          
          // معاملة null و undefined بنفس الطريقة
          const oldVal = oldValue === null || oldValue === undefined ? null : oldValue
          const newVal = newValue === null || newValue === undefined ? null : newValue
          
          // فقط أضف إلى actualUpdateData إذا تغيرت القيمة
          if (oldVal !== newVal) {
            actualUpdateData[field] = newValue
            changes[field] = {
              old_value: oldVal,
              new_value: newVal
            }
          }
        })
      } else {
        // في حالة الإضافة الجديدة: استخدم جميع البيانات
        Object.keys(companyData).forEach(key => {
          actualUpdateData[key] = companyData[key]
        })
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

      logger.debug('📊 البيانات المحضرة للحفظ:', companyData)

      let error
      let result

      if (isEditing && company) {
        logger.debug('🔄 تحديث مؤسسة موجودة:', company.id)
        
        // إذا لم تكن هناك أي تغييرات في التعديل، لا تحفظ شيء
        if (Object.keys(actualUpdateData).length === 0) {
          toast.info('لم يتم تغيير أي بيانات')
          setLoading(false)
          return
        }
        
        result = await supabase
          .from('companies')
          .update(actualUpdateData)
          .eq('id', company.id)
        error = result.error

        if (!error) {
          logger.debug('✅ تم تحديث المؤسسة بنجاح')
          await logActivity('full_edit', changes, originalData as unknown as Record<string, unknown>, actualUpdateData, company.id, formData.name, unifiedNumber)
        }
      } else {
        logger.debug('➕ إضافة مؤسسة جديدة')
        result = await supabase
          .from('companies')
          .insert([companyData])
        error = result.error
        if (!error) {
          logger.debug('✅ تم إضافة المؤسسة بنجاح')
          // تسجيل نشاط الإضافة
          const newCompanyData = companyData as Record<string, unknown>
          const createdChanges: Record<string, { old_value: unknown; new_value: unknown }> = {}
          
          Object.keys(newCompanyData).forEach(field => {
            const label = getFieldLabel(field)
            createdChanges[label] = {
              old_value: null,
              new_value: newCompanyData[field]
            }
          })
          
          // نستخدم unified_number كمعرف المؤسسة
          const unifiedNumberValue = newCompanyData.unified_number
          await supabase.from('activity_log').insert({
            entity_type: 'company',
            action: `إضافة مؤسسة جديدة`,
            details: { 
              company_name: formData.name, 
              unified_number: unifiedNumberValue,
              created_fields: Object.keys(companyData) 
            },
            old_data: JSON.stringify({}),
            new_data: JSON.stringify(newCompanyData)
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

      logger.debug('🎉 تمت العملية بنجاح')
      
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
      
      logger.debug('📋 ملخص البيانات المحفوظة:', successInfo)
      
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
    } catch (error: unknown) {
      const errorMsg = (error instanceof Error ? error.message : String(error)) || `حدث خطأ غير متوقع أثناء ${isEditing ? 'تحديث' : 'إضافة'} المؤسسة`
      console.error('💥 خطأ في حفظ المؤسسة:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        formData,
        isEditing,
        companyId: company?.id
      })
      toast.error(errorMsg)
      // لا نغلق المودال في حالة الخطأ - نترك المستخدم يرى الخطأ ويصححه
      // setLoading(false) في finally سيتولى إيقاف حالة التحميل
    } finally {
      setLoading(false)
      logger.debug('🏁 انتهت عملية حفظ المؤسسة')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
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
            {/* اسم المؤسسة */}
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

            {/* رقم اشتراك التأمينات الاجتماعية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم اشتراك التأمينات الاجتماعية
              </label>
              <input
                type="text"
                name="social_insurance_number"
                value={formData.social_insurance_number}
                onChange={handleChange}
                placeholder="رقم اشتراك التأمينات الاجتماعية"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* رقم اشتراك قوى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم اشتراك قوى <span className="text-red-500">*</span>
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

            {/* تاريخ انتهاء التأمينات الاجتماعية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ انتهاء التأمينات الاجتماعية
              </label>
              <input
                type="date"
                name="social_insurance_expiry"
                value={formData.social_insurance_expiry}
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

            {/* عرض حالة التأمينات الاجتماعية المحسوبة تلقائياً */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة التأمينات الاجتماعية
              </label>
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {formData.social_insurance_expiry ? (
                  <div className={`p-2 rounded-md ${calculateSocialInsuranceStatus(formData.social_insurance_expiry).color.backgroundColor}`}>
                    <div className={`font-medium ${calculateSocialInsuranceStatus(formData.social_insurance_expiry).color.textColor}`}>
                      {calculateSocialInsuranceStatus(formData.social_insurance_expiry).status}
                    </div>
                    <div className={`text-sm mt-1 ${calculateSocialInsuranceStatus(formData.social_insurance_expiry).color.textColor}`}>
                      {calculateSocialInsuranceStatus(formData.social_insurance_expiry).description}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    يرجى إدخال تاريخ انتهاء التأمينات الاجتماعية أولاً
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

            {/* الاعفاءات */}
            <div>
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

            {/* نوع المؤسسة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                نوع المؤسسة
              </label>
              <input
                type="text"
                name="company_type"
                value={formData.company_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل نوع المؤسسة"
                disabled={loading}
              />
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
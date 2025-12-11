import { memo } from 'react'
import { Building2, Users, Edit2, Trash2, FileText } from 'lucide-react'
import { 
  calculateCommercialRegistrationStatus, 
  calculateSocialInsuranceStatus,  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus
} from '@/utils/autoCompanyStatus'
import { Company } from '@/lib/supabase'
import { usePermissions } from '@/utils/permissions'

interface CompanyCardProps {
  company: Company & { 
    employee_count: number
    available_slots?: number 
    max_employees?: number
  }
  onEdit: (company: Company) => void
  onDelete: (company: Company) => void
  getAvailableSlotsColor?: (slots: number) => string
  getAvailableSlotsTextColor?: (slots: number) => string
  getAvailableSlotsText?: (slots: number) => string
}

function CompanyCard({ 
  company, 
  onEdit, 
  onDelete,
  getAvailableSlotsColor,
  getAvailableSlotsTextColor,
  getAvailableSlotsText
}: CompanyCardProps) {
  // الحصول على الصلاحيات
  const { canEdit, canDelete } = usePermissions()
  
  // حساب حالات المؤسسة
  const commercialRegStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
  const socialInsuranceStatus = calculateSocialInsuranceStatus(company.social_insurance_expiry)  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus, insurance_subscription_expiry → social_insurance_expiry
  const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
  const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)

  // تحديد لون الحدود حسب أعلى أولوية (حرج > متوسط > ساري)
  const getBorderColor = () => {
    const priorities = [
      commercialRegStatus.priority,
      socialInsuranceStatus.priority,  // تحديث: insuranceStatus → socialInsuranceStatus
      powerStatus.priority,
      moqeemStatus.priority
    ]
    
    if (priorities.includes('urgent')) return 'border-red-400'
    if (priorities.includes('high')) return 'border-orange-400'
    if (priorities.includes('medium')) return 'border-yellow-400'
    if (priorities.includes('low')) return 'border-green-400'
    return 'border-gray-200'
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${getBorderColor()} p-4 hover:shadow-md transition relative`}>
      {/* مؤشر حالة الأماكن الشاغرة */}
      {(getAvailableSlotsTextColor && getAvailableSlotsText) && (
        <div 
          className={`absolute top-3 left-3 w-2.5 h-2.5 rounded-full ${getAvailableSlotsTextColor(company.available_slots || 0).replace('text-', 'bg-')}`} 
          title={getAvailableSlotsText(company.available_slots || 0)} 
        />
      )}
      
      <div className="flex items-start justify-between mb-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-600">
            <Users className="w-3.5 h-3.5 inline ml-1" />
            <span className="font-medium text-gray-700">{company.employee_count}</span>
            <span className="text-xs">/</span>
            <span className="text-xs">{company.max_employees || 4}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit('companies') && (
              <button
                onClick={() => onEdit(company)}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition"
                title="تعديل المؤسسة"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete('companies') && (
              <button
                onClick={() => onDelete(company)}
                className="p-1 text-red-600 hover:bg-red-100 rounded-md transition"
                title="حذف المؤسسة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <h3 className="text-base font-bold text-gray-900 mb-2">{company.name}</h3>
      
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-gray-600">الرقم الموحد:</span>
          <span className="font-mono text-gray-900">{company.unified_number}</span>
        </div>
        {company.social_insurance_number && (
          <div className="flex justify-between">
            <span className="text-gray-600">رقم اشتراك التأمينات الاجتماعية:</span>
            <span className="font-mono text-gray-900">{company.social_insurance_number}</span>
          </div>
        )}
        {company.labor_subscription_number && (
          <div className="flex justify-between">
            <span className="text-gray-600">رقم اشتراك قوى:</span>
            <span className="font-mono text-gray-900">{company.labor_subscription_number}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">الأماكن الشاغرة:</span>
          <div className="flex items-center gap-2">
            {getAvailableSlotsColor && getAvailableSlotsText && (
              <>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAvailableSlotsColor(company.available_slots || 0)}`}>
                  {company.available_slots || 0} / {company.max_employees || 4}
                </span>
                {(company.available_slots || 0) > 0 && (
                  <span className={`text-xs font-medium ${getAvailableSlotsTextColor?.(company.available_slots || 0) || ''}`}>
                    {getAvailableSlotsText(company.available_slots || 0)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {company.exemptions && (
          <div className="flex justify-between">
            <span className="text-gray-600">الاعفاءات:</span>
            <span className="font-medium text-gray-900">{company.exemptions}</span>
          </div>
        )}
        {company.company_type && (
          <div className="flex justify-between">
            <span className="text-gray-600">نوع المؤسسة:</span>
            <span className="font-medium text-gray-900">{company.company_type}</span>
          </div>
        )}
      </div>

      {/* مربعات الحالات - grid من عمودين */}
      <div className="pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          {/* حالة السجل التجاري */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">حالة السجل التجاري</div>
            {company.commercial_registration_expiry ? (
              <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${commercialRegStatus.color.backgroundColor} ${commercialRegStatus.color.textColor} ${commercialRegStatus.color.borderColor}`}>
                <div className="flex items-center gap-1">
                  <div className="text-sm">{commercialRegStatus.status === 'طارئ' ? '🚨' : commercialRegStatus.status === 'عاجل' ? '🔥' : commercialRegStatus.status === 'متوسط' ? '⚠️' : commercialRegStatus.status === 'ساري' ? '✅' : '❌'}</div>
                  <div className="flex flex-col">
                    <span className="font-bold">{commercialRegStatus.status}</span>
                    <span className="text-xs opacity-75">{commercialRegStatus.description}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                غير محدد
              </div>
            )}
          </div>

          {/* حالة التأمينات الاجتماعية */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">حالة التأمينات الاجتماعية</div>
            {company.social_insurance_expiry ? (
              <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${socialInsuranceStatus.color.backgroundColor} ${socialInsuranceStatus.color.textColor} ${socialInsuranceStatus.color.borderColor}`}>
                <div className="flex items-center gap-1">
                  <div className="text-sm">{socialInsuranceStatus.status === 'طارئ' ? '🚨' : socialInsuranceStatus.status === 'عاجل' ? '🔥' : socialInsuranceStatus.status === 'متوسط' ? '⚠️' : socialInsuranceStatus.status === 'ساري' ? '✅' : '❌'}</div>
                  <div className="flex flex-col">
                    <span className="font-bold">{socialInsuranceStatus.status}</span>
                    <span className="text-xs opacity-75">{socialInsuranceStatus.description}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                غير محدد
              </div>
            )}
          </div>

          {/* حالة اشتراك قوى */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">حالة اشتراك قوى</div>
            {company.ending_subscription_power_date ? (
              <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${powerStatus.color.backgroundColor} ${powerStatus.color.textColor} ${powerStatus.color.borderColor}`}>
                <div className="flex items-center gap-1">
                  <div className="text-sm">{powerStatus.status === 'طارئ' ? '🚨' : powerStatus.status === 'عاجل' ? '🔥' : powerStatus.status === 'متوسط' ? '⚠️' : powerStatus.status === 'ساري' ? '✅' : '❌'}</div>
                  <div className="flex flex-col">
                    <span className="font-bold">{powerStatus.status}</span>
                    <span className="text-xs opacity-75">{powerStatus.description}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                غير محدد
              </div>
            )}
          </div>

          {/* حالة اشتراك مقيم */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">حالة اشتراك مقيم</div>
            {company.ending_subscription_moqeem_date ? (
              <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${moqeemStatus.color.backgroundColor} ${moqeemStatus.color.textColor} ${moqeemStatus.color.borderColor}`}>
                <div className="flex items-center gap-1">
                  <div className="text-sm">{moqeemStatus.status === 'طارئ' ? '🚨' : moqeemStatus.status === 'عاجل' ? '🔥' : moqeemStatus.status === 'متوسط' ? '⚠️' : moqeemStatus.status === 'ساري' ? '✅' : '❌'}</div>
                  <div className="flex flex-col">
                    <span className="font-bold">{moqeemStatus.status}</span>
                    <span className="text-xs opacity-75">{moqeemStatus.description}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                غير محدد
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الملاحظات */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          الملاحظات
        </div>
        <div className="px-3 py-2 rounded-lg text-xs bg-gray-50 text-gray-700 border border-gray-200 whitespace-pre-wrap min-h-[50px]">
          {company.notes || 'لا توجد ملاحظات'}
        </div>
      </div>
    </div>
  )
}

export default memo(CompanyCard, (prevProps, nextProps) => {
  // Custom comparison function - مقارنة الحقول المهمة فقط
  return (
    prevProps.company.id === nextProps.company.id &&
    prevProps.company.employee_count === nextProps.company.employee_count &&
    prevProps.company.available_slots === nextProps.company.available_slots &&
    prevProps.company.commercial_registration_expiry === nextProps.company.commercial_registration_expiry &&
    prevProps.company.social_insurance_expiry === nextProps.company.social_insurance_expiry &&
    prevProps.company.ending_subscription_power_date === nextProps.company.ending_subscription_power_date &&
    prevProps.company.ending_subscription_moqeem_date === nextProps.company.ending_subscription_moqeem_date &&
    prevProps.company.notes === nextProps.company.notes
  )
})
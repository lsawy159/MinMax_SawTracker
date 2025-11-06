import { Building2, Users, Edit2, Trash2 } from 'lucide-react'
import { 
  calculateCommercialRegistrationStatus, 
  calculateInsuranceSubscriptionStatus
} from '../../utils/autoCompanyStatus'
import { Company } from '../../lib/supabase'

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
  getAvailableSlotsText?: (slots: number, maxEmployees: number) => string
}

export default function CompanyCard({ 
  company, 
  onEdit, 
  onDelete,
  getAvailableSlotsColor,
  getAvailableSlotsTextColor,
  getAvailableSlotsText
}: CompanyCardProps) {
  // حساب حالات المؤسسة
  const commercialRegStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
  const insuranceStatus = calculateInsuranceSubscriptionStatus(company.insurance_subscription_expiry)

  // تحديد لون الحدود حسب حالة السجل التجاري
  const getBorderColor = () => {
    if (commercialRegStatus.priority === 'critical') return 'border-red-400'
    if (commercialRegStatus.priority === 'medium') return 'border-yellow-400'
    if (commercialRegStatus.priority === 'low') return 'border-green-400'
    return 'border-gray-200'
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${getBorderColor()} p-6 hover:shadow-md transition relative`}>
      {/* مؤشر حالة الأماكن الشاغرة */}
      {(getAvailableSlotsTextColor && getAvailableSlotsText) && (
        <div 
          className={`absolute top-4 left-4 w-3 h-3 rounded-full ${getAvailableSlotsTextColor(company.available_slots || 0).replace('text-', 'bg-')}`} 
          title={getAvailableSlotsText(company.available_slots || 0, company.max_employees || 4)} 
        />
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            <Users className="w-4 h-4 inline ml-1" />
            <span className="font-medium text-gray-700">{company.employee_count}</span>
            <span className="text-xs">/</span>
            <span className="text-xs">{company.max_employees || 4}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(company)}
              className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition"
              title="تعديل المؤسسة"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(company)}
              className="p-1 text-red-600 hover:bg-red-100 rounded-md transition"
              title="حذف المؤسسة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 mb-3">{company.name}</h3>
      
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">الرقم الموحد:</span>
          <span className="font-mono text-gray-900">{company.unified_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">رقم اشتراك التأمينات:</span>
          <span className="font-mono text-gray-900">{company.tax_number}</span>
        </div>
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
                    {getAvailableSlotsText(company.available_slots || 0, company.max_employees || 4)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {(company.company_type || company.additional_fields?.company_type) && (
          <div className="flex justify-between">
            <span className="text-gray-600">نوع المؤسسة:</span>
            <span className="text-gray-900">{company.company_type || company.additional_fields?.company_type}</span>
          </div>
        )}
      </div>

      {/* حالة السجل التجاري - مربع توضيحي ملون */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-2">حالة السجل التجاري</div>
        {company.commercial_registration_expiry ? (
          <>
            <div className={`px-4 py-3 rounded-lg text-sm font-medium border-2 ${commercialRegStatus.color.backgroundColor} ${commercialRegStatus.color.textColor} ${commercialRegStatus.color.borderColor}`}>
              <div className="flex items-center gap-2">
                <div className="text-lg">{commercialRegStatus.status === 'حرج' ? '🚨' : commercialRegStatus.status === 'متوسط' ? '⚠️' : commercialRegStatus.status === 'ساري' ? '✅' : '❌'}</div>
                <div className="flex flex-col">
                  <span className="font-bold">{commercialRegStatus.status}</span>
                  <span className="text-xs opacity-75">{commercialRegStatus.description}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
            غير محدد
          </div>
        )}
      </div>

      {/* حالة اشتراك التأمينات - مربع توضيحي ملون */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-2">حالة اشتراك التأمينات</div>
        {company.insurance_subscription_expiry ? (
          <>
            <div className={`px-4 py-3 rounded-lg text-sm font-medium border-2 ${insuranceStatus.color.backgroundColor} ${insuranceStatus.color.textColor} ${insuranceStatus.color.borderColor}`}>
              <div className="flex items-center gap-2">
                <div className="text-lg">{insuranceStatus.status === 'حرج' ? '🚨' : insuranceStatus.status === 'متوسط' ? '⚠️' : insuranceStatus.status === 'ساري' ? '✅' : '❌'}</div>
                <div className="flex flex-col">
                  <span className="font-bold">{insuranceStatus.status}</span>
                  <span className="text-xs opacity-75">{insuranceStatus.description}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
            غير محدد
          </div>
        )}
      </div>
    </div>
  )
}
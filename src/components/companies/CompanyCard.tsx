import { memo } from 'react'
import { Building2, Users, Edit2, Trash2, FileText } from 'lucide-react'
import {
  calculateCommercialRegistrationStatus,
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus,
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
  getAvailableSlotsText,
}: CompanyCardProps) {
  // الحصول على الصلاحيات
  const { canEdit, canDelete } = usePermissions()

  // حساب حالات المؤسسة
  const commercialRegStatus = calculateCommercialRegistrationStatus(
    company.commercial_registration_expiry
  )
  const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
  const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)

  const formatDaysText = (days: number) => {
    if (days < 0) return `${Math.abs(days)} يوم منذ الانتهاء`
    if (days === 0) return 'اليوم'
    return `${days} يوم`
  }

  // تحديد لون الحدود حسب أعلى أولوية (طارئ > عاجل > متوسط > ساري)
  const getBorderColor = () => {
    const priorities = [commercialRegStatus.priority, powerStatus.priority, moqeemStatus.priority]

    if (priorities.includes('urgent')) return 'border-red-400'
    if (priorities.includes('high')) return 'border-orange-400'
    if (priorities.includes('medium')) return 'border-yellow-400'
    if (priorities.includes('low')) return 'border-green-400'
    return 'border-neutral-200'
  }

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-2xl border-2 ${getBorderColor()} bg-white/95 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(14,116,144,0.65)] md:p-5`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-sky-300/60 to-emerald-300/70 opacity-70 transition group-hover:opacity-100" />

      {/* مؤشر حالة الأماكن الشاغرة */}
      {getAvailableSlotsTextColor && getAvailableSlotsText && (
        <div
          className={`absolute left-3 top-3 h-2.5 w-2.5 rounded-full ${getAvailableSlotsTextColor(company.available_slots || 0).replace('text-', 'bg-')}`}
          title={getAvailableSlotsText(company.available_slots || 0)}
        />
      )}

      <div className="mb-3 flex items-start justify-between">
        <div className="app-icon-chip scale-90">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-600">
            <Users className="w-3.5 h-3.5 inline ml-1" />
            <span className="font-medium text-neutral-700">{company.employee_count}</span>
            <span className="text-xs">/</span>
            <span className="text-xs">{company.max_employees || 4}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit('companies') && (
              <button
                onClick={() => onEdit(company)}
                className="rounded-lg p-1 text-slate-700 transition hover:bg-primary/10"
                title="تعديل المؤسسة"
                data-testid={`edit-company-btn-${company.id}`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete('companies') && (
              <button
                onClick={() => onDelete(company)}
                className="p-1 text-red-600 hover:bg-red-100 rounded-md transition"
                title="حذف المؤسسة"
                data-testid={`delete-company-btn-${company.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="mb-2 line-clamp-1 text-lg font-bold text-slate-900">{company.name}</h3>

      <div className="app-card-meta text-[12.5px]">
        <div className="app-card-meta-row">
          <span className="app-card-meta-label">الرقم الموحد:</span>
          <span className="app-card-meta-value font-mono [direction:ltr] text-left">
            {company.unified_number}
          </span>
        </div>
        {company.social_insurance_number && (
          <div className="app-card-meta-row">
            <span className="app-card-meta-label">رقم اشتراك التأمينات الاجتماعية:</span>
            <span className="app-card-meta-value font-mono [direction:ltr] text-left">
              {company.social_insurance_number}
            </span>
          </div>
        )}
        {company.labor_subscription_number && (
          <div className="app-card-meta-row">
            <span className="app-card-meta-label">رقم اشتراك قوى:</span>
            <span className="app-card-meta-value font-mono [direction:ltr] text-left">
              {company.labor_subscription_number}
            </span>
          </div>
        )}
        <div className="app-card-meta-row">
          <span className="app-card-meta-label">الأماكن الشاغرة:</span>
          <div className="flex items-center gap-2">
            {getAvailableSlotsColor && getAvailableSlotsText && (
              <>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${getAvailableSlotsColor(company.available_slots || 0)}`}
                >
                  {company.available_slots || 0} / {company.max_employees || 4}
                </span>
                {(company.available_slots || 0) > 0 && (
                  <span
                    className={`text-xs font-medium ${getAvailableSlotsTextColor?.(company.available_slots || 0) || ''}`}
                  >
                    {getAvailableSlotsText(company.available_slots || 0)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {company.exemptions && (
          <div className="app-card-meta-row">
            <span className="app-card-meta-label">الاعفاءات:</span>
            <span className="app-card-meta-value">{company.exemptions}</span>
          </div>
        )}
        {company.company_type && (
          <div className="app-card-meta-row">
            <span className="app-card-meta-label">نوع المؤسسة:</span>
            <span className="app-card-meta-value">{company.company_type}</span>
          </div>
        )}
      </div>

      {/* مربعات الحالات - grid من عمودين */}
      <div className="border-t border-neutral-200 pt-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {/* حالة السجل التجاري */}
          <div>
            <div className="mb-1 text-[12px] font-semibold text-neutral-600">
              حالة السجل التجاري
            </div>
            {company.commercial_registration_expiry ? (
              <div
                className={`min-h-[74px] rounded-lg border-2 px-2 py-1 text-xs font-medium ${commercialRegStatus.color.backgroundColor} ${commercialRegStatus.color.textColor} ${commercialRegStatus.color.borderColor}`}
              >
                <div className="flex items-center gap-1">
                  <div className="text-xs">
                    {commercialRegStatus.status === 'طارئ'
                      ? '🚨'
                      : commercialRegStatus.status === 'عاجل'
                        ? '🔥'
                        : commercialRegStatus.status === 'متوسط'
                          ? '⚠️'
                          : commercialRegStatus.status === 'ساري'
                            ? '✅'
                            : '❌'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold">{commercialRegStatus.status}</span>
                    <span className="text-xs opacity-75">
                      {formatDaysText(commercialRegStatus.daysRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                غير محدد
              </div>
            )}
          </div>

          {/* حالة اشتراك قوى */}
          <div>
            <div className="mb-1 text-[12px] font-semibold text-neutral-600">حالة اشتراك قوى</div>
            {company.ending_subscription_power_date ? (
              <div
                className={`min-h-[74px] rounded-lg border-2 px-2 py-1 text-xs font-medium ${powerStatus.color.backgroundColor} ${powerStatus.color.textColor} ${powerStatus.color.borderColor}`}
              >
                <div className="flex items-center gap-1">
                  <div className="text-xs">
                    {powerStatus.status === 'طارئ'
                      ? '🚨'
                      : powerStatus.status === 'عاجل'
                        ? '🔥'
                        : powerStatus.status === 'متوسط'
                          ? '⚠️'
                          : powerStatus.status === 'ساري'
                            ? '✅'
                            : '❌'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold">{powerStatus.status}</span>
                    <span className="text-xs opacity-75">
                      {formatDaysText(powerStatus.daysRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                غير محدد
              </div>
            )}
          </div>

          {/* حالة اشتراك مقيم */}
          <div>
            <div className="mb-1 text-[12px] font-semibold text-neutral-600">حالة اشتراك مقيم</div>
            {company.ending_subscription_moqeem_date ? (
              <div
                className={`min-h-[74px] rounded-lg border-2 px-2 py-1 text-xs font-medium ${moqeemStatus.color.backgroundColor} ${moqeemStatus.color.textColor} ${moqeemStatus.color.borderColor}`}
              >
                <div className="flex items-center gap-1">
                  <div className="text-xs">
                    {moqeemStatus.status === 'طارئ'
                      ? '🚨'
                      : moqeemStatus.status === 'عاجل'
                        ? '🔥'
                        : moqeemStatus.status === 'متوسط'
                          ? '⚠️'
                          : moqeemStatus.status === 'ساري'
                            ? '✅'
                            : '❌'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold">{moqeemStatus.status}</span>
                    <span className="text-xs opacity-75">
                      {formatDaysText(moqeemStatus.daysRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                غير محدد
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الملاحظات */}
      <div className="border-t border-border pt-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-600">
          <FileText className="w-3.5 h-3.5" />
          الملاحظات
        </div>
        <div className="min-h-[42px] whitespace-pre-wrap rounded-xl border border-border bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
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
    prevProps.company.commercial_registration_expiry ===
      nextProps.company.commercial_registration_expiry &&
    prevProps.company.ending_subscription_power_date ===
      nextProps.company.ending_subscription_power_date &&
    prevProps.company.ending_subscription_moqeem_date ===
      nextProps.company.ending_subscription_moqeem_date &&
    prevProps.company.notes === nextProps.company.notes
  )
})

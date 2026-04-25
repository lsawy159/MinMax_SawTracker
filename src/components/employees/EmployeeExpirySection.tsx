import { Employee, Company } from '@/lib/supabase'
import { ExpiryStatusRow } from './ExpiryStatusRow'
import { calculateDaysRemaining } from '@/utils/statusHelpers'

interface EmployeeExpirySectionProps {
  employee: Employee & { company: Company }
}

export function EmployeeExpirySection({ employee }: EmployeeExpirySectionProps) {
  const residenceDays = calculateDaysRemaining(employee?.residence_expiry)
  const contractDays = calculateDaysRemaining(employee?.contract_expiry)
  const hiredWorkerContractDays = calculateDaysRemaining(employee?.hired_worker_contract_expiry)
  const healthInsuranceDays = calculateDaysRemaining(employee?.health_insurance_expiry)

  return (
    <div className="p-6 space-y-3 bg-neutral-50">
      <ExpiryStatusRow
        label="انتهاء الإقامة"
        date={employee?.residence_expiry}
        daysRemaining={residenceDays}
      />

      {contractDays !== null && (
        <ExpiryStatusRow
          label="انتهاء العقد"
          date={employee?.contract_expiry}
          daysRemaining={contractDays}
        />
      )}

      {hiredWorkerContractDays !== null && (
        <ExpiryStatusRow
          label="انتهاء عقد أجير"
          date={employee?.hired_worker_contract_expiry}
          daysRemaining={hiredWorkerContractDays}
        />
      )}

      <ExpiryStatusRow
        label="انتهاء التأمين الصحي"
        date={employee?.health_insurance_expiry}
        daysRemaining={healthInsuranceDays}
      />
    </div>
  )
}

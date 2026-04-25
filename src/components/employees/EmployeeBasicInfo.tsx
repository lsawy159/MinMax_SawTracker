import { Employee, Company } from '@/lib/supabase'
import { Edit2 } from 'lucide-react'

interface EmployeeBasicInfoProps {
  employee: Employee & { company: Company }
  isEditMode: boolean
  onEditToggle: () => void
}

export function EmployeeBasicInfo({
  employee,
  isEditMode,
  onEditToggle,
}: EmployeeBasicInfoProps) {
  return (
    <div className={`sticky top-0 z-30 flex items-center justify-between border-b border-white/10 p-6 text-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.7)] ${
      isEditMode
        ? 'bg-gradient-to-l from-amber-600 to-orange-500'
        : 'bg-gradient-to-l from-slate-950 via-slate-900 to-slate-800'
    }`}>
      <div>
        <h2 className="text-2xl font-bold">{employee.name}</h2>
        <p className={`mt-1 ${isEditMode ? 'text-orange-100' : 'text-slate-300'}`}>
          {employee.profession} - {employee?.company?.name ?? 'غير محدد'}
        </p>
      </div>
      <button
        onClick={onEditToggle}
        className="p-2 hover:bg-white/10 rounded-lg transition"
        title={isEditMode ? 'إنهاء التعديل' : 'تحرير'}
      >
        <Edit2 className="w-5 h-5" />
      </button>
    </div>
  )
}

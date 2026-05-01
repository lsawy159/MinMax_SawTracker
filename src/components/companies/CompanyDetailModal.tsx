import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Users, Eye, ArrowLeft, Building2 } from 'lucide-react'
import { supabase, Company, Employee, EmployeeWithRelations } from '@/lib/supabase'
import CompanyCard from './CompanyCard'
import EmployeeCard from '@/components/employees/EmployeeCard'
import { toast } from 'sonner'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'

interface CompanyDetailModalProps {
  company: Company & {
    employee_count?: number
    available_slots?: number
    max_employees?: number
  }
  onClose: () => void
  onEdit?: (company: Company) => void
  onDelete?: (company: Company) => void
  getAvailableSlotsColor?: (slots: number) => string
  getAvailableSlotsTextColor?: (slots: number) => string
  getAvailableSlotsText?: (slots: number) => string
}

export default function CompanyDetailModal({
  company,
  onClose,
  onEdit,
  onDelete,
  getAvailableSlotsColor,
  getAvailableSlotsTextColor,
  getAvailableSlotsText,
}: CompanyDetailModalProps) {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithRelations | null>(null)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)

  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true)
      const { data, error } = await supabase
        .from('employees')
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,project_id,project_name,bank_account,residence_image_url,health_insurance_expiry,salary,notes,additional_fields,is_deleted,deleted_at,created_at,updated_at, company:companies(id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at), project:projects(id,name,description,status,created_at,updated_at)'
        )
        .eq('company_id', company.id)
        .order('name')

      if (error) throw error
      setEmployees((data || []) as unknown as EmployeeWithRelations[])
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('فشل تحميل الموظفين')
    } finally {
      setLoadingEmployees(false)
    }
  }, [company.id])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const handleCloseEmployeeCard = useCallback(() => {
    setShowEmployeeCard(false)
    setSelectedEmployee(null)
  }, [])

  // معالجة ESC لإغلاق المودال
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // التحقق من أن المستخدم لا يكتب في حقل إدخال
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        // إذا كان هناك employee card مفتوح، أغلقه أولاً
        if (showEmployeeCard) {
          handleCloseEmployeeCard()
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showEmployeeCard, handleCloseEmployeeCard])

  const handleEmployeeClick = async (
    employee: EmployeeWithRelations
  ) => {
    // تأكد من أن employee يحتوي على company
    if (!employee.company) {
      // إذا لم يكن company موجوداً، حمله
      const { data: companyData } = await supabase
        .from('companies')
        .select(
          'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at'
        )
        .eq('id', employee.company_id)
        .single()

      if (companyData) {
        employee.company = companyData as Company
      }
    }

    setSelectedEmployee(employee)
    setShowEmployeeCard(true)
  }

  const handleEmployeeUpdate = () => {
    loadEmployees()
    handleCloseEmployeeCard()
  }

  const handleViewAllEmployees = () => {
    navigate(`/employees?company=${company.id}`)
    onClose()
  }

  // إذا كان هناك employee card مفتوح، اعرضه
  if (showEmployeeCard && selectedEmployee) {
    return (
      <EmployeeCard
        employee={selectedEmployee as unknown as Employee & { company: Company }}
        onClose={handleCloseEmployeeCard}
        onUpdate={handleEmployeeUpdate}
      />
    )
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/55 flex items-center justify-center p-4 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="app-modal-surface max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">تفاصيل المؤسسة</h2>
              <p className="text-sm text-neutral-500">{company.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition">
            <X className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Company Details */}
          <div className="mb-6">
            <div onClick={(e) => e.stopPropagation()}>
              <CompanyCard
                company={{
                  ...company,
                  employee_count: company.employee_count || employees.length,
                  available_slots: company.available_slots,
                  max_employees: company.max_employees || 4,
                }}
                onEdit={onEdit || (() => {})}
                onDelete={onDelete || (() => {})}
                getAvailableSlotsColor={getAvailableSlotsColor}
                getAvailableSlotsTextColor={getAvailableSlotsTextColor}
                getAvailableSlotsText={getAvailableSlotsText}
              />
            </div>
          </div>

          {/* Employees Section */}
          <div className="border-t border-neutral-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-neutral-600" />
                <h3 className="text-lg font-bold text-neutral-900">الموظفين</h3>
                <span className="text-sm text-neutral-500">({employees.length})</span>
              </div>
              {employees.length > 0 && (
                <button onClick={handleViewAllEmployees} className="app-button-primary text-sm">
                  <ArrowLeft className="w-4 h-4" />
                  عرض جميع الموظفين
                </button>
              )}
            </div>

            {loadingEmployees ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
                <Users className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p className="text-neutral-600 font-medium">لا يوجد موظفين في هذه المؤسسة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => handleEmployeeClick(employee)}
                    className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-neutral-900 mb-1">{employee.name}</h4>
                        {employee.profession && (
                          <p className="text-sm text-neutral-600 mb-1">{employee.profession}</p>
                        )}
                        {employee.nationality && (
                          <p className="text-sm text-neutral-500">{employee.nationality}</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-1" />
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1">
                      {employee.residence_number && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">رقم الإقامة:</span>
                          <span className="text-neutral-700 font-mono">
                            {employee.residence_number}
                          </span>
                        </div>
                      )}
                      {employee.contract_expiry && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">انتهاء العقد:</span>
                          <span className="text-neutral-700">
                            {formatDateShortWithHijri(employee.contract_expiry)}
                          </span>
                        </div>
                      )}
                      {employee.residence_expiry && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">انتهاء الإقامة:</span>
                          <span className="text-neutral-700">
                            {formatDateShortWithHijri(employee.residence_expiry)}
                          </span>
                        </div>
                      )}
                      {employee.project?.name || employee.project_name ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">المشروع:</span>
                          <span className="text-blue-600 font-medium">
                            {employee.project?.name || employee.project_name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

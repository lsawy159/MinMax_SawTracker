import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase, Project, Employee, Company } from '@/lib/supabase'
import { X, FolderKanban, Users, DollarSign, Eye, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import EmployeeCard from '@/components/employees/EmployeeCard'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'

interface ProjectDetailModalProps {
  project: Project & {
    employee_count?: number
    total_salaries?: number
  }
  onClose: () => void
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export default function ProjectDetailModal({
  project,
  onClose,
  onEdit,
  onDelete,
}: ProjectDetailModalProps) {
  const [employees, setEmployees] = useState<
    (Employee & { company: Company; project?: Project })[]
  >([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<
    (Employee & { company: Company; project?: Project }) | null
  >(null)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)

  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true)
      const { data, error } = await supabase
        .from('employees')
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,project_id,project_name,bank_account,residence_image_url,health_insurance_expiry,salary,notes,additional_fields,is_deleted,deleted_at,created_at,updated_at, company:companies(id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at), project:projects(id,name,description,status,created_at,updated_at)'
        )
        .eq('project_id', project.id)
        .order('name')

      if (error) throw error
      setEmployees(
        (data || []) as unknown as (Employee & { company: Company; project?: Project })[]
      )
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('فشل تحميل الموظفين')
    } finally {
      setLoadingEmployees(false)
    }
  }, [project.id])

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
    employee: Employee & { company: Company; project?: Project }
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
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-success-800 border-green-200'
      case 'inactive':
        return 'bg-neutral-100 text-neutral-800 border-neutral-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'نشط'
      case 'inactive':
        return 'متوقف'
      case 'completed':
        return 'مكتمل'
      default:
        return status
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="app-modal-surface max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
          {/* Header */}
          <div className="app-modal-header flex justify-between items-center p-6">
            <div className="flex items-center gap-4">
              <div className="app-icon-chip">
                <FolderKanban className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{project.name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status || 'active')}`}
                  >
                    {getStatusText(project.status || 'active')}
                  </span>
                  <span className="text-blue-100 text-sm">{project.employee_count || 0} موظف</span>
                  {project.total_salaries !== undefined && (
                    <span className="text-blue-100 text-sm">
                      {project.total_salaries.toLocaleString('ar-SA')} ريال
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(project)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                title="تعديل المشروع"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(project)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                title="حذف المشروع"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Project Info */}
          <div className="p-6 border-b border-neutral-200">
            {project.description && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-2">الوصف</h3>
                <p className="text-neutral-600">{project.description}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-neutral-700">عدد الموظفين</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900">{project.employee_count || 0}</p>
              </div>
              {project.total_salaries !== undefined && (
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-success-600" />
                    <span className="text-sm font-medium text-neutral-700">إجمالي الرواتب</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {project.total_salaries.toLocaleString('ar-SA')} ريال
                  </p>
                </div>
              )}
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FolderKanban className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-neutral-700">الحالة</span>
                </div>
                <p className="text-lg font-bold text-neutral-900">
                  {getStatusText(project.status || 'active')}
                </p>
              </div>
            </div>
          </div>

          {/* Employees List */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              الموظفين في المشروع ({employees.length})
            </h3>

            {loadingEmployees ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
                <Users className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p className="text-neutral-600 font-medium">لا يوجد موظفين في هذا المشروع</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => handleEmployeeClick(employee)}
                    className="rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:border-primary/40 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-neutral-900 mb-1">{employee.name}</h4>
                        {employee.profession && (
                          <p className="text-sm text-neutral-600 mb-1">{employee.profession}</p>
                        )}
                        {employee.nationality && (
                          <p className="text-xs text-neutral-500">{employee.nationality}</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-1" />
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1">
                      {employee.residence_number && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">رقم الإقامة:</span>
                          <span className="font-mono text-neutral-700">
                            {employee.residence_number}
                          </span>
                        </div>
                      )}
                      {employee.company && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">المؤسسة:</span>
                          <span className="text-neutral-700">{employee.company.name}</span>
                        </div>
                      )}
                      {employee.salary && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">الراتب:</span>
                          <span className="font-medium text-neutral-700">
                            {employee.salary.toLocaleString('ar-SA')} ريال
                          </span>
                        </div>
                      )}
                      {employee.joining_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-500">تاريخ الالتحاق:</span>
                          <span className="text-neutral-700">
                            <HijriDateDisplay date={employee.joining_date}>
                              {formatDateShortWithHijri(employee.joining_date)}
                            </HijriDateDisplay>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* كارت الموظف المنبثق */}
      {showEmployeeCard && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseEmployeeCard}
          onUpdate={handleEmployeeUpdate}
        />
      )}
    </>
  )
}

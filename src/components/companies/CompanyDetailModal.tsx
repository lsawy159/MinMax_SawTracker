import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Users, Eye, ArrowLeft, Building2 } from 'lucide-react'
import { supabase, Company, Employee, Project } from '@/lib/supabase'
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
  getAvailableSlotsText?: (slots: number, maxEmployees: number) => string
}

export default function CompanyDetailModal({
  company,
  onClose,
  onEdit,
  onDelete,
  getAvailableSlotsColor,
  getAvailableSlotsTextColor,
  getAvailableSlotsText
}: CompanyDetailModalProps) {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<(Employee & { company: Company; project?: Project })[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company; project?: Project }) | null>(null)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)

  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*), project:projects(*)')
        .eq('company_id', company.id)
        .order('name')

      if (error) throw error
      setEmployees(data || [])
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

  const handleEmployeeClick = async (employee: Employee & { company: Company; project?: Project }) => {
    // تأكد من أن employee يحتوي على company
    if (!employee.company) {
      // إذا لم يكن company موجوداً، حمله
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
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
        employee={selectedEmployee}
        onClose={handleCloseEmployeeCard}
        onUpdate={handleEmployeeUpdate}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">تفاصيل المؤسسة</h2>
              <p className="text-sm text-gray-500">{company.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-500" />
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
                  max_employees: company.max_employees || 4
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
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-bold text-gray-900">الموظفين</h3>
                <span className="text-sm text-gray-500">({employees.length})</span>
              </div>
              {employees.length > 0 && (
                <button
                  onClick={handleViewAllEmployees}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
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
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-600 font-medium">لا يوجد موظفين في هذه المؤسسة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => handleEmployeeClick(employee)}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">{employee.name}</h4>
                        {employee.profession && (
                          <p className="text-sm text-gray-600 mb-1">{employee.profession}</p>
                        )}
                        {employee.nationality && (
                          <p className="text-xs text-gray-500">{employee.nationality}</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {employee.residence_number && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">رقم الإقامة:</span>
                          <span className="text-gray-700 font-mono">{employee.residence_number}</span>
                        </div>
                      )}
                      {employee.contract_expiry && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">انتهاء العقد:</span>
                          <span className="text-gray-700">{formatDateShortWithHijri(employee.contract_expiry)}</span>
                        </div>
                      )}
                      {employee.residence_expiry && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">انتهاء الإقامة:</span>
                          <span className="text-gray-700">{formatDateShortWithHijri(employee.residence_expiry)}</span>
                        </div>
                      )}
                      {employee.project?.name || employee.project_name ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">المشروع:</span>
                          <span className="text-blue-600 font-medium">{employee.project?.name || employee.project_name}</span>
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
}


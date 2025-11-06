import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import EmployeeCard from '../components/employee/EmployeeCard'
import { Search, Calendar, AlertCircle, X, Filter } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'

export default function Employees() {
  const [employees, setEmployees] = useState<(Employee & { company: Company })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [nationalityFilter, setNationalityFilter] = useState<string>('')
  const [professionFilter, setProfessionFilter] = useState<string>('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  
  const [companies, setCompanies] = useState<string[]>([])
  const [nationalities, setNationalities] = useState<string[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  
  // حالة المودال
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company }) | null>(null)
  const [isCardOpen, setIsCardOpen] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*)')
        .order('name')

      if (error) throw error
      
      const employeesData = data || []
      setEmployees(employeesData)
      
      // استخراج القوائم الفريدة للفلاتر
      const uniqueCompanies = [...new Set(employeesData.map(e => e.company?.name).filter(Boolean))] as string[]
      const uniqueNationalities = [...new Set(employeesData.map(e => e.nationality).filter(Boolean))] as string[]
      const uniqueProfessions = [...new Set(employeesData.map(e => e.profession).filter(Boolean))] as string[]
      const uniqueProjects = [...new Set(employeesData.map(e => e.project_name).filter(Boolean))] as string[]
      
      setCompanies(uniqueCompanies.sort())
      setNationalities(uniqueNationalities.sort())
      setProfessions(uniqueProfessions.sort())
      setProjects(uniqueProjects.sort())
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (date: string) => {
    return differenceInDays(new Date(date), new Date())
  }

  const getStatusColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= 30) return 'text-orange-600 bg-orange-50'
    if (days <= 90) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setCompanyFilter('')
    setNationalityFilter('')
    setProfessionFilter('')
    setProjectFilter('')
  }

  const handleEmployeeClick = (employee: Employee & { company: Company }) => {
    setSelectedEmployee(employee)
    setIsCardOpen(true)
  }

  const handleCloseCard = () => {
    setIsCardOpen(false)
    setSelectedEmployee(null)
  }

  const handleUpdateEmployee = async () => {
    // إعادة تحميل قائمة الموظفين بعد التحديث
    await loadEmployees()
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCompany = !companyFilter || emp.company?.name === companyFilter
    const matchesNationality = !nationalityFilter || emp.nationality === nationalityFilter
    const matchesProfession = !professionFilter || emp.profession === professionFilter
    const matchesProject = !projectFilter || emp.project_name === projectFilter
    
    return matchesSearch && matchesCompany && matchesNationality && matchesProfession && matchesProject
  })

  const hasActiveFilters = searchTerm || companyFilter || nationalityFilter || professionFilter || projectFilter

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">إدارة الموظفين</h1>
          <div className="text-sm text-gray-600">
            عرض <span className="font-bold text-blue-600">{filteredEmployees.length}</span> من أصل <span className="font-bold">{employees.length}</span> موظف
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* البحث بالاسم */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث بالاسم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* فلتر الشركة */}
            <div>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع الشركات</option>
                {companies.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>

            {/* فلتر الجنسية */}
            <div>
              <select
                value={nationalityFilter}
                onChange={(e) => setNationalityFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع الجنسيات</option>
                {nationalities.map(nationality => (
                  <option key={nationality} value={nationality}>{nationality}</option>
                ))}
              </select>
            </div>

            {/* فلتر المهنة */}
            <div>
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع المهن</option>
                {professions.map(profession => (
                  <option key={profession} value={profession}>{profession}</option>
                ))}
              </select>
            </div>

            {/* فلتر المشروع */}
            <div>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع المشاريع</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
          </div>

          {/* زر مسح الفلاتر */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
                مسح جميع الفلاتر
              </button>
              <div className="flex gap-2 flex-wrap">
                {searchTerm && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    البحث: {searchTerm}
                  </span>
                )}
                {companyFilter && (
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                    الشركة: {companyFilter}
                  </span>
                )}
                {nationalityFilter && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                    الجنسية: {nationalityFilter}
                  </span>
                )}
                {professionFilter && (
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                    المهنة: {professionFilter}
                  </span>
                )}
                {projectFilter && (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                    المشروع: {projectFilter}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الاسم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المهنة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الجنسية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الشركة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المشروع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">رقم الإقامة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">انتهاء العقد</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">انتهاء الإقامة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => {
                    const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
                    const residenceDays = getDaysRemaining(employee.residence_expiry)

                    return (
                      <tr 
                        key={employee.id} 
                        onClick={() => handleEmployeeClick(employee)}
                        className="hover:bg-gray-50 transition cursor-pointer"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{employee.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.profession}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.nationality}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.company?.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {employee.project_name ? (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {employee.project_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 font-mono">{employee.residence_number}</td>
                        <td className="px-6 py-4 text-sm">
                          {employee.contract_expiry ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-700">
                                {format(new Date(employee.contract_expiry), 'yyyy-MM-dd')}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${getStatusColor(contractDays!)}`}>
                                <Calendar className="w-3 h-3" />
                                {contractDays! < 0 ? 'منتهي' : `${contractDays} يوم`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-700">
                              {format(new Date(employee.residence_expiry), 'yyyy-MM-dd')}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${getStatusColor(residenceDays)}`}>
                              <Calendar className="w-3 h-3" />
                              {residenceDays < 0 ? 'منتهية' : `${residenceDays} يوم`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredEmployees.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>لا توجد نتائج تطابق الفلاتر المحددة</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* مودال بطاقة الموظف */}
      {isCardOpen && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseCard}
          onUpdate={handleUpdateEmployee}
        />
      )}
    </Layout>
  )
}

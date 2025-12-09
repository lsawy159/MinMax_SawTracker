import { useState, useEffect } from 'react'
import { supabase, Project } from '@/lib/supabase'
import { Users, DollarSign, TrendingUp, Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface ProjectStatistics {
  project: Project
  employee_count: number
  total_salaries: number
  average_salary: number
  employees_by_nationality: Record<string, number>
  employees_by_profession: Record<string, number>
}

export default function ProjectStatistics() {
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState<ProjectStatistics[]>([])

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      // جلب جميع المشاريع
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // جلب جميع الموظفين مع معلومات المشروع
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, project_id, nationality, profession, salary')

      if (employeesError) throw employeesError

      // حساب الإحصائيات لكل مشروع
      const stats: ProjectStatistics[] = (projects || []).map(project => {
        const projectEmployees = (employees || []).filter(emp => emp.project_id === project.id)
        
        const employee_count = projectEmployees.length
        const total_salaries = projectEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0)
        const average_salary = employee_count > 0 ? total_salaries / employee_count : 0

        // إحصائيات حسب الجنسية
        const employees_by_nationality: Record<string, number> = {}
        projectEmployees.forEach(emp => {
          if (emp.nationality) {
            employees_by_nationality[emp.nationality] = (employees_by_nationality[emp.nationality] || 0) + 1
          }
        })

        // إحصائيات حسب المهنة
        const employees_by_profession: Record<string, number> = {}
        projectEmployees.forEach(emp => {
          if (emp.profession) {
            employees_by_profession[emp.profession] = (employees_by_profession[emp.profession] || 0) + 1
          }
        })

        return {
          project,
          employee_count,
          total_salaries,
          average_salary,
          employees_by_nationality,
          employees_by_profession
        }
      })

      setStatistics(stats)
    } catch (error: unknown) {
      console.error('Error loading statistics:', error)
      toast.error('حدث خطأ أثناء تحميل الإحصائيات')
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    const excelData = statistics.map(stat => ({
      'اسم المشروع': stat.project.name,
      'الحالة': stat.project.status === 'active' ? 'نشط' : stat.project.status === 'inactive' ? 'متوقف' : 'مكتمل',
      'عدد الموظفين': stat.employee_count,
      'إجمالي الرواتب': stat.total_salaries,
      'متوسط الراتب': Math.round(stat.average_salary),
      'الوصف': stat.project.description || ''
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'إحصائيات المشاريع')

    const wscols = [
      { wch: 25 }, // اسم المشروع
      { wch: 15 }, // الحالة
      { wch: 15 }, // عدد الموظفين
      { wch: 20 }, // إجمالي الرواتب
      { wch: 15 }, // متوسط الراتب
      { wch: 40 }  // الوصف
    ]
    ws['!cols'] = wscols

    XLSX.writeFile(wb, `إحصائيات_المشاريع_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('تم تصدير الإحصائيات بنجاح')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (statistics.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">لا توجد إحصائيات متاحة</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">إحصائيات المشاريع</h3>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Download className="w-4 h-4" />
          تصدير إلى Excel
        </button>
      </div>

      {/* Statistics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المشروع</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Users className="w-4 h-4 inline ml-1" />
                  عدد الموظفين
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <DollarSign className="w-4 h-4 inline ml-1" />
                  إجمالي الرواتب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 inline ml-1" />
                  متوسط الراتب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {statistics.map((stat) => (
                <tr key={stat.project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{stat.project.name}</div>
                    {stat.project.description && (
                      <div className="text-xs text-gray-500 mt-1">{stat.project.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      stat.project.status === 'active' ? 'bg-green-100 text-green-800' :
                      stat.project.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {stat.project.status === 'active' ? 'نشط' : stat.project.status === 'inactive' ? 'متوقف' : 'مكتمل'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stat.employee_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.total_salaries.toLocaleString('ar-SA')} ريال
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Math.round(stat.average_salary).toLocaleString('ar-SA')} ريال
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <details className="cursor-pointer">
                      <summary className="hover:text-gray-700">عرض التفاصيل</summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {Object.keys(stat.employees_by_nationality).length > 0 && (
                          <div>
                            <strong>الجنسيات:</strong>
                            <ul className="list-disc list-inside mr-4">
                              {Object.entries(stat.employees_by_nationality).map(([nationality, count]) => (
                                <li key={nationality}>{nationality}: {count}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Object.keys(stat.employees_by_profession).length > 0 && (
                          <div className="mt-2">
                            <strong>المهن:</strong>
                            <ul className="list-disc list-inside mr-4">
                              {Object.entries(stat.employees_by_profession).map(([profession, count]) => (
                                <li key={profession}>{profession}: {count}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={2} className="px-6 py-3 text-sm font-bold text-gray-900">الإجمالي</td>
                <td className="px-6 py-3 text-sm font-bold text-gray-900">
                  {statistics.reduce((sum, stat) => sum + stat.employee_count, 0)}
                </td>
                <td className="px-6 py-3 text-sm font-bold text-gray-900">
                  {statistics.reduce((sum, stat) => sum + stat.total_salaries, 0).toLocaleString('ar-SA')} ريال
                </td>
                <td className="px-6 py-3 text-sm font-bold text-gray-900">
                  {statistics.length > 0
                    ? Math.round(
                        statistics.reduce((sum, stat) => sum + stat.total_salaries, 0) /
                        statistics.reduce((sum, stat) => sum + stat.employee_count, 0)
                      ).toLocaleString('ar-SA')
                    : 0} ريال
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}


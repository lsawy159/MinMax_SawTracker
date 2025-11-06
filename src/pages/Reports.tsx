// @ts-nocheck
import { useState, useEffect } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer
} from 'recharts'
import { BarChart3, Download, RefreshCw, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { differenceInDays } from 'date-fns'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16']

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<(Employee & { company: Company })[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [employeesRes, companiesRes] = await Promise.all([
        supabase.from('employees').select('*, company:companies(*)').order('name'),
        supabase.from('companies').select('*').order('name')
      ])

      if (employeesRes.error) throw employeesRes.error
      if (companiesRes.error) throw companiesRes.error

      setEmployees(employeesRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  // 1. توزيع الموظفين حسب الجنسية
  const nationalityData = () => {
    const counts: Record<string, number> = {}
    employees.forEach(emp => {
      counts[emp.nationality] = (counts[emp.nationality] || 0) + 1
    })
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }

  // 2. توزيع الموظفين حسب المؤسسة
  const companyDistributionData = () => {
    const counts: Record<string, number> = {}
    employees.forEach(emp => {
      const companyName = emp.company?.name || 'غير محدد'
      counts[companyName] = (counts[companyName] || 0) + 1
    })

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  }

  // 3. انتهاء الإقامات خلال الأشهر القادمة
  const residencyExpiryData = () => {
    const months = ['الشهر الحالي', 'الشهر القادم', 'بعد شهرين', 'بعد 3 أشهر', '+3 أشهر']
    const counts = [0, 0, 0, 0, 0]

    employees.forEach(emp => {
      const days = differenceInDays(new Date(emp.residence_expiry), new Date())
      if (days < 0) return // منتهي
      if (days <= 30) counts[0]++
      else if (days <= 60) counts[1]++
      else if (days <= 90) counts[2]++
      else if (days <= 120) counts[3]++
      else counts[4]++
    })

    return months.map((month, i) => ({ month, count: counts[i] }))
  }

  // 4. انتهاء العقود خلال الأشهر القادمة
  const contractExpiryData = () => {
    const months = ['الشهر الحالي', 'الشهر القادم', 'بعد شهرين', 'بعد 3 أشهر', '+3 أشهر']
    const counts = [0, 0, 0, 0, 0]

    employees.forEach(emp => {
      if (!emp.contract_expiry) return
      const days = differenceInDays(new Date(emp.contract_expiry), new Date())
      if (days < 0) return // منتهي
      if (days <= 30) counts[0]++
      else if (days <= 60) counts[1]++
      else if (days <= 90) counts[2]++
      else if (days <= 120) counts[3]++
      else counts[4]++
    })

    return months.map((month, i) => ({ month, count: counts[i] }))
  }

  // 5. توزيع الموظفين حسب المهنة
  const professionData = () => {
    const counts: Record<string, number> = {}
    employees.forEach(emp => {
      counts[emp.profession] = (counts[emp.profession] || 0) + 1
    })

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">التقارير والإحصائيات</h1>
              <p className="text-gray-600 mt-1">تحليل بيانات الموظفين والمؤسسات</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث
            </button>
            <button
              onClick={() => toast.info('ميزة التصدير قيد التطوير')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Download className="w-5 h-5" />
              تصدير PDF
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="text-3xl font-bold mb-2">{employees.length}</div>
            <div className="text-blue-100">إجمالي الموظفين</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="text-3xl font-bold mb-2">{companies.length}</div>
            <div className="text-green-100">عدد المؤسسات</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div className="text-3xl font-bold mb-2">
              {employees.filter(e => differenceInDays(new Date(e.residence_expiry), new Date()) <= 30).length}
            </div>
            <div className="text-orange-100">إقامات تنتهي خلال شهر</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="text-3xl font-bold mb-2">
              {new Set(employees.map(e => e.nationality)).size}
            </div>
            <div className="text-purple-100">عدد الجنسيات</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* توزيع الموظفين حسب الجنسية */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              توزيع الموظفين حسب الجنسية
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={nationalityData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* توزيع الموظفين حسب المؤسسة */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">توزيع الموظفين حسب المؤسسة</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={companyDistributionData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* انتهاء الإقامات */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">انتهاء الإقامات خلال الأشهر القادمة</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={residencyExpiryData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {residencyExpiryData().map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#3B82F6'][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* انتهاء العقود */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">انتهاء العقود خلال الأشهر القادمة</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={contractExpiryData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={3} name="عدد العقود" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* توزيع الموظفين حسب المهنة */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-4">توزيع الموظفين حسب المهنة (أكثر 8 مهن)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={professionData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {professionData().map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  )
}

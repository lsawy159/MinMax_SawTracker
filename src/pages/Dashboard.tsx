import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import { Users, Building2, AlertTriangle, Calendar } from 'lucide-react'
import Layout from '../components/layout/Layout'
import { differenceInDays } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCompanies: 0,
    expiringContracts: 0,
    expiringResidences: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [employeesRes, companiesRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('companies').select('*')
      ])

      const employees = employeesRes.data || []
      const today = new Date()

      const expiringContracts = employees.filter(emp => {
        if (!emp.contract_expiry) return false
        const diff = differenceInDays(new Date(emp.contract_expiry), today)
        return diff >= 0 && diff <= 90
      }).length

      const expiringResidences = employees.filter(emp => {
        const diff = differenceInDays(new Date(emp.residence_expiry), today)
        return diff >= 0 && diff <= 90
      }).length

      setStats({
        totalEmployees: employees.length,
        totalCompanies: companiesRes.data?.length || 0,
        expiringContracts,
        expiringResidences
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">لوحة القيادة</h1>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">إجمالي الموظفين</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalEmployees}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">إجمالي المؤسسات</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalCompanies}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Building2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">عقود منتهية قريباً</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.expiringContracts}</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Calendar className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">إقامات منتهية قريباً</p>
                    <p className="text-3xl font-bold text-red-600">{stats.expiringResidences}</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">نظرة عامة</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">متوسط الموظفين لكل مؤسسة</span>
                  <span className="text-xl font-bold text-blue-600">
                    {stats.totalCompanies > 0 ? Math.round(stats.totalEmployees / stats.totalCompanies) : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">نسبة التنبيهات النشطة</span>
                  <span className="text-xl font-bold text-orange-600">
                    {stats.totalEmployees > 0 ? Math.round(((stats.expiringContracts + stats.expiringResidences) / stats.totalEmployees) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

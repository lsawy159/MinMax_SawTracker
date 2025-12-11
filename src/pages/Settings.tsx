import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' // [PATH FIX] Reverted to alias path
import Layout from '@/components/layout/Layout' // [PATH FIX] Reverted to alias path
import { Settings as SettingsIcon, Save, Building2, Users, Globe, Plus, Trash2, Edit2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext' // [PATH FIX] Reverted to alias path
import { usePermissions } from '@/utils/permissions'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'

interface CompanyLimit {
  company_id: string
  max_employees: number
  current_employees: number
  company_name: string
  unified_number: number
}

interface Nationality {
  id: string
  name: string
  created_at: string
}

export default function Settings() {
  const { user } = useAuth()
  const { canView } = usePermissions()
  
  // --- [BEGIN FIX] ---
  // تم نقل جميع الـ Hooks (useState, useEffect) إلى هنا
  // قبل الـ return الشرطي الخاص بالـ admin
  const [companyLimits, setCompanyLimits] = useState<CompanyLimit[]>([])
  const [nationalities, setNationalities] = useState<Nationality[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'companies' | 'nationalities'>('companies')
  
  // إدارة الجنسيات
  const [showNationalityModal, setShowNationalityModal] = useState(false)
  const [editingNationality, setEditingNationality] = useState<Nationality | null>(null)
  const [nationalityName, setNationalityName] = useState('')
  
  // حوار التأكيد لحذف الجنسية
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [nationalityToDelete, setNationalityToDelete] = useState<Nationality | null>(null)

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('settings')
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    // التأكد من أن المستخدم موجود قبل تحميل البيانات
    if (user && hasViewPermission) {
      loadCompanyLimits()
      loadNationalities()
    }
  }, [user, hasViewPermission]) // [FIX] أضفنا user و hasViewPermission كاعتمادية
  // --- [END FIX] ---

  // Check if user has view permission
  if (!user || !hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // تم نقل الـ Hooks للأعلى
  // [NOTE] تم نقل useEffect للأعلى أيضاً

  const loadCompanyLimits = async () => {
    setLoading(true) // [FIX] نقل setLoading هنا ليبدأ مع تحميل هذا التبويب
    try {
      // جلب جميع الشركات
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (companiesError) throw companiesError

      // [FIX] إزالة استعلام company_limits غير الموجود - استخدام max_employees من جدول companies مباشرة
      // جلب عدد الموظفين الحالي لكل شركة
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('company_id')

      if (employeesError) throw employeesError

      // حساب عدد الموظفين لكل شركة
      const employeeCounts: Record<string, number> = {}
      employees?.forEach(emp => {
        if (emp.company_id) { // التأكد من أن company_id ليس null
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      // دمج البيانات - استخدام max_employees من جدول companies مباشرة
      const companyLimitsData: CompanyLimit[] = companies?.map(company => {
        return {
          company_id: company.id,
          max_employees: company.max_employees || 4, // استخدام max_employees من جدول companies
          current_employees: employeeCounts[company.id] || 0,
          company_name: company.name,
          unified_number: company.unified_number
        }
      }) || []

      setCompanyLimits(companyLimitsData)
    } catch (error) {
      console.error('Error loading company limits:', error)
      toast.error('حدث خطأ أثناء تحميل بيانات حدود الشركات')
    } finally {
      setLoading(false) // [FIX] نقل setLoading هنا
    }
  }

  const updateLimit = (companyId: string, newLimit: number) => {
    setCompanyLimits(prev =>
      prev.map(item =>
        item.company_id === companyId
          ? { ...item, max_employees: Math.max(1, newLimit) }
          : item
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // [FIX] تحديث max_employees في جدول companies بدلاً من company_limits غير الموجود
      for (const limit of companyLimits) {
        const { error } = await supabase
          .from('companies')
          .update({
            max_employees: limit.max_employees
          })
          .eq('id', limit.company_id)

        if (error) throw error
      }

      toast.success('تم حفظ التعديلات بنجاح')
      loadCompanyLimits()
    } catch (error) {
      console.error('Error saving limits:', error)
      toast.error('حدث خطأ أثناء حفظ التعديلات')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (current: number, max: number) => {
    if (max <= 0) return 'bg-gray-100 text-gray-700 border-gray-300'; // حالة خاصة
    const percentage = (current / max) * 100
    if (current > max) return 'bg-red-100 text-red-700 border-red-300'
    if (percentage >= 90) return 'bg-orange-100 text-orange-700 border-orange-300'
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-green-100 text-green-700 border-green-300'
  }

  // دوال إدارة الجنسيات
  const loadNationalities = async () => {
    setLoading(true) // [FIX] نقل setLoading هنا ليبدأ مع تحميل هذا التبويب
    try {
      // جلب الجنسيات الموجودة في جدول الموظفين
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('nationality')
        .not('nationality', 'is', null)

      if (employeesError) throw employeesError

      // استخراج الجنسيات الفريدة
      const uniqueNationalities = [...new Set(employees?.map(emp => emp.nationality) || [])]
      
      const nationalitiesData: Nationality[] = uniqueNationalities
        .filter(name => name) // فلترة الأسماء الفارغة
        .map((name, index) => ({
          id: `nat_${index}`,
          name: name,
          created_at: new Date().toISOString()
      }))

      setNationalities(nationalitiesData)
    } catch (error) {
      console.error('Error loading nationalities:', error)
      toast.error('حدث خطأ أثناء تحميل الجنسيات')
    } finally {
      setLoading(false) // [FIX] نقل setLoading هنا
    }
  }

  const openNationalityModal = (nationality?: Nationality) => {
    setEditingNationality(nationality || null)
    setNationalityName(nationality?.name || '')
    setShowNationalityModal(true)
  }

  const handleNationalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nationalityName.trim()) return

    try {
      if (editingNationality) {
        // تحديث الجنسية في جميع الموظفين
        const { error } = await supabase
          .from('employees')
          .update({ nationality: nationalityName.trim() })
          .eq('nationality', editingNationality.name)

        if (error) throw error
        toast.success('تم تحديث الجنسية بنجاح')
      } else {
        // لا نحتاج إلى إدراج جديد هنا لأن الجنسيات تأتي من الموظفين
        toast.info('لإضافة جنسية جديدة، قم بإضافة موظف بهذه الجنسية')
      }

      setShowNationalityModal(false)
      setNationalityName('')
      loadNationalities()
    } catch (error) {
      console.error('Error saving nationality:', error)
      toast.error('حدث خطأ أثناء حفظ الجنسية')
    }
  }

  const handleDeleteNationality = async (nationality: Nationality) => {
    setNationalityToDelete(nationality)
    setShowConfirmDelete(true)
  }

  const handleConfirmDeleteNationality = async () => {
    if (!nationalityToDelete) return

    try {
      const { error } = await supabase
        .from('employees')
        .update({ nationality: null })
        .eq('nationality', nationalityToDelete.name)

      if (error) throw error
      
      toast.success('تم حذف الجنسية بنجاح')
      loadNationalities()
      setShowConfirmDelete(false)
      setNationalityToDelete(null)
    } catch (error) {
      console.error('Error deleting nationality:', error)
      toast.error('حدث خطأ أثناء حذف الجنسية')
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الإعدادات</h1>
            <p className="text-sm text-gray-600">إدارة إعدادات النظام والحدود</p>
          </div>
        </div>

        {/* علامات التبويب */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('companies');
                loadCompanyLimits(); // تحميل البيانات عند الضغط
              }}
              className={`flex items-center gap-3 px-6 py-4 font-medium transition ${
                activeTab === 'companies'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              حدود الشركات
            </button>
            <button
              onClick={() => {
                setActiveTab('nationalities');
                loadNationalities(); // تحميل البيانات عند الضغط
              }}
              className={`flex items-center gap-3 px-6 py-4 font-medium transition ${
                activeTab === 'nationalities'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Globe className="w-5 h-5" />
              إدارة الجنسيات
            </button>
          </div>
        </div>

        {/* محتوى التبويبات */}
        {activeTab === 'companies' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">حدود الموظفين للشركات</h2>
                  <p className="text-sm text-blue-100 mt-1">
                    حدد الحد الأقصى لعدد الموظفين المسموح به لكل شركة
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                          اسم الشركة
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                          الرقم الموحد
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                          الموظفين الحاليين
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                          الحد الأقصى
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                          الحالة
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {companyLimits.map((limit) => {
                        const isOverLimit = limit.current_employees > limit.max_employees
                        const percentage = limit.max_employees > 0 ? (limit.current_employees / limit.max_employees) * 100 : 0

                        return (
                          <tr key={limit.company_id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {limit.company_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                              {limit.unified_number}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-900">
                                  {limit.current_employees}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={limit.max_employees}
                                  onChange={(e) => updateLimit(limit.company_id, parseInt(e.target.value) || 1)}
                                  className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-semibold"
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${getStatusColor(limit.current_employees, limit.max_employees)}`}>
                                  {isOverLimit ? (
                                    <span>تجاوز الحد ({limit.current_employees - limit.max_employees}+)</span>
                                  ) : percentage === 100 ? (
                                    <span>ممتلئ ({Math.round(percentage)}%)</span>
                                  ) : percentage >= 90 ? (
                                    <span>شبه ممتلئ ({Math.round(percentage)}%)</span>
                                  ) : percentage >= 70 ? (
                                    <span>جيد ({Math.round(percentage)}%)</span>
                                  ) : (
                                    <span>متاح ({limit.max_employees - limit.current_employees} مقعد)</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ملخص الإحصائيات */}
                <div className="bg-gray-50 p-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">إجمالي الشركات</div>
                      <div className="text-2xl font-bold text-gray-900">{companyLimits.length}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">إجمالي الموظفين</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {companyLimits.reduce((sum, l) => sum + l.current_employees, 0)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">إجمالي السعة</div>
                      <div className="text-2xl font-bold text-green-600">
                        {companyLimits.reduce((sum, l) => sum + l.max_employees, 0)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">شركات متجاوزة الحد</div>
                      <div className="text-2xl font-bold text-red-600">
                        {companyLimits.filter(l => l.current_employees > l.max_employees).length}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <Save className="w-5 h-5" />
                        {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* قسم إدارة الجنسيات */}
        {activeTab === 'nationalities' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">إدارة الجنسيات</h2>
                    <p className="text-sm text-green-100 mt-1">
                      عرض وتعديل الجنسيات الموجودة في النظام
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openNationalityModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
                  >
                    <Plus className="w-4 h-4" />
                    تعديل
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <div className="p-6">
                {nationalities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>لا توجد جنسيات في النظام</p>
                    <p className="text-sm text-gray-400 mt-1">ستظهر الجنسيات تلقائياً عند إضافة موظفين</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nationalities.map((nationality) => (
                      <div
                        key={nationality.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <Globe className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{nationality.name}</h3>
                              <p className="text-sm text-gray-500">جنسية</p>
                            </div>
                          </div>
                          {isAdmin ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openNationalityModal(nationality)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteNationality(nationality)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">عرض فقط</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* مودال إدارة الجنسية */}
        {showNationalityModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingNationality ? 'تعديل الجنسية' : 'إضافة جنسية جديدة'}
                </h3>
              </div>
              
              <form onSubmit={handleNationalitySubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم الجنسية *
                  </label>
                  <input
                    type="text"
                    required
                    value={nationalityName}
                    onChange={(e) => setNationalityName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="مثال: سعودية"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNationalityModal(false)
                      setNationalityName('')
                      setEditingNationality(null)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    {editingNationality ? 'حفظ التعديلات' : 'إضافة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setNationalityToDelete(null)
        }}
        onConfirm={handleConfirmDeleteNationality}
        title="حذف الجنسية"
        message={`هل أنت متأكد من حذف جنسية "${nationalityToDelete?.name}"؟ سيتم حذفها من جميع الموظفين الذين يحملون هذه الجنسية.`}
        confirmText="حذف"
        cancelText="إلغاء"
        isDangerous={true}
        icon="alert"
      />
    </Layout>
  )
}
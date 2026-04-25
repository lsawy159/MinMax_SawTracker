import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' // [PATH FIX] Reverted to alias path
import Layout from '@/components/layout/Layout' // [PATH FIX] Reverted to alias path
import { Settings as SettingsIcon, Save, Building2, Users, Globe, Plus, Trash2, Edit2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext' // [PATH FIX] Reverted to alias path
import { usePermissions } from '@/utils/permissions'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
  // طھظ… ظ†ظ‚ظ„ ط¬ظ…ظٹط¹ ط§ظ„ظ€ Hooks (useState, useEffect) ط¥ظ„ظ‰ ظ‡ظ†ط§
  // ظ‚ط¨ظ„ ط§ظ„ظ€ return ط§ظ„ط´ط±ط·ظٹ ط§ظ„ط®ط§طµ ط¨ط§ظ„ظ€ admin
  const [companyLimits, setCompanyLimits] = useState<CompanyLimit[]>([])
  const [nationalities, setNationalities] = useState<Nationality[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'companies' | 'nationalities'>('companies')
  
  // ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط§طھ
  const [showNationalityModal, setShowNationalityModal] = useState(false)
  const [editingNationality, setEditingNationality] = useState<Nationality | null>(null)
  const [nationalityName, setNationalityName] = useState('')
  
  // ط­ظˆط§ط± ط§ظ„طھط£ظƒظٹط¯ ظ„ط­ط°ظپ ط§ظ„ط¬ظ†ط³ظٹط©
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [nationalityToDelete, setNationalityToDelete] = useState<Nationality | null>(null)

  // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† طµظ„ط§ط­ظٹط© ط§ظ„ط¹ط±ط¶
  const hasViewPermission = canView('settings')
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…ظˆط¬ظˆط¯ ظ‚ط¨ظ„ طھط­ظ…ظٹظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ
    if (user && hasViewPermission) {
      loadCompanyLimits()
      loadNationalities()
    }
  }, [user, hasViewPermission]) // [FIX] ط£ط¶ظپظ†ط§ user ظˆ hasViewPermission ظƒط§ط¹طھظ…ط§ط¯ظٹط©
  // --- [END FIX] ---

  // Check if user has view permission
  if (!user || !hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ط؛ظٹط± ظ…طµط±ط­</h2>
            <p className="text-gray-600">ط¹ط°ط±ط§ظ‹طŒ ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„ط¹ط±ط¶ ظ‡ط°ظ‡ ط§ظ„طµظپط­ط©.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // طھظ… ظ†ظ‚ظ„ ط§ظ„ظ€ Hooks ظ„ظ„ط£ط¹ظ„ظ‰
  // [NOTE] طھظ… ظ†ظ‚ظ„ useEffect ظ„ظ„ط£ط¹ظ„ظ‰ ط£ظٹط¶ط§ظ‹

  const loadCompanyLimits = async () => {
    setLoading(true) // [FIX] ظ†ظ‚ظ„ setLoading ظ‡ظ†ط§ ظ„ظٹط¨ط¯ط£ ظ…ط¹ طھط­ظ…ظٹظ„ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨
    try {
      // ط¬ظ„ط¨ ط¬ظ…ظٹط¹ ط§ظ„ط´ط±ظƒط§طھ
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id').order('name')

      if (companiesError) throw companiesError

      // [FIX] ط¥ط²ط§ظ„ط© ط§ط³طھط¹ظ„ط§ظ… company_limits ط؛ظٹط± ط§ظ„ظ…ظˆط¬ظˆط¯ - ط§ط³طھط®ط¯ط§ظ… max_employees ظ…ظ† ط¬ط¯ظˆظ„ companies ظ…ط¨ط§ط´ط±ط©
      // ط¬ظ„ط¨ ط¹ط¯ط¯ ط§ظ„ظ…ظˆط¸ظپظٹظ† ط§ظ„ط­ط§ظ„ظٹ ظ„ظƒظ„ ط´ط±ظƒط©
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('company_id')

      if (employeesError) throw employeesError

      // ط­ط³ط§ط¨ ط¹ط¯ط¯ ط§ظ„ظ…ظˆط¸ظپظٹظ† ظ„ظƒظ„ ط´ط±ظƒط©
      const employeeCounts: Record<string, number> = {}
      employees?.forEach(emp => {
        if (emp.company_id) { // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† company_id ظ„ظٹط³ null
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      // ط¯ظ…ط¬ ط§ظ„ط¨ظٹط§ظ†ط§طھ - ط§ط³طھط®ط¯ط§ظ… max_employees ظ…ظ† ط¬ط¯ظˆظ„ companies ظ…ط¨ط§ط´ط±ط©
      const companyLimitsData: CompanyLimit[] = companies?.map(company => {
        return {
          company_id: company.id,
          max_employees: company.max_employees || 4, // ط§ط³طھط®ط¯ط§ظ… max_employees ظ…ظ† ط¬ط¯ظˆظ„ companies
          current_employees: employeeCounts[company.id] || 0,
          company_name: company.name,
          unified_number: company.unified_number
        }
      }) || []

      setCompanyLimits(companyLimitsData)
    } catch (error) {
      console.error('Error loading company limits:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط­ط¯ظˆط¯ ط§ظ„ط´ط±ظƒط§طھ')
    } finally {
      setLoading(false) // [FIX] ظ†ظ‚ظ„ setLoading ظ‡ظ†ط§
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
      // [FIX] طھط­ط¯ظٹط« max_employees ظپظٹ ط¬ط¯ظˆظ„ companies ط¨ط¯ظ„ط§ظ‹ ظ…ظ† company_limits ط؛ظٹط± ط§ظ„ظ…ظˆط¬ظˆط¯
      for (const limit of companyLimits) {
        const { error } = await supabase
          .from('companies')
          .update({
            max_employees: limit.max_employees
          })
          .eq('id', limit.company_id)

        if (error) throw error
      }

      toast.success('طھظ… ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„ط§طھ ط¨ظ†ط¬ط§ط­')
      loadCompanyLimits()
    } catch (error) {
      console.error('Error saving limits:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„ط§طھ')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (current: number, max: number) => {
    if (max <= 0) return 'bg-gray-100 text-gray-700 border-gray-300'; // ط­ط§ظ„ط© ط®ط§طµط©
    const percentage = (current / max) * 100
    if (current > max) return 'bg-red-100 text-red-700 border-red-300'
    if (percentage >= 90) return 'bg-orange-100 text-orange-700 border-orange-300'
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-green-100 text-green-700 border-green-300'
  }

  // ط¯ظˆط§ظ„ ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط§طھ
  const loadNationalities = async () => {
    setLoading(true) // [FIX] ظ†ظ‚ظ„ setLoading ظ‡ظ†ط§ ظ„ظٹط¨ط¯ط£ ظ…ط¹ طھط­ظ…ظٹظ„ ظ‡ط°ط§ ط§ظ„طھط¨ظˆظٹط¨
    try {
      // ط¬ظ„ط¨ ط§ظ„ط¬ظ†ط³ظٹط§طھ ط§ظ„ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط¬ط¯ظˆظ„ ط§ظ„ظ…ظˆط¸ظپظٹظ†
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('nationality')
        .not('nationality', 'is', null)

      if (employeesError) throw employeesError

      // ط§ط³طھط®ط±ط§ط¬ ط§ظ„ط¬ظ†ط³ظٹط§طھ ط§ظ„ظپط±ظٹط¯ط©
      const uniqueNationalities = [...new Set(employees?.map(emp => emp.nationality) || [])]
      
      const nationalitiesData: Nationality[] = uniqueNationalities
        .filter(name => name) // ظپظ„طھط±ط© ط§ظ„ط£ط³ظ…ط§ط، ط§ظ„ظپط§ط±ط؛ط©
        .map((name, index) => ({
          id: `nat_${index}`,
          name: name,
          created_at: new Date().toISOString()
      }))

      setNationalities(nationalitiesData)
    } catch (error) {
      console.error('Error loading nationalities:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طھط­ظ…ظٹظ„ ط§ظ„ط¬ظ†ط³ظٹط§طھ')
    } finally {
      setLoading(false) // [FIX] ظ†ظ‚ظ„ setLoading ظ‡ظ†ط§
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
        // طھط­ط¯ظٹط« ط§ظ„ط¬ظ†ط³ظٹط© ظپظٹ ط¬ظ…ظٹط¹ ط§ظ„ظ…ظˆط¸ظپظٹظ†
        const { error } = await supabase
          .from('employees')
          .update({ nationality: nationalityName.trim() })
          .eq('nationality', editingNationality.name)

        if (error) throw error
        toast.success('طھظ… طھط­ط¯ظٹط« ط§ظ„ط¬ظ†ط³ظٹط© ط¨ظ†ط¬ط§ط­')
      } else {
        // ظ„ط§ ظ†ط­طھط§ط¬ ط¥ظ„ظ‰ ط¥ط¯ط±ط§ط¬ ط¬ط¯ظٹط¯ ظ‡ظ†ط§ ظ„ط£ظ† ط§ظ„ط¬ظ†ط³ظٹط§طھ طھط£طھظٹ ظ…ظ† ط§ظ„ظ…ظˆط¸ظپظٹظ†
        toast.info('ظ„ط¥ط¶ط§ظپط© ط¬ظ†ط³ظٹط© ط¬ط¯ظٹط¯ط©طŒ ظ‚ظ… ط¨ط¥ط¶ط§ظپط© ظ…ظˆط¸ظپ ط¨ظ‡ط°ظ‡ ط§ظ„ط¬ظ†ط³ظٹط©')
      }

      setShowNationalityModal(false)
      setNationalityName('')
      loadNationalities()
    } catch (error) {
      console.error('Error saving nationality:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ظپط¸ ط§ظ„ط¬ظ†ط³ظٹط©')
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
      
      toast.success('طھظ… ط­ط°ظپ ط§ظ„ط¬ظ†ط³ظٹط© ط¨ظ†ط¬ط§ط­')
      loadNationalities()
      setShowConfirmDelete(false)
      setNationalityToDelete(null)
    } catch (error) {
      console.error('Error deleting nationality:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ط°ظپ ط§ظ„ط¬ظ†ط³ظٹط©')
    }
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        <div className="mb-6 flex items-center gap-3">
          <div className="app-icon-chip">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</h1>
            <p className="text-sm text-gray-600">ط¥ط¯ط§ط±ط© ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ… ظˆط§ظ„ط­ط¯ظˆط¯</p>
          </div>
        </div>

        {/* ط¹ظ„ط§ظ…ط§طھ ط§ظ„طھط¨ظˆظٹط¨ */}
        <div className="app-panel mb-6">
          <div className="flex border-b border-border">
            <Button
              onClick={() => {
                setActiveTab('companies');
                loadCompanyLimits();
              }}
              variant="ghost"
              className={`app-tab-button border-b-2 rounded-none ${
                activeTab === 'companies'
                  ? 'app-tab-button-active'
                  : 'border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-5 h-5" />
              ط­ط¯ظˆط¯ ط§ظ„ط´ط±ظƒط§طھ
            </Button>
            <Button
              onClick={() => {
                setActiveTab('nationalities');
                loadNationalities();
              }}
              variant="ghost"
              className={`app-tab-button border-b-2 rounded-none ${
                activeTab === 'nationalities'
                  ? 'app-tab-button-active'
                  : 'border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Globe className="w-5 h-5" />
              ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط§طھ
            </Button>
          </div>
        </div>

        {/* ظ…ط­طھظˆظ‰ ط§ظ„طھط¨ظˆظٹط¨ط§طھ */}
        {activeTab === 'companies' && (
          <div className="app-panel overflow-hidden">
            <div className="border-b border-primary/20 bg-primary/10 p-6 text-slate-900">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-slate-900" />
                <div>
                  <h2 className="text-xl font-bold">ط­ط¯ظˆط¯ ط§ظ„ظ…ظˆط¸ظپظٹظ† ظ„ظ„ط´ط±ظƒط§طھ</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    ط­ط¯ط¯ ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ ظ„ط¹ط¯ط¯ ط§ظ„ظ…ظˆط¸ظپظٹظ† ط§ظ„ظ…ط³ظ…ظˆط­ ط¨ظ‡ ظ„ظƒظ„ ط´ط±ظƒط©
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4">
                  {companyLimits.map((limit) => {
                    const isOverLimit = limit.current_employees > limit.max_employees
                    const percentage = limit.max_employees > 0 ? (limit.current_employees / limit.max_employees) * 100 : 0

                    return (
                      <div key={limit.company_id} className="app-data-strip">
                        <div className="flex min-h-fit flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-blue-500/10 p-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{limit.company_name}</p>
                              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{limit.unified_number}</p>
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/70">
                              <Users className="h-4 w-4 text-slate-500" />
                              <span className="text-slate-700 dark:text-slate-200">{limit.current_employees} ظ…ظˆط¸ظپ</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs text-slate-600 dark:text-slate-300">ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰</label>
                              <Input
                                type="number"
                                min="1"
                                value={limit.max_employees}
                                onChange={(e) => updateLimit(limit.company_id, parseInt(e.target.value) || 1)}
                                className="h-10 w-24 text-center text-sm font-semibold"
                              />
                            </div>

                            <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${getStatusColor(limit.current_employees, limit.max_employees)}`}>
                              {isOverLimit ? (
                                <span>طھط¬ط§ظˆط² ط§ظ„ط­ط¯ ({limit.current_employees - limit.max_employees}+)</span>
                              ) : percentage === 100 ? (
                                <span>ظ…ظ…طھظ„ط¦ ({Math.round(percentage)}%)</span>
                              ) : percentage >= 90 ? (
                                <span>ط´ط¨ظ‡ ظ…ظ…طھظ„ط¦ ({Math.round(percentage)}%)</span>
                              ) : percentage >= 70 ? (
                                <span>ط¬ظٹط¯ ({Math.round(percentage)}%)</span>
                              ) : (
                                <span>ظ…طھط§ط­ ({limit.max_employees - limit.current_employees} ظ…ظ‚ط¹ط¯)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ظ…ظ„ط®طµ ط§ظ„ط¥ط­طµط§ط¦ظٹط§طھ */}
                <div className="bg-gray-50 p-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط´ط±ظƒط§طھ</div>
                      <div className="text-2xl font-bold text-gray-900">{companyLimits.length}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ظˆط¸ظپظٹظ†</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {companyLimits.reduce((sum, l) => sum + l.current_employees, 0)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط³ط¹ط©</div>
                      <div className="text-2xl font-bold text-green-600">
                        {companyLimits.reduce((sum, l) => sum + l.max_employees, 0)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">ط´ط±ظƒط§طھ ظ…طھط¬ط§ظˆط²ط© ط§ظ„ط­ط¯</div>
                      <div className="text-2xl font-bold text-red-600">
                        {companyLimits.filter(l => l.current_employees > l.max_employees).length}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                      >
                        <Save className="w-5 h-5" />
                        {saving ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : 'ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„ط§طھ'}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ظ‚ط³ظ… ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط§طھ */}
        {activeTab === 'nationalities' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط§طھ</h2>
                    <p className="text-sm text-green-100 mt-1">
                      ط¹ط±ط¶ ظˆطھط¹ط¯ظٹظ„ ط§ظ„ط¬ظ†ط³ظٹط§طھ ط§ظ„ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظ†ط¸ط§ظ…
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    onClick={() => openNationalityModal()}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 text-white hover:bg-white/30"
                  >
                    <Plus className="w-4 h-4" />
                    طھط¹ط¯ظٹظ„
                  </Button>
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
                    <p>ظ„ط§ طھظˆط¬ط¯ ط¬ظ†ط³ظٹط§طھ ظپظٹ ط§ظ„ظ†ط¸ط§ظ…</p>
                    <p className="text-sm text-gray-400 mt-1">ط³طھط¸ظ‡ط± ط§ظ„ط¬ظ†ط³ظٹط§طھ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¹ظ†ط¯ ط¥ط¶ط§ظپط© ظ…ظˆط¸ظپظٹظ†</p>
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
                              <p className="text-sm text-gray-500">ط¬ظ†ط³ظٹط©</p>
                            </div>
                          </div>
                          {isAdmin ? (
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => openNationalityModal(nationality)}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg p-2 text-slate-700 hover:bg-primary/10 hover:text-slate-900"
                                title="طھط¹ط¯ظٹظ„"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteNationality(nationality)}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg p-2 text-red-600 hover:bg-red-50"
                                title="ط­ط°ظپ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">ط¹ط±ط¶ ظپظ‚ط·</span>
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

        {/* ظ…ظˆط¯ط§ظ„ ط¥ط¯ط§ط±ط© ط§ظ„ط¬ظ†ط³ظٹط© */}
        {showNationalityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingNationality ? 'طھط¹ط¯ظٹظ„ ط§ظ„ط¬ظ†ط³ظٹط©' : 'ط¥ط¶ط§ظپط© ط¬ظ†ط³ظٹط© ط¬ط¯ظٹط¯ط©'}
                </h3>
              </div>
              
              <form onSubmit={handleNationalitySubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ط§ط³ظ… ط§ظ„ط¬ظ†ط³ظٹط© *
                  </label>
                  <Input
                    type="text"
                    required
                    value={nationalityName}
                    onChange={(e) => setNationalityName(e.target.value)}
                    placeholder="ظ…ط«ط§ظ„: ط³ط¹ظˆط¯ظٹط©"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowNationalityModal(false)
                      setNationalityName('')
                      setEditingNationality(null)
                    }}
                    variant="outline"
                  >
                    ط¥ظ„ط؛ط§ط،
                  </Button>
                  <Button
                    type="submit"
                    variant="success"
                  >
                    {editingNationality ? 'ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„ط§طھ' : 'ط¥ط¶ط§ظپط©'}
                  </Button>
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
        title="ط­ط°ظپ ط§ظ„ط¬ظ†ط³ظٹط©"
        message={`ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ط¬ظ†ط³ظٹط© "${nationalityToDelete?.name}"طں ط³ظٹطھظ… ط­ط°ظپظ‡ط§ ظ…ظ† ط¬ظ…ظٹط¹ ط§ظ„ظ…ظˆط¸ظپظٹظ† ط§ظ„ط°ظٹظ† ظٹط­ظ…ظ„ظˆظ† ظ‡ط°ظ‡ ط§ظ„ط¬ظ†ط³ظٹط©.`}
        confirmText="ط­ط°ظپ"
        cancelText="ط¥ظ„ط؛ط§ط،"
        isDangerous={true}
        icon="alert"
      />
    </Layout>
  )
}

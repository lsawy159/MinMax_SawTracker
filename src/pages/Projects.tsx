import { useEffect, useState, useCallback } from 'react'
import { supabase, Project } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import ProjectModal from '@/components/projects/ProjectModal'
import ProjectCard from '@/components/projects/ProjectCard'
import ProjectDetailModal from '@/components/projects/ProjectDetailModal'
import ProjectStatistics from '@/components/projects/ProjectStatistics'
import { FolderKanban, Plus, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'
import { useCardColumns } from '@/hooks/useUiPreferences'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'

type SortField = 'name' | 'created_at' | 'status' | 'employee_count' | 'total_salaries'
type SortDirection = 'asc' | 'desc'
type ProjectStatus = 'all' | 'active' | 'inactive' | 'completed'
type ActiveTab = 'list' | 'statistics'

export default function Projects() {
  const { canView, canCreate } = usePermissions()
  const [projects, setProjects] = useState<(Project & { employee_count: number; total_salaries: number })[]>([])
  const [filteredProjects, setFilteredProjects] = useState<(Project & { employee_count: number; total_salaries: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('list')

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>('all')

  // Sort states
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { gridClass: projectGridClass } = useCardColumns()

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      
      // جلب جميع المشاريع
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id,name,description,status,created_at,updated_at')
        .order('name')

      if (projectsError) throw projectsError

      // جلب جميع الموظفين مع معلومات المشروع
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('project_id, salary')

      if (employeesError) throw employeesError

      // حساب الإحصائيات لكل مشروع
      const projectsWithStats = (projectsData || []).map(project => {
        const projectEmployees = (employees || []).filter(emp => emp.project_id === project.id)
        const employee_count = projectEmployees.length
        const total_salaries = projectEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0)

        return {
          ...project,
          employee_count,
          total_salaries
        }
      })

      setProjects(projectsWithStats)
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('حدث خطأ أثناء تحميل المشاريع')
    } finally {
      setLoading(false)
    }
  }, [])

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...projects]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchLower) ||
        project.description?.toLowerCase().includes(searchLower)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    // Apply sort
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ar')
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '', 'ar')
          break
        case 'employee_count':
          comparison = a.employee_count - b.employee_count
          break
        case 'total_salaries':
          comparison = a.total_salaries - b.total_salaries
          break
        default:
          comparison = 0
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    setFilteredProjects(filtered)
  }, [projects, searchTerm, statusFilter, sortField, sortDirection])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    applyFiltersAndSort()
  }, [applyFiltersAndSort])

  const handleAddProject = () => {
    setSelectedProject(null)
    setShowAddModal(true)
  }

  const handleEditProject = (project: Project) => {
    setSelectedProject(project)
    setShowEditModal(true)
  }

  const handleDeleteProject = (project: Project) => {
    setSelectedProject(project)
    setShowDeleteModal(true)
  }

  const handleViewProject = (project: Project & { employee_count?: number; total_salaries?: number }) => {
    setSelectedProject(project)
    setShowDetailModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return

    try {
      // التحقق من وجود موظفين مرتبطين بالمشروع
      const { data: employees, error: checkError } = await supabase
        .from('employees')
        .select('id')
        .eq('project_id', selectedProject.id)
        .limit(1)

      if (checkError) throw checkError

      if (employees && employees.length > 0) {
        toast.error('لا يمكن حذف المشروع لأنه يحتوي على موظفين مرتبطين به')
        return
      }

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_log').insert({
        action: 'حذف مشروع',
        entity_type: 'project',
        entity_id: selectedProject.id,
        details: { 
          project_name: selectedProject.name 
        }
      })

      toast.success('تم حذف المشروع بنجاح')
      loadProjects()
      setShowDeleteModal(false)
      setSelectedProject(null)
    } catch (error) {
      console.error('Error deleting project:', error)
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حذف المشروع'
      toast.error(errorMessage)
    }
  }

  const handleModalClose = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowDeleteModal(false)
    setShowDetailModal(false)
    setSelectedProject(null)
  }

  const handleModalSuccess = async () => {
    handleModalClose()
    await loadProjects()
  }

  if (loading && projects.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  // التحقق من الصلاحية بدون إرجاع مبكر للحفاظ على ترتيب الـ Hooks
  const hasViewPermission = canView('projects')

  return (
    <Layout>
      {!hasViewPermission ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      ) : (
      <div className="app-page app-tech-grid">
        <PageHeader
          title="المشاريع"
          description="إدارة المشاريع وعرض الإحصائيات بنفس الهوية الموحدة."
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'المشاريع' }]}
          actions={
            canCreate('projects') ? (
              <Button onClick={handleAddProject}>
                <Plus className="w-4 h-4" />
                إضافة مشروع جديد
              </Button>
            ) : undefined
          }
        />

        {/* Tabs */}
        <div className="app-toggle-shell w-fit">
          <button
            onClick={() => setActiveTab('list')}
            className={`app-toggle-button ${activeTab === 'list' ? 'app-toggle-button-active' : ''}`}
          >
            قائمة المشاريع
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`app-toggle-button ${activeTab === 'statistics' ? 'app-toggle-button-active' : ''}`}
          >
            إحصائيات المشاريع
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' ? (
          <div className="space-y-4">
            {/* Filters */}
            <FilterBar>
                <SearchInput
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث عن مشروع..."
                  wrapperClassName="min-w-[220px] flex-1"
                />

                <div className="min-w-[150px]">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus)}
                    className="focus-ring-brand w-full rounded-lg border border-input bg-surface px-4 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="active">نشط</option>
                    <option value="inactive">متوقف</option>
                    <option value="completed">مكتمل</option>
                  </select>
                </div>

                <div className="min-w-[170px]">
                  <select
                    value={`${sortField}_${sortDirection}`}
                    onChange={(e) => {
                      const [field, direction] = e.target.value.split('_')
                      setSortField(field as SortField)
                      setSortDirection(direction as SortDirection)
                    }}
                    className="focus-ring-brand w-full rounded-lg border border-input bg-surface px-4 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                  >
                    <option value="name_asc">الاسم (أ-ي)</option>
                    <option value="name_desc">الاسم (ي-أ)</option>
                    <option value="employee_count_desc">عدد الموظفين (الأكثر)</option>
                    <option value="employee_count_asc">عدد الموظفين (الأقل)</option>
                    <option value="total_salaries_desc">إجمالي الرواتب (الأكبر)</option>
                    <option value="total_salaries_asc">إجمالي الرواتب (الأصغر)</option>
                    <option value="created_at_desc">الأحدث</option>
                    <option value="created_at_asc">الأقدم</option>
                  </select>
                </div>

            </FilterBar>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد مشاريع</p>
                {searchTerm || statusFilter !== 'all' ? (
                  <p className="text-sm text-gray-500 mt-2">جرب تغيير الفلاتر</p>
                ) : (
                  canCreate('projects') && (
                    <Button
                      onClick={handleAddProject}
                      className="mt-4"
                    >
                      إضافة مشروع جديد
                    </Button>
                  )
                )}
              </div>
            ) : (
              <div className={projectGridClass}>
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                    onView={handleViewProject}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <ProjectStatistics />
        )}

        {/* Modals */}
        {showAddModal && (
          <ProjectModal
            isOpen={showAddModal}
            project={null}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        )}

        {showEditModal && selectedProject && (
          <ProjectModal
            isOpen={showEditModal}
            project={selectedProject}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        )}

        {/* Project Detail Modal */}
        {showDetailModal && selectedProject && (
          <ProjectDetailModal
            project={selectedProject as Project & { employee_count?: number; total_salaries?: number }}
            onClose={handleModalClose}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">تأكيد الحذف</h3>
              <p className="text-gray-600 mb-6">
                هل أنت متأكد من حذف المشروع "{selectedProject.name}"؟
                <br />
                <span className="text-sm text-red-600">لا يمكن التراجع عن هذا الإجراء</span>
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button
                  onClick={handleModalClose}
                  variant="outline"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  variant="destructive"
                >
                  حذف
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </Layout>
  )
}


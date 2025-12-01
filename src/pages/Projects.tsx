import { useEffect, useState, useCallback } from 'react'
import { supabase, Project } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import ProjectModal from '@/components/projects/ProjectModal'
import ProjectCard from '@/components/projects/ProjectCard'
import ProjectDetailModal from '@/components/projects/ProjectDetailModal'
import ProjectStatistics from '@/components/projects/ProjectStatistics'
import { FolderKanban, Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'

type SortField = 'name' | 'created_at' | 'status' | 'employee_count' | 'total_salaries'
type SortDirection = 'asc' | 'desc'
type ProjectStatus = 'all' | 'active' | 'inactive' | 'completed'
type ActiveTab = 'list' | 'statistics'

export default function Projects() {
  const { canCreate, canEdit, canDelete } = usePermissions()
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

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      
      // جلب جميع المشاريع
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
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
    } catch (error: any) {
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
        details: { project_name: selectedProject.name }
      })

      toast.success('تم حذف المشروع بنجاح')
      loadProjects()
      setShowDeleteModal(false)
      setSelectedProject(null)
    } catch (error: any) {
      console.error('Error deleting project:', error)
      toast.error(error?.message || 'حدث خطأ أثناء حذف المشروع')
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">المشاريع</h1>
          </div>
          {activeTab === 'list' && canCreate('projects') && (
            <button
              onClick={handleAddProject}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              إضافة مشروع جديد
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'list'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              قائمة المشاريع
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'statistics'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              إحصائيات المشاريع
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' ? (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ابحث عن مشروع..."
                      className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="min-w-[150px]">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="active">نشط</option>
                    <option value="inactive">متوقف</option>
                    <option value="completed">مكتمل</option>
                  </select>
                </div>

                {/* Sort */}
                <div className="min-w-[150px]">
                  <select
                    value={`${sortField}_${sortDirection}`}
                    onChange={(e) => {
                      const [field, direction] = e.target.value.split('_')
                      setSortField(field as SortField)
                      setSortDirection(direction as SortDirection)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد مشاريع</p>
                {searchTerm || statusFilter !== 'all' ? (
                  <p className="text-sm text-gray-500 mt-2">جرب تغيير الفلاتر</p>
                ) : (
                  canCreate('projects') && (
                    <button
                      onClick={handleAddProject}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      إضافة مشروع جديد
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">تأكيد الحذف</h3>
              <p className="text-gray-600 mb-6">
                هل أنت متأكد من حذف المشروع "{selectedProject.name}"؟
                <br />
                <span className="text-sm text-red-600">لا يمكن التراجع عن هذا الإجراء</span>
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleModalClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}


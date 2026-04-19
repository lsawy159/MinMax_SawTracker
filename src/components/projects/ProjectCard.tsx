import { FolderKanban, Edit2, Trash2, Users, DollarSign } from 'lucide-react'
import { Project } from '@/lib/supabase'
import { usePermissions } from '@/utils/permissions'

interface ProjectCardProps {
  project: Project & {
    employee_count?: number
    total_salaries?: number
  }
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onView?: (project: Project & { employee_count?: number; total_salaries?: number }) => void
}

export default function ProjectCard({ project, onEdit, onDelete, onView }: ProjectCardProps) {
  const { canEdit, canDelete } = usePermissions()
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'completed':
        return 'bg-primary/15 text-slate-900 border-primary/30'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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

  return (
    <div 
      className="app-panel h-full cursor-pointer p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
      onClick={() => onView && onView(project)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="app-icon-chip">
          <FolderKanban className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status || 'active')}`}>
            {getStatusText(project.status || 'active')}
          </span>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit('projects') && (
              <button
                onClick={() => onEdit(project)}
                className="rounded-md p-1 text-slate-700 transition hover:bg-primary/10 hover:text-slate-950"
                title="تعديل المشروع"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete('projects') && (
              <button
                onClick={() => onDelete(project)}
                className="p-1 text-red-600 hover:bg-red-100 rounded-md transition"
                title="حذف المشروع"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 mb-2">{project.name}</h3>
      
      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>
      )}

      <div className="space-y-2 text-sm pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 flex items-center gap-1">
            <Users className="w-4 h-4" />
            عدد الموظفين:
          </span>
          <span className="font-bold text-gray-900">{project.employee_count || 0}</span>
        </div>
        {project.total_salaries !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600 flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              إجمالي الرواتب:
            </span>
            <span className="font-bold text-gray-900">
              {project.total_salaries.toLocaleString('ar-SA')} ريال
            </span>
          </div>
        )}
      </div>
    </div>
  )
}


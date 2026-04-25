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
      className="group relative h-full cursor-pointer overflow-hidden rounded-2xl border-2 border-sky-200 bg-white/95 p-3.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(14,116,144,0.65)]"
      onClick={() => onView && onView(project)}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-sky-300/60 to-emerald-300/70 opacity-70 transition group-hover:opacity-100" />

      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="app-icon-chip scale-90">
          <FolderKanban className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusColor(project.status || 'active')}`}>
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
      
      <h3 className="mb-1.5 line-clamp-1 text-base font-bold text-gray-900">{project.name}</h3>

      {project.description && (
        <p className="mb-2.5 line-clamp-2 text-xs text-gray-600">{project.description}</p>
      )}

      <div className="space-y-1.5 border-t border-gray-200 pt-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-gray-600">
            <Users className="h-3.5 w-3.5" />
            عدد الموظفين:
          </span>
          <span className="font-bold text-gray-900">{project.employee_count || 0}</span>
        </div>
        {project.total_salaries !== undefined && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-gray-600">
              <DollarSign className="h-3.5 w-3.5" />
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

